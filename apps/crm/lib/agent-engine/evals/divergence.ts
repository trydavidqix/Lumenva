export type DivergenceClass =
  | 'agent_wrong'
  | 'human_wrong_or_policy_conflict'
  | 'both_valid'
  | 'insufficient_evidence'
  | 'requires_domain_review';

export function classifyDivergence(input: {
  deterministicPolicyPassed: boolean;
  comparable: boolean;
  agentMatchesReference: boolean;
  alternativeAgentOutcomeValid: boolean;
  evidenceSufficient: boolean;
}): DivergenceClass {
  if (!input.evidenceSufficient) return 'insufficient_evidence';
  if (!input.deterministicPolicyPassed) return 'human_wrong_or_policy_conflict';
  if (!input.comparable) return 'requires_domain_review';
  if (input.agentMatchesReference) return 'both_valid';
  if (input.alternativeAgentOutcomeValid) return 'both_valid';
  return 'agent_wrong';
}
