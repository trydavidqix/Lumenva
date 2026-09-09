import { describe, expect, it } from 'vitest';

import {
  validateAgentEvalCase,
  validateAgentEvalResult,
} from '@/lib/agent-engine/evals/contracts';

const validCase = {
  id: 'supervisor-route-001',
  version: '4.0.0',
  agentId: 'supervisor',
  source: 'golden',
  input: { request: 'Route this request.' },
  expected: { targetAgent: 'atendimento' },
  tags: ['routing', 'happy_path'],
} as const;

const validResult = {
  caseId: validCase.id,
  caseVersion: validCase.version,
  agentId: validCase.agentId,
  source: validCase.source,
  assertions: [
    {
      kind: 'tenant_scope',
      severity: 'hard_gate',
      passed: true,
      evidence: 'organization scope matched',
    },
  ],
  qualityScore: 0.95,
} as const;

describe('Phase 4 eval contracts', () => {
  it('accepts a valid versioned golden eval case', () => {
    expect(validateAgentEvalCase(validCase)).toBe(true);
  });

  it('rejects unknown case sources and blank identity fields', () => {
    expect(validateAgentEvalCase({ ...validCase, source: 'live' })).toBe(false);
    expect(validateAgentEvalCase({ ...validCase, id: '   ' })).toBe(false);
    expect(validateAgentEvalCase({ ...validCase, version: '' })).toBe(false);
  });

  it('rejects unknown agents and malformed tags', () => {
    expect(validateAgentEvalCase({ ...validCase, agentId: 'unknown_agent' })).toBe(false);
    expect(validateAgentEvalCase({ ...validCase, tags: ['routing', '   '] })).toBe(false);
    expect(validateAgentEvalCase({ ...validCase, tags: 'routing' })).toBe(false);
  });

  it('accepts only golden or historical_replay as case sources', () => {
    expect(validateAgentEvalCase({ ...validCase, source: 'golden' })).toBe(true);
    expect(validateAgentEvalCase({ ...validCase, source: 'historical_replay' })).toBe(true);
    expect(validateAgentEvalCase({ ...validCase, source: 'production' })).toBe(false);
  });

  it('accepts only hard_gate or quality assertion severities', () => {
    expect(validateAgentEvalResult(validResult)).toBe(true);
    expect(
      validateAgentEvalResult({
        ...validResult,
        assertions: [{ ...validResult.assertions[0], severity: 'warning' }],
      }),
    ).toBe(false);
  });

  it('rejects quality scores outside the inclusive 0..1 range', () => {
    expect(validateAgentEvalResult({ ...validResult, qualityScore: 0 })).toBe(true);
    expect(validateAgentEvalResult({ ...validResult, qualityScore: 1 })).toBe(true);
    expect(validateAgentEvalResult({ ...validResult, qualityScore: -0.01 })).toBe(false);
    expect(validateAgentEvalResult({ ...validResult, qualityScore: 1.01 })).toBe(false);
  });

  it('allows quality score to be absent', () => {
    const { qualityScore: _qualityScore, ...withoutQuality } = validResult;
    expect(validateAgentEvalResult(withoutQuality)).toBe(true);
  });
});
