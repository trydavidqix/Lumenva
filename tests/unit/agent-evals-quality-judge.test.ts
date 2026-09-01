import { describe, expect, it, vi } from 'vitest';

import { combineDeterministicAndQuality, createQualityJudge } from '@/lib/agent-engine/evals/quality-judge';
import type { AgentEvalCase, EvalAssertionResult } from '@/lib/agent-engine/evals/contracts';

const caseItem: AgentEvalCase = {
  id: 'quality-case',
  version: '4.0.0',
  agentId: 'atendimento',
  source: 'golden',
  input: {},
  expected: {},
  tags: ['quality'],
};

const hardPass: EvalAssertionResult = {
  kind: 'policy_compliance',
  severity: 'hard_gate',
  passed: true,
  evidence: 'policy passed',
};

const input = {
  caseItem,
  authoritativeContext: {},
  output: { kind: 'draft_response' },
};

describe('Phase 4 quality judge', () => {
  it('accepts a structured score in the inclusive 0..1 range', async () => {
    const judge = vi.fn().mockResolvedValue({ available: true, score: 0.91, passed: true, evidence: ['grounded'] });
    const result = await createQualityJudge({ judge }).evaluate(input);
    expect(result).toEqual({ available: true, score: 0.91, passed: true, evidence: ['grounded'] });
  });

  it('fails closed on malformed scores or empty evidence', async () => {
    const invalidScore = await createQualityJudge({ judge: async () => ({ available: true, score: 1.1, passed: true, evidence: ['x'] }) }).evaluate(input);
    const emptyEvidence = await createQualityJudge({ judge: async () => ({ available: true, score: 0.9, passed: true, evidence: [] }) }).evaluate(input);
    expect(invalidScore.available).toBe(false);
    expect(emptyEvidence.available).toBe(false);
  });

  it('does not turn an unavailable judge into a pass', async () => {
    const result = await createQualityJudge({ judge: async () => ({ available: false, evidence: ['provider unavailable'] }) }).evaluate(input);
    expect(result.available).toBe(false);
    expect(result.passed).not.toBe(true);
  });

  it('never lets quality score override a deterministic hard-gate failure', () => {
    const combined = combineDeterministicAndQuality({
      deterministic: [{ ...hardPass, passed: false }],
      quality: { available: true, score: 1, passed: true, evidence: ['excellent'] },
    });
    expect(combined.passed).toBe(false);
  });
});
