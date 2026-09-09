import { describe, expect, it } from 'vitest';

import { aggregateAgentEvalMetrics, decidePhase4Gate } from '@/lib/agent-engine/evals/metrics';
import type { AgentEvalResult } from '@/lib/agent-engine/evals/contracts';
import { PRODUCT_AGENT_IDS, type ProductAgentId } from '@/lib/agent-engine/product-agents/contracts';

function result(agentId: ProductAgentId, overrides: Partial<AgentEvalResult> = {}): AgentEvalResult {
  return {
    caseId: `${agentId}-case`,
    caseVersion: '4.0.0',
    agentId,
    source: 'golden',
    assertions: [
      { kind: 'structured_output', severity: 'hard_gate', passed: true, evidence: 'valid' },
      { kind: 'tool_selection', severity: 'hard_gate', passed: true, evidence: 'valid' },
      { kind: 'critical_escalation', severity: 'hard_gate', passed: true, evidence: 'valid' },
      { kind: 'shadow_zero_side_effects', severity: 'hard_gate', passed: true, evidence: 'zero' },
      { kind: 'factual_groundedness', severity: 'quality', passed: true, evidence: 'grounded' },
      { kind: 'quality', severity: 'quality', passed: true, evidence: 'good' },
    ],
    qualityScore: 0.95,
    ...overrides,
  };
}

function history(count = 20): ReadonlyMap<ProductAgentId, number> {
  return new Map(PRODUCT_AGENT_IDS.map((agentId) => [agentId, count]));
}

describe('Phase 4 eval metrics gate', () => {
  it('aggregates hard gates, quality, latency, token and cost evidence per agent', () => {
    const metrics = aggregateAgentEvalMetrics([
      result('sales', { latencyMs: 100, tokens: 10, costCents: 2 }),
      result('sales', { caseId: 'sales-2', latencyMs: 300, tokens: 20, costCents: 3 }),
    ]);
    expect(metrics).toHaveLength(1);
    expect(metrics[0]).toMatchObject({
      agentId: 'sales',
      total: 2,
      hardGatePassRate: 1,
      structuredOutputValidity: 1,
      executedShadowSideEffects: 0,
      averageLatencyMs: 200,
      totalTokens: 30,
      totalCostCents: 5,
    });
  });

  it('allows GO only when every agent satisfies the conservative thresholds and history coverage', () => {
    const decision = decidePhase4Gate({
      results: PRODUCT_AGENT_IDS.map((agentId) => result(agentId)),
      criticalEscalationRecall: 1,
      minimumHistoricalSamplesPerAgent: 20,
      historicalSamplesByAgent: history(),
    });
    expect(decision.decision).toBe('GO');
  });

  it('returns NO_GO when one weak agent fails even if all others pass', () => {
    const results = PRODUCT_AGENT_IDS.map((agentId) => result(agentId));
    const index = results.findIndex((item) => item.agentId === 'sales');
    results[index] = result('sales', {
      assertions: [{ kind: 'structured_output', severity: 'hard_gate', passed: false, evidence: 'invalid' }],
    });
    const decision = decidePhase4Gate({
      results,
      criticalEscalationRecall: 1,
      minimumHistoricalSamplesPerAgent: 20,
      historicalSamplesByAgent: history(),
    });
    expect(decision.decision).toBe('NO_GO');
  });

  it('returns INCOMPLETE rather than GO when historical sample evidence is insufficient', () => {
    const decision = decidePhase4Gate({
      results: PRODUCT_AGENT_IDS.map((agentId) => result(agentId)),
      criticalEscalationRecall: 1,
      minimumHistoricalSamplesPerAgent: 20,
      historicalSamplesByAgent: history(19),
    });
    expect(decision.decision).toBe('INCOMPLETE');
  });

  it('requires 100% critical escalation recall', () => {
    const decision = decidePhase4Gate({
      results: PRODUCT_AGENT_IDS.map((agentId) => result(agentId)),
      criticalEscalationRecall: 0.99,
      minimumHistoricalSamplesPerAgent: 20,
      historicalSamplesByAgent: history(),
    });
    expect(decision.decision).toBe('NO_GO');
  });
});
