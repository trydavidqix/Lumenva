import type { ProductAgentId } from '../product-agents/contracts';
import { PRODUCT_AGENT_IDS } from '../product-agents/contracts';
import type { AgentEvalResult, EvalAssertionKind } from './contracts';

export interface AgentEvalMetrics {
  agentId: ProductAgentId;
  total: number;
  hardGatePassRate: number;
  routingAccuracy?: number;
  toolSelectionAccuracy?: number;
  escalationAccuracy?: number;
  factualAccuracy?: number;
  qualityPassRate?: number;
  structuredOutputValidity: number;
  executedShadowSideEffects: number;
  averageLatencyMs?: number;
  totalTokens?: number;
  totalCostCents?: number;
  failureRate: number;
  loopStopRate?: number;
}

export interface Phase4GateDecision {
  decision: 'GO' | 'NO_GO' | 'INCOMPLETE';
  reasons: readonly string[];
  perAgent: readonly AgentEvalMetrics[];
}

function rate(values: readonly boolean[]): number | undefined {
  if (values.length === 0) return undefined;
  return values.filter(Boolean).length / values.length;
}

function assertionRate(results: readonly AgentEvalResult[], kind: EvalAssertionKind): number | undefined {
  const values = results.flatMap((result) =>
    result.assertions.filter((item) => item.kind === kind).map((item) => item.passed),
  );
  return rate(values);
}

function qualityRate(results: readonly AgentEvalResult[]): number | undefined {
  const explicit = results.flatMap((result) =>
    result.assertions.filter((item) => item.kind === 'quality').map((item) => item.passed),
  );
  if (explicit.length > 0) return rate(explicit);
  const scored = results.filter((result) => result.qualityScore !== undefined);
  if (scored.length === 0) return undefined;
  return scored.filter((result) => (result.qualityScore ?? 0) >= 0.9).length / scored.length;
}

export function aggregateAgentEvalMetrics(results: readonly AgentEvalResult[]): readonly AgentEvalMetrics[] {
  const grouped = new Map<ProductAgentId, AgentEvalResult[]>();
  for (const result of results) {
    const list = grouped.get(result.agentId) ?? [];
    list.push(result);
    grouped.set(result.agentId, list);
  }

  return [...grouped.entries()].map(([agentId, items]) => {
    const hardGates = items.flatMap((item) => item.assertions.filter((assertion) => assertion.severity === 'hard_gate'));
    const structuredOutputValidity = assertionRate(items, 'structured_output') ?? 0;
    const qualityPassRate = qualityRate(items);
    const latencies = items.map((item) => item.latencyMs).filter((value): value is number => value !== undefined);
    const tokens = items.map((item) => item.tokens).filter((value): value is number => value !== undefined);
    const costs = items.map((item) => item.costCents).filter((value): value is number => value !== undefined);
    const failedRuns = items.filter((item) => item.assertions.some((assertion) => assertion.severity === 'hard_gate' && !assertion.passed));
    const sideEffectFailures = items.flatMap((item) => item.assertions.filter((assertion) => assertion.kind === 'shadow_zero_side_effects' && !assertion.passed));

    return {
      agentId,
      total: items.length,
      hardGatePassRate: hardGates.length === 0 ? 0 : hardGates.filter((item) => item.passed).length / hardGates.length,
      routingAccuracy: agentId === 'supervisor' ? qualityPassRate : undefined,
      toolSelectionAccuracy: assertionRate(items, 'tool_selection'),
      escalationAccuracy: assertionRate(items, 'critical_escalation'),
      factualAccuracy: assertionRate(items, 'factual_groundedness'),
      qualityPassRate,
      structuredOutputValidity,
      executedShadowSideEffects: sideEffectFailures.length,
      averageLatencyMs: latencies.length ? latencies.reduce((sum, value) => sum + value, 0) / latencies.length : undefined,
      totalTokens: tokens.length ? tokens.reduce((sum, value) => sum + value, 0) : undefined,
      totalCostCents: costs.length ? costs.reduce((sum, value) => sum + value, 0) : undefined,
      failureRate: items.length ? failedRuns.length / items.length : 0,
    };
  });
}

const HISTORICAL_APPLICABLE_AGENTS = new Set<ProductAgentId>([
  'supervisor',
  'atendimento',
  'sales',
  'retention',
  'escalation',
  'crm_operator',
]);

export function decidePhase4Gate(input: {
  results: readonly AgentEvalResult[];
  criticalEscalationRecall: number;
  minimumHistoricalSamplesPerAgent: number;
  historicalSamplesByAgent: ReadonlyMap<ProductAgentId, number>;
}): Phase4GateDecision {
  const perAgent = aggregateAgentEvalMetrics(input.results);
  const reasons: string[] = [];
  let incomplete = false;
  let failed = false;

  const evaluatedAgents = new Set(perAgent.map((metric) => metric.agentId));
  for (const agentId of PRODUCT_AGENT_IDS) {
    if (!evaluatedAgents.has(agentId)) {
      incomplete = true;
      reasons.push(`${agentId}: no eval results supplied`);
    }
  }

  for (const metric of perAgent) {
    if (metric.hardGatePassRate !== 1) {
      failed = true;
      reasons.push(`${metric.agentId}: hard-gate pass rate must be 100%`);
    }
    if (metric.executedShadowSideEffects !== 0) {
      failed = true;
      reasons.push(`${metric.agentId}: SHADOW side effects must remain zero`);
    }
    if (metric.structuredOutputValidity !== 1) {
      failed = true;
      reasons.push(`${metric.agentId}: structured output validity must be 100%`);
    }
    if (metric.toolSelectionAccuracy !== undefined && metric.toolSelectionAccuracy < 0.95) {
      failed = true;
      reasons.push(`${metric.agentId}: tool selection accuracy below 95%`);
    }
    if (metric.escalationAccuracy !== undefined && metric.escalationAccuracy < 0.95) {
      failed = true;
      reasons.push(`${metric.agentId}: escalation accuracy below 95%`);
    }
    if (metric.factualAccuracy !== undefined && metric.factualAccuracy < 0.95) {
      failed = true;
      reasons.push(`${metric.agentId}: factual accuracy below 95%`);
    }
    if (metric.agentId === 'supervisor' && metric.routingAccuracy !== undefined && metric.routingAccuracy < 0.95) {
      failed = true;
      reasons.push('supervisor: routing accuracy below 95%');
    }
    if (metric.agentId !== 'supervisor' && metric.qualityPassRate !== undefined && metric.qualityPassRate < 0.9) {
      failed = true;
      reasons.push(`${metric.agentId}: quality pass rate below 90%`);
    }
  }

  if (input.criticalEscalationRecall !== 1) {
    failed = true;
    reasons.push('critical escalation recall must be 100%');
  }

  for (const agentId of HISTORICAL_APPLICABLE_AGENTS) {
    const count = input.historicalSamplesByAgent.get(agentId) ?? 0;
    if (count < input.minimumHistoricalSamplesPerAgent) {
      incomplete = true;
      reasons.push(`${agentId}: historical sample evidence ${count}/${input.minimumHistoricalSamplesPerAgent}`);
    }
  }

  if (perAgent.length === 0) {
    incomplete = true;
    reasons.push('no Phase 4 eval results were supplied');
  }

  return {
    decision: failed ? 'NO_GO' : incomplete ? 'INCOMPLETE' : 'GO',
    reasons,
    perAgent,
  };
}
