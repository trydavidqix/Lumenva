import type { AgentDefinition } from '../contracts/agent-os';

export const REVERSIBLE_CRM_OPERATIONS = [
  'add_note',
  'update_lead_stage',
  'set_owner',
  'update_contact_fields',
] as const;

export type ReversibleCrmOperation = (typeof REVERSIBLE_CRM_OPERATIONS)[number];

export interface CrmMutationProposal {
  kind: 'crm_mutation_proposal';
  operation: ReversibleCrmOperation;
  targetId: string;
  changes: Readonly<Record<string, unknown>>;
  rationale: string;
}

export type CrmMutationProposalValidation =
  | { ok: true }
  | { ok: false; reason: 'invalid_input' | 'invalid_kind' | 'invalid_operation' | 'invalid_target' | 'invalid_changes' | 'invalid_rationale' };

const REVERSIBLE_CRM_OPERATION_SET = new Set<string>(REVERSIBLE_CRM_OPERATIONS);

export const CRM_OPERATOR_AGENT_DEFINITION = {
  id: 'crm_operator',
  version: '1.0.0',
  objective: 'Propose reversible CRM mutations for governed execution through the canonical Tool Gateway after later promotion.',
  autonomyLevel: 'shadow',
  allowedSkills: [],
  allowedTools: [],
  loop: {
    goal: 'Return one reversible CRM mutation proposal or decline to mutate.',
    maxSteps: 4,
    maxToolCalls: 1,
    maxTokens: 2_000,
    maxCostCents: 5,
    maxRuntimeMs: 12_000,
    repeatedToolLimit: 2,
    noProgressLimit: 2,
  },
  requiredModelCapabilities: ['structured_output'],
} as const satisfies AgentDefinition;

export function validateCrmMutationProposal(input: unknown): CrmMutationProposalValidation {
  if (!input || typeof input !== 'object') return { ok: false, reason: 'invalid_input' };
  const candidate = input as Record<string, unknown>;
  if (candidate.kind !== 'crm_mutation_proposal') return { ok: false, reason: 'invalid_kind' };
  if (typeof candidate.operation !== 'string' || !REVERSIBLE_CRM_OPERATION_SET.has(candidate.operation)) {
    return { ok: false, reason: 'invalid_operation' };
  }
  if (typeof candidate.targetId !== 'string' || !candidate.targetId.trim()) return { ok: false, reason: 'invalid_target' };
  if (!candidate.changes || typeof candidate.changes !== 'object' || Array.isArray(candidate.changes)) {
    return { ok: false, reason: 'invalid_changes' };
  }
  if (typeof candidate.rationale !== 'string' || !candidate.rationale.trim()) return { ok: false, reason: 'invalid_rationale' };
  return { ok: true };
}
