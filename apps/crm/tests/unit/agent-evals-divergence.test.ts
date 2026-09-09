import { describe, expect, it } from 'vitest';

import { classifyDivergence } from '@/lib/agent-engine/evals/divergence';

describe('Phase 4 human-vs-agent divergence', () => {
  it('never lets the human reference override deterministic policy', () => {
    expect(
      classifyDivergence({
        deterministicPolicyPassed: false,
        comparable: true,
        agentMatchesReference: true,
        alternativeAgentOutcomeValid: false,
        evidenceSufficient: true,
      }),
    ).toBe('human_wrong_or_policy_conflict');
  });

  it('does not count missing evidence as agent failure', () => {
    expect(
      classifyDivergence({
        deterministicPolicyPassed: true,
        comparable: true,
        agentMatchesReference: false,
        alternativeAgentOutcomeValid: false,
        evidenceSufficient: false,
      }),
    ).toBe('insufficient_evidence');
  });

  it('treats valid alternative agent outcomes as both valid', () => {
    expect(
      classifyDivergence({
        deterministicPolicyPassed: true,
        comparable: true,
        agentMatchesReference: false,
        alternativeAgentOutcomeValid: true,
        evidenceSufficient: true,
      }),
    ).toBe('both_valid');
  });

  it('returns agent_wrong only when evidence is sufficient and no valid alternative exists', () => {
    expect(
      classifyDivergence({
        deterministicPolicyPassed: true,
        comparable: true,
        agentMatchesReference: false,
        alternativeAgentOutcomeValid: false,
        evidenceSufficient: true,
      }),
    ).toBe('agent_wrong');
  });
});
