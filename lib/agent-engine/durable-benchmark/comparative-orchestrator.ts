import type { DurableBenchmarkEngineId } from './contracts';
import { buildPhase7BenchmarkEvidence, type Phase7BenchmarkEvidence } from './evidence';
import {
  blockedPhase7ProviderReport,
  type Phase7ProviderReport,
} from './provider-report';

const PROVIDER_ORDER: readonly DurableBenchmarkEngineId[] = ['current', 'inngest', 'vercel_workflow'];

type ProviderFn = () => Promise<Phase7ProviderReport>;

export interface Phase7ComparativeBenchmarkResult {
  providers: readonly Phase7ProviderReport[];
  evidence: Phase7BenchmarkEvidence;
}

export async function runPhase7ComparativeBenchmarkOrchestrator(input: {
  current: ProviderFn;
  inngest: ProviderFn;
  vercelWorkflow: ProviderFn;
  generatedAt: string;
  codeSha: string;
  prerequisiteSatisfied: boolean;
}): Promise<Phase7ComparativeBenchmarkResult> {
  const providerFns: Record<DurableBenchmarkEngineId, ProviderFn> = {
    current: input.current,
    inngest: input.inngest,
    vercel_workflow: input.vercelWorkflow,
  };
  const providers: Phase7ProviderReport[] = [];
  const reasons: string[] = [];

  for (const engineId of PROVIDER_ORDER) {
    try {
      const report = await providerFns[engineId]();
      if (report.engineId !== engineId) throw new Error(`phase7_provider_identity_mismatch:${engineId}`);
      providers.push(report);
      if (report.status === 'BLOCKED' && report.reason) reasons.push(`${engineId}:${report.reason}`);
      if (report.status === 'FAIL') reasons.push(`${engineId}:hard_gates_failed`);
    } catch (error) {
      const blocked = blockedPhase7ProviderReport({
        engineId,
        reason: error instanceof Error ? error.message : String(error),
      });
      providers.push(blocked);
      reasons.push(`${engineId}:${blocked.reason ?? 'provider_blocked'}`);
    }
  }

  const evidence = buildPhase7BenchmarkEvidence({
    generatedAt: input.generatedAt,
    codeSha: input.codeSha,
    prerequisiteSatisfied: input.prerequisiteSatisfied,
    reasons,
    engines: providers.map((provider) => ({
      engineId: provider.engineId,
      ...(provider.engineVersion ? { engineVersion: provider.engineVersion } : {}),
      hardGates: provider.hardGates,
      ...(provider.score ? { score: provider.score } : {}),
      suiteCounts: provider.suiteCounts,
      realEvidence: provider.realEvidence,
    })),
  });

  return { providers, evidence };
}
