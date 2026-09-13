import { createHash } from 'node:crypto';

import { sanitizeLearningSummary } from '../hermes/sanitization';
import type { LearningScope } from './contracts';

export const LEARNING_SIGNAL_KINDS = [
  'eval_failure',
  'shadow_failure',
  'human_approval',
  'human_rejection',
  'human_correction',
  'tool_failure',
  'provider_failure',
  'policy_escalation',
  'loop_stop',
  'cost_regression',
  'latency_regression',
  'verification_failure',
  'post_promotion_regression',
  'run_success',
  'business_outcome',
  'reviewer_finding',
  'capability_changed',
  'resource_regression',
] as const;

export type LearningSignalKind = (typeof LEARNING_SIGNAL_KINDS)[number];

export interface HermesProvenance {
  missionId?: string;
  runId?: string;
  workflowId?: string;
  sessionId?: string;
  traceId?: string;
  agentVersion?: string;
}

export interface LearningSignal {
  id: string;
  scope: LearningScope;
  kind: LearningSignalKind;
  fingerprint: string;
  confidence: number;
  impact: number;
  observedAt: string;
  evidenceRef: string;
  redactedSummary: string | null;
  provenance?: HermesProvenance;
}

const signalKindSet = new Set<string>(LEARNING_SIGNAL_KINDS);

const SIGNAL_WEIGHTS: Readonly<Record<LearningSignalKind, number>> = {
  eval_failure: 1,
  shadow_failure: 0.95,
  human_approval: 0.7,
  human_rejection: 1,
  human_correction: 0.95,
  tool_failure: 0.9,
  provider_failure: 0.85,
  policy_escalation: 1,
  loop_stop: 0.9,
  cost_regression: 0.75,
  latency_regression: 0.7,
  verification_failure: 1,
  post_promotion_regression: 1,
  run_success: 0.55,
  business_outcome: 0.9,
  reviewer_finding: 0.85,
  capability_changed: 0.8,
  resource_regression: 0.75,
};

function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('flywheel_signal_invalid');
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, code: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(code);
  return value.trim();
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function boundedNumber(value: unknown, code: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(code);
  }
  return value;
}

function parseSignalKind(value: unknown): LearningSignalKind {
  if (typeof value !== 'string' || !signalKindSet.has(value)) {
    throw new Error('flywheel_signal_kind_invalid');
  }
  return value as LearningSignalKind;
}

function parseScope(value: unknown): LearningScope {
  const scope = object(value);
  const organizationId = requiredString(scope.organizationId, 'flywheel_signal_scope_invalid');
  const agentId = requiredString(scope.agentId, 'flywheel_signal_scope_invalid');
  const capabilityId = requiredString(scope.capabilityId, 'flywheel_signal_scope_invalid');
  return { organizationId, agentId, capabilityId };
}

function parseProvenance(value: unknown): HermesProvenance | undefined {
  if (value === undefined || value === null) return undefined;
  const row = object(value);
  const provenance: HermesProvenance = {
    missionId: optionalString(row.missionId),
    runId: optionalString(row.runId),
    workflowId: optionalString(row.workflowId),
    sessionId: optionalString(row.sessionId),
    traceId: optionalString(row.traceId),
    agentVersion: optionalString(row.agentVersion),
  };
  const compact = Object.fromEntries(
    Object.entries(provenance).filter(([, entry]) => entry !== undefined),
  ) as HermesProvenance;
  return Object.keys(compact).length > 0 ? compact : undefined;
}

function normalizeFailureClass(value: unknown): string {
  return requiredString(value, 'flywheel_signal_failure_class_invalid')
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function fingerprint(scope: LearningScope, kind: LearningSignalKind, failureClass: string): string {
  return createHash('sha256')
    .update(
      [scope.organizationId, scope.agentId, scope.capabilityId, kind, failureClass].join('|'),
      'utf8',
    )
    .digest('hex');
}

export function learningSignalWeight(kind: LearningSignalKind): number {
  return SIGNAL_WEIGHTS[kind];
}

export function normalizeLearningSignal(input: unknown): LearningSignal {
  const row = object(input);
  const scope = parseScope(row.scope);
  const kind = parseSignalKind(row.kind);
  const failureClass = normalizeFailureClass(row.failureClass);
  const observedAt = requiredString(row.observedAt, 'flywheel_signal_observed_at_invalid');
  if (Number.isNaN(Date.parse(observedAt))) throw new Error('flywheel_signal_observed_at_invalid');

  const provenance = parseProvenance(row.provenance);
  return {
    id: requiredString(row.id, 'flywheel_signal_id_invalid'),
    scope,
    kind,
    fingerprint: fingerprint(scope, kind, failureClass),
    confidence: boundedNumber(row.confidence, 'flywheel_signal_confidence_invalid'),
    impact: boundedNumber(row.impact, 'flywheel_signal_impact_invalid'),
    observedAt,
    evidenceRef: requiredString(row.evidenceRef, 'flywheel_signal_evidence_ref_invalid'),
    redactedSummary: sanitizeLearningSummary(row.redactedSummary),
    ...(provenance ? { provenance } : {}),
  };
}
