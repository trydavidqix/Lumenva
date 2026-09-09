import { isProductAgentId, type ProductAgentId } from '../product-agents/contracts';

export type EvalCaseSource = 'golden' | 'historical_replay';
export type EvalSeverity = 'hard_gate' | 'quality';
export type EvalAssertionKind =
  | 'tenant_scope'
  | 'structured_output'
  | 'tool_selection'
  | 'policy_compliance'
  | 'shadow_zero_side_effects'
  | 'critical_escalation'
  | 'cross_tenant_isolation'
  | 'invalid_output_blocked'
  | 'r4_non_autonomous'
  | 'factual_groundedness'
  | 'quality';

export interface AgentEvalCase {
  id: string;
  version: string;
  agentId: ProductAgentId;
  source: EvalCaseSource;
  input: Readonly<Record<string, unknown>>;
  expected: Readonly<Record<string, unknown>>;
  tags: readonly string[];
}

export interface EvalAssertionResult {
  kind: EvalAssertionKind;
  severity: EvalSeverity;
  passed: boolean;
  evidence: string;
}

export interface AgentEvalResult {
  caseId: string;
  caseVersion: string;
  agentId: ProductAgentId;
  source: EvalCaseSource;
  assertions: readonly EvalAssertionResult[];
  qualityScore?: number;
  qualityEvidence?: readonly string[];
  tokens?: number;
  costCents?: number;
  latencyMs?: number;
  provider?: string;
  model?: string;
}

const EVAL_CASE_SOURCES = new Set<EvalCaseSource>(['golden', 'historical_replay']);
const EVAL_SEVERITIES = new Set<EvalSeverity>(['hard_gate', 'quality']);
const EVAL_ASSERTION_KINDS = new Set<EvalAssertionKind>([
  'tenant_scope',
  'structured_output',
  'tool_selection',
  'policy_compliance',
  'shadow_zero_side_effects',
  'critical_escalation',
  'cross_tenant_isolation',
  'invalid_output_blocked',
  'r4_non_autonomous',
  'factual_groundedness',
  'quality',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isEvalCaseSource(value: unknown): value is EvalCaseSource {
  return typeof value === 'string' && EVAL_CASE_SOURCES.has(value as EvalCaseSource);
}

function isEvalSeverity(value: unknown): value is EvalSeverity {
  return typeof value === 'string' && EVAL_SEVERITIES.has(value as EvalSeverity);
}

function isEvalAssertionKind(value: unknown): value is EvalAssertionKind {
  return typeof value === 'string' && EVAL_ASSERTION_KINDS.has(value as EvalAssertionKind);
}

function isAssertionResult(value: unknown): value is EvalAssertionResult {
  if (!isRecord(value)) return false;
  return (
    isEvalAssertionKind(value.kind) &&
    isEvalSeverity(value.severity) &&
    typeof value.passed === 'boolean' &&
    isNonBlankString(value.evidence)
  );
}

export function validateAgentEvalCase(value: unknown): value is AgentEvalCase {
  if (!isRecord(value)) return false;
  if (!isNonBlankString(value.id) || !isNonBlankString(value.version)) return false;
  if (!isProductAgentId(value.agentId) || !isEvalCaseSource(value.source)) return false;
  if (!isRecord(value.input) || !isRecord(value.expected)) return false;
  if (!Array.isArray(value.tags) || value.tags.some((tag) => !isNonBlankString(tag))) return false;
  return true;
}

export function validateAgentEvalResult(value: unknown): value is AgentEvalResult {
  if (!isRecord(value)) return false;
  if (!isNonBlankString(value.caseId) || !isNonBlankString(value.caseVersion)) return false;
  if (!isProductAgentId(value.agentId) || !isEvalCaseSource(value.source)) return false;
  if (!Array.isArray(value.assertions) || value.assertions.some((item) => !isAssertionResult(item))) return false;

  if (
    value.qualityScore !== undefined &&
    (typeof value.qualityScore !== 'number' ||
      !Number.isFinite(value.qualityScore) ||
      value.qualityScore < 0 ||
      value.qualityScore > 1)
  ) {
    return false;
  }

  if (
    value.qualityEvidence !== undefined &&
    (!Array.isArray(value.qualityEvidence) || value.qualityEvidence.some((item) => !isNonBlankString(item)))
  ) {
    return false;
  }

  for (const key of ['tokens', 'costCents', 'latencyMs'] as const) {
    const numericValue = value[key];
    if (numericValue !== undefined && (typeof numericValue !== 'number' || !Number.isFinite(numericValue))) {
      return false;
    }
  }

  for (const key of ['provider', 'model'] as const) {
    const textValue = value[key];
    if (textValue !== undefined && !isNonBlankString(textValue)) return false;
  }

  return true;
}
