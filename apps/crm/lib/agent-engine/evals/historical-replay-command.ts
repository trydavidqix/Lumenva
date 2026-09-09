import type { ProductAgentId } from '../product-agents/contracts';
import type { AgentEvalCase, AgentEvalResult } from './contracts';
import type { HistoricalReplayCandidate } from './historical-sampler';
import { decidePhase4Gate } from './metrics';

interface HistoricalReplaySampler {
  sample(input: { organizationId: string; perBucket: number }): Promise<readonly HistoricalReplayCandidate[]>;
}

export interface HistoricalReplayRunner {
  runHistoricalCase(caseItem: AgentEvalCase, organizationId: string): Promise<AgentEvalResult>;
}

export interface Phase4HistoricalReplayInput {
  mode: string;
  organizationId: string;
  minimumHistoricalSamplesPerAgent: number;
  sampler: HistoricalReplaySampler;
  runner: HistoricalReplayRunner;
}

export interface Phase4HistoricalReplayReport {
  decision: 'GO' | 'NO_GO' | 'INCOMPLETE';
  reasons: readonly string[];
  historicalSamplesByAgent: Readonly<Record<string, number>>;
  perAgent: ReturnType<typeof decidePhase4Gate>['perAgent'];
}

const BUCKET_TO_AGENT: Readonly<Record<string, ProductAgentId>> = {
  supervisor: 'supervisor',
  atendimento: 'atendimento',
  support: 'atendimento',
  sales: 'sales',
  retention: 'retention',
  escalation: 'escalation',
  crm_operator: 'crm_operator',
  governance_judge: 'governance_judge',
};

function candidateToEvalCase(candidate: HistoricalReplayCandidate): AgentEvalCase | null {
  const agentId = BUCKET_TO_AGENT[candidate.bucket];
  if (!agentId) return null;

  return {
    id: candidate.id,
    version: 'historical-v1',
    agentId,
    source: 'historical_replay',
    input: candidate.input,
    expected: candidate.humanReference ?? {},
    tags: ['historical_replay'],
  };
}

function computeCriticalEscalationRecall(results: readonly AgentEvalResult[]): number {
  const assertions = results.flatMap((result) =>
    result.assertions.filter((assertion) => assertion.kind === 'critical_escalation'),
  );
  if (assertions.length === 0) return 1;
  return assertions.filter((assertion) => assertion.passed).length / assertions.length;
}

export async function runPhase4HistoricalReplay(
  input: Phase4HistoricalReplayInput,
): Promise<Phase4HistoricalReplayReport> {
  if (input.mode !== 'SHADOW') {
    throw new Error('phase4_replay_requires_shadow_mode');
  }

  const minimumHistoricalSamplesPerAgent = Math.max(1, Math.floor(input.minimumHistoricalSamplesPerAgent));
  const candidates = await input.sampler.sample({
    organizationId: input.organizationId,
    perBucket: minimumHistoricalSamplesPerAgent,
  });

  const results: AgentEvalResult[] = [];
  const historicalSamplesByAgent = new Map<ProductAgentId, number>();

  for (const candidate of candidates) {
    if (candidate.organizationId !== input.organizationId) continue;
    const caseItem = candidateToEvalCase(candidate);
    if (!caseItem) continue;

    const result = await input.runner.runHistoricalCase(caseItem, input.organizationId);
    results.push(result);
    historicalSamplesByAgent.set(result.agentId, (historicalSamplesByAgent.get(result.agentId) ?? 0) + 1);
  }

  const gate = decidePhase4Gate({
    results,
    criticalEscalationRecall: computeCriticalEscalationRecall(results),
    minimumHistoricalSamplesPerAgent,
    historicalSamplesByAgent,
  });

  return {
    decision: gate.decision,
    reasons: gate.reasons,
    historicalSamplesByAgent: Object.fromEntries(historicalSamplesByAgent.entries()),
    perAgent: gate.perAgent,
  };
}
