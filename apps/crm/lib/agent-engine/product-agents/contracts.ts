export const PRODUCT_AGENT_IDS = [
  'supervisor',
  'atendimento',
  'sales',
  'retention',
  'escalation',
  'crm_operator',
  'governance_judge',
] as const;

/** Customer-facing agents. Kept separate from control-plane evaluators. */
export const CUSTOMER_PRODUCT_AGENT_IDS = [
  'supervisor',
  'atendimento',
  'sales',
  'retention',
  'escalation',
  'crm_operator',
] as const;

/** Control-plane agents never enter customer conversation dispatch. */
export const CONTROL_AGENT_IDS = ['governance_judge'] as const;

export type CustomerProductAgentId = (typeof CUSTOMER_PRODUCT_AGENT_IDS)[number];
export type ControlAgentId = (typeof CONTROL_AGENT_IDS)[number];

export type ProductAgentId = (typeof PRODUCT_AGENT_IDS)[number];

export const SUPERVISOR_TARGET_AGENT_IDS = [
  'atendimento',
  'sales',
  'retention',
  'escalation',
  'crm_operator',
  'governance_judge',
] as const;

export type SupervisorTargetAgentId = (typeof SUPERVISOR_TARGET_AGENT_IDS)[number];

export interface SupervisorHandoffDecision {
  targetAgent: SupervisorTargetAgentId;
  reason: string;
  confidence: number;
  requiresHumanEscalation: boolean;
}

export type SupervisorHandoffValidation =
  | { ok: true; value: SupervisorHandoffDecision }
  | {
      ok: false;
      reason:
        | 'invalid_input'
        | 'invalid_target_agent'
        | 'invalid_reason'
        | 'invalid_confidence'
        | 'invalid_escalation_flag';
    };

const PRODUCT_AGENT_ID_SET = new Set<string>(PRODUCT_AGENT_IDS);
const CUSTOMER_PRODUCT_AGENT_ID_SET = new Set<string>(CUSTOMER_PRODUCT_AGENT_IDS);
const CONTROL_AGENT_ID_SET = new Set<string>(CONTROL_AGENT_IDS);
const SUPERVISOR_TARGET_AGENT_ID_SET = new Set<string>(SUPERVISOR_TARGET_AGENT_IDS);

export function isProductAgentId(value: unknown): value is ProductAgentId {
  return typeof value === 'string' && PRODUCT_AGENT_ID_SET.has(value);
}

export function isCustomerProductAgentId(value: unknown): value is CustomerProductAgentId {
  return typeof value === 'string' && CUSTOMER_PRODUCT_AGENT_ID_SET.has(value);
}

export function isControlAgentId(value: unknown): value is ControlAgentId {
  return typeof value === 'string' && CONTROL_AGENT_ID_SET.has(value);
}

export function isSupervisorTargetAgentId(value: unknown): value is SupervisorTargetAgentId {
  return typeof value === 'string' && SUPERVISOR_TARGET_AGENT_ID_SET.has(value);
}

export function validateSupervisorHandoffDecision(input: unknown): SupervisorHandoffValidation {
  if (!input || typeof input !== 'object') return { ok: false, reason: 'invalid_input' };

  const candidate = input as Record<string, unknown>;
  if (!isSupervisorTargetAgentId(candidate.targetAgent)) {
    return { ok: false, reason: 'invalid_target_agent' };
  }

  if (typeof candidate.reason !== 'string' || !candidate.reason.trim()) {
    return { ok: false, reason: 'invalid_reason' };
  }

  if (
    typeof candidate.confidence !== 'number' ||
    !Number.isFinite(candidate.confidence) ||
    candidate.confidence < 0 ||
    candidate.confidence > 1
  ) {
    return { ok: false, reason: 'invalid_confidence' };
  }

  if (typeof candidate.requiresHumanEscalation !== 'boolean') {
    return { ok: false, reason: 'invalid_escalation_flag' };
  }

  return {
    ok: true,
    value: {
      targetAgent: candidate.targetAgent,
      reason: candidate.reason,
      confidence: candidate.confidence,
      requiresHumanEscalation: candidate.requiresHumanEscalation,
    },
  };
}
