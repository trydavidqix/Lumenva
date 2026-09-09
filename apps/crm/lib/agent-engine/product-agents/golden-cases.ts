import type { ProductAgentId } from './contracts';

export interface ProductAgentGoldenCase {
  id: string;
  agentId: ProductAgentId;
  input: Readonly<Record<string, unknown>>;
  expected: Readonly<Record<string, unknown>>;
}

export const PRODUCT_AGENT_GOLDEN_CASES: readonly ProductAgentGoldenCase[] = [
  {
    id: 'supervisor-support-route',
    agentId: 'supervisor',
    input: { request: 'Customer needs help with an existing conversation.' },
    expected: { targetAgent: 'atendimento', reason: 'support_request', confidence: 0.9, requiresHumanEscalation: false },
  },
  {
    id: 'supervisor-sales-route',
    agentId: 'supervisor',
    input: { request: 'Lead asks for commercial next steps.' },
    expected: { targetAgent: 'sales', reason: 'commercial_request', confidence: 0.9, requiresHumanEscalation: false },
  },
  {
    id: 'supervisor-retention-route',
    agentId: 'supervisor',
    input: { request: 'Customer signals cancellation risk.' },
    expected: { targetAgent: 'retention', reason: 'retention_risk', confidence: 0.9, requiresHumanEscalation: false },
  },
  {
    id: 'supervisor-escalation-route',
    agentId: 'supervisor',
    input: { request: 'High-risk or policy-sensitive case.' },
    expected: { targetAgent: 'escalation', reason: 'human_review_required', confidence: 0.95, requiresHumanEscalation: true },
  },
  {
    id: 'supervisor-crm-route',
    agentId: 'supervisor',
    input: { request: 'Propose a reversible CRM note update.' },
    expected: { targetAgent: 'crm_operator', reason: 'crm_mutation_proposal', confidence: 0.88, requiresHumanEscalation: false },
  },
  {
    id: 'supervisor-governance-route',
    agentId: 'supervisor',
    input: { request: 'Evaluate a golden-case result.' },
    expected: { targetAgent: 'governance_judge', reason: 'governance_evaluation', confidence: 0.92, requiresHumanEscalation: false },
  },
  {
    id: 'supervisor-ambiguous-fallback',
    agentId: 'supervisor',
    input: { modelOutput: { targetAgent: 'unknown' } },
    expected: { targetAgent: 'escalation', reason: 'supervisor_output_invalid', confidence: 0, requiresHumanEscalation: true },
  },
  {
    id: 'atendimento-draft-support',
    agentId: 'atendimento',
    input: { request: 'Help the customer understand the next step.' },
    expected: { kind: 'draft_response', draft: 'Posso ajudar com o próximo passo.', rationale: 'Draft based on CRM context.', needsHumanReview: true },
  },
  {
    id: 'sales-qualified-lead',
    agentId: 'sales',
    input: { request: 'Lead requested pricing and a proposal.' },
    expected: { kind: 'sales_recommendation', qualification: 'hot', nextAction: 'Prepare a proposal draft for human review.', rationale: 'Explicit commercial intent.', draftMessage: 'Draft only.' },
  },
  {
    id: 'retention-high-risk',
    agentId: 'retention',
    input: { request: 'Customer mentions cancellation.' },
    expected: { kind: 'retention_recommendation', risk: 'high', action: 'Ask a human to review a recovery offer.', rationale: 'Cancellation signal present.' },
  },
  {
    id: 'escalation-policy-review',
    agentId: 'escalation',
    input: { request: 'Policy-sensitive request requires review.' },
    expected: { kind: 'human_escalation', reason: 'Policy or confidence requires human review.', priority: 'high', requiredContext: ['lead_id', 'conversation_id'] },
  },
  {
    id: 'crm-operator-note-proposal',
    agentId: 'crm_operator',
    input: { request: 'Capture a reviewed conversation fact.' },
    expected: { kind: 'crm_mutation_proposal', operation: 'add_note', targetId: 'lead-123', changes: { note: 'Customer requested follow-up.' }, rationale: 'Proposal only; governed execution remains outside this role.' },
  },
  {
    id: 'governance-golden-pass',
    agentId: 'governance_judge',
    input: { request: 'Judge a passing golden suite.' },
    expected: { kind: 'governance_judgement', passed: true, reasons: ['golden cases passed'], recommendation: 'promote_candidate' },
  },
] as const;
