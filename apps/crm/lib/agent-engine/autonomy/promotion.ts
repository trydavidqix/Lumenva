import type { AgentAutonomyLevel } from '../policies/engine';

export interface AutonomyEvalEvidence {
  ref: string;
  observedAt: string;
  policyCompliance: number;
  failureRate: number;
  loopStopRate: number;
  factualAccuracy?: number;
  routingAccuracy?: number;
  toolSelectionAccuracy?: number;
  escalationAccuracy?: number;
  p95LatencyMs: number;
  avgCostCents: number;
}

export interface PromotionThresholds {
  maxEvidenceAgeMs: number;
  minPolicyCompliance: number;
  maxFailureRate: number;
  maxLoopStopRate: number;
}

export type PromotionDecision =
  | { kind: 'allow'; evidenceRef: string }
  | {
      kind: 'deny';
      reason:
        | 'missing_evidence'
        | 'stale_evidence'
        | 'policy_compliance_below_threshold'
        | 'failure_rate_above_threshold'
        | 'loop_stop_rate_above_threshold';
    };

export type PromotionActor = 'human' | 'system' | 'model';

export type PromotionAuthorization =
  | { kind: 'allow'; evidenceRef: string }
  | {
      kind: 'deny';
      reason:
        | 'model_cannot_promote'
        | 'promotion_gate_denied'
        | 'invalid_promotion_transition'
        | 'phase5_autopilot_disabled';
    };

const PROMOTION_ORDER: readonly AgentAutonomyLevel[] = [
  'off',
  'shadow',
  'draft',
  'assisted',
  'autopilot_low_risk',
  'autopilot_expanded',
];

export function evaluateAutonomyPromotion(input: {
  evidence: AutonomyEvalEvidence | null;
  nowMs: number;
  thresholds: PromotionThresholds;
}): PromotionDecision {
  const { evidence, nowMs, thresholds } = input;
  if (evidence === null) return { kind: 'deny', reason: 'missing_evidence' };

  const observedAtMs = Date.parse(evidence.observedAt);
  if (!Number.isFinite(observedAtMs) || nowMs - observedAtMs > thresholds.maxEvidenceAgeMs) {
    return { kind: 'deny', reason: 'stale_evidence' };
  }
  if (evidence.policyCompliance < thresholds.minPolicyCompliance) {
    return { kind: 'deny', reason: 'policy_compliance_below_threshold' };
  }
  if (evidence.failureRate > thresholds.maxFailureRate) {
    return { kind: 'deny', reason: 'failure_rate_above_threshold' };
  }
  if (evidence.loopStopRate > thresholds.maxLoopStopRate) {
    return { kind: 'deny', reason: 'loop_stop_rate_above_threshold' };
  }

  return { kind: 'allow', evidenceRef: evidence.ref };
}

export function authorizeAutonomyPromotion(input: {
  actor: PromotionActor;
  currentLevel: AgentAutonomyLevel;
  desiredLevel: AgentAutonomyLevel;
  promotionDecision: PromotionDecision;
}): PromotionAuthorization {
  if (input.actor === 'model') {
    return { kind: 'deny', reason: 'model_cannot_promote' };
  }
  if (input.promotionDecision.kind !== 'allow') {
    return { kind: 'deny', reason: 'promotion_gate_denied' };
  }
  if (
    input.desiredLevel === 'autopilot_low_risk' ||
    input.desiredLevel === 'autopilot_expanded'
  ) {
    return { kind: 'deny', reason: 'phase5_autopilot_disabled' };
  }

  const current = PROMOTION_ORDER.indexOf(input.currentLevel);
  const desired = PROMOTION_ORDER.indexOf(input.desiredLevel);
  if (current < 0 || desired !== current + 1) {
    return { kind: 'deny', reason: 'invalid_promotion_transition' };
  }

  return { kind: 'allow', evidenceRef: input.promotionDecision.evidenceRef };
}

export interface AutonomyPromotionWorkflowResult {
  decision: PromotionDecision;
  authorization: PromotionAuthorization;
}

/** Evaluate evidence and authorize one governed promotion step without side effects. */
export function runAutonomyPromotionWorkflow(input: {
  evidence: AutonomyEvalEvidence | null;
  nowMs: number;
  thresholds: PromotionThresholds;
  actor: PromotionActor;
  currentLevel: AgentAutonomyLevel;
  desiredLevel: AgentAutonomyLevel;
}): AutonomyPromotionWorkflowResult {
  const decision = evaluateAutonomyPromotion({
    evidence: input.evidence,
    nowMs: input.nowMs,
    thresholds: input.thresholds,
  });
  const authorization = authorizeAutonomyPromotion({
    actor: input.actor,
    currentLevel: input.currentLevel,
    desiredLevel: input.desiredLevel,
    promotionDecision: decision,
  });
  return { decision, authorization };
}
