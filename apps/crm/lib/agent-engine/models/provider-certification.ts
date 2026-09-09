import type { Queryable } from '../queue/queue';
import type { ModelCertificationState } from './certification';

export type ProviderCertificationStep =
  | 'connection'
  | 'structured_output'
  | 'tool_calling'
  | 'tool_failure'
  | 'timeout'
  | 'fallback'
  | 'golden_cases';

export interface ProviderCertificationEvidence {
  step: ProviderCertificationStep;
  passed: boolean;
  error?: string;
}

export interface ProviderCertificationRecord {
  provider: string;
  model: string;
  status: ModelCertificationState;
  evidence: ProviderCertificationEvidence[];
  certifiedAt: string;
}

export interface ProviderCertificationStore {
  save(record: ProviderCertificationRecord): Promise<void>;
}

export function createPostgresModelCertificationStore(
  db: Queryable,
): ProviderCertificationStore {
  return {
    async save(record) {
      const result = await db.query(
        `update ai_models
            set metadata = jsonb_set(
              coalesce(metadata, '{}'::jsonb),
              '{agent_os_certification}',
              $3::jsonb,
              true
            )
          where provider = $1 and model_id = $2`,
        [
          record.provider,
          record.model,
          JSON.stringify({
            status: record.status,
            evidence: record.evidence,
            certified_at: record.certifiedAt,
          }),
        ],
      );

      if (result.rowCount === 0) {
        throw new Error(`model_certification_target_not_found:${record.provider}:${record.model}`);
      }
    },
  };
}

export interface ProviderCertificationAdapter {
  connection(): Promise<boolean>;
  structuredOutput(): Promise<boolean>;
  toolCalling(): Promise<boolean>;
  toolFailure(): Promise<boolean>;
  timeout(): Promise<boolean>;
  fallback(): Promise<boolean>;
  goldenCases(): Promise<boolean>;
}

export async function runProviderCertification(input: {
  provider: string;
  model: string;
  store: ProviderCertificationStore;
  adapter: ProviderCertificationAdapter;
  destructiveToolExecutor: (...args: unknown[]) => unknown;
}): Promise<ProviderCertificationRecord> {
  const steps: Array<[ProviderCertificationStep, () => Promise<boolean>]> = [
    ['connection', () => input.adapter.connection()],
    ['structured_output', () => input.adapter.structuredOutput()],
    ['tool_calling', () => input.adapter.toolCalling()],
    ['tool_failure', () => input.adapter.toolFailure()],
    ['timeout', () => input.adapter.timeout()],
    ['fallback', () => input.adapter.fallback()],
    ['golden_cases', () => input.adapter.goldenCases()],
  ];

  const evidence: ProviderCertificationEvidence[] = [];

  for (const [step, run] of steps) {
    try {
      evidence.push({ step, passed: await run() });
    } catch (error) {
      evidence.push({
        step,
        passed: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const record: ProviderCertificationRecord = {
    provider: input.provider,
    model: input.model,
    status: evidence.every((item) => item.passed) ? 'CERTIFIED' : 'EXPERIMENTAL',
    evidence,
    certifiedAt: new Date().toISOString(),
  };

  // Deliberately never invoke destructiveToolExecutor in certification.
  await input.store.save(record);
  return record;
}
