import { describe, expect, it } from 'vitest';

import {
  GOVERNANCE_JUDGE_AGENT_DEFINITION,
  validateGovernanceJudgement,
} from '@/lib/agent-engine/product-agents/governance-judge';

describe('Governance/Judge product role', () => {
  it('starts in SHADOW and cannot mutate policy or autonomy', () => {
    expect(GOVERNANCE_JUDGE_AGENT_DEFINITION.id).toBe('governance_judge');
    expect(GOVERNANCE_JUDGE_AGENT_DEFINITION.version).toBe('1.0.0');
    expect(GOVERNANCE_JUDGE_AGENT_DEFINITION.autonomyLevel).toBe('shadow');
    expect(GOVERNANCE_JUDGE_AGENT_DEFINITION.allowedTools).toEqual([]);
  });

  it('returns judgement and recommendation without promotion authority', () => {
    expect(validateGovernanceJudgement({
      kind: 'governance_judgement',
      passed: true,
      reasons: ['golden cases passed'],
      recommendation: 'promote_candidate',
    })).toEqual({ ok: true });

    expect(validateGovernanceJudgement({
      kind: 'governance_judgement',
      passed: true,
      reasons: ['self promote'],
      recommendation: 'promote_now',
    })).toEqual({ ok: false, reason: 'invalid_recommendation' });
  });
});
