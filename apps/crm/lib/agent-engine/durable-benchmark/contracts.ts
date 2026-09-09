export type DurableBenchmarkEngineId = 'current' | 'inngest' | 'vercel_workflow';
export type DurableBenchmarkTerminalState = 'completed' | 'failed' | 'rejected' | 'expired';
export type DurableBenchmarkScenarioId =
  | 'happy_path'
  | 'transient_retry'
  | 'retry_exhausted'
  | 'approval_pause_resume'
  | 'process_crash_recovery'
  | 'duplicate_delivery_idempotency'
  | 'approval_denied_or_expired'
  | 'tenant_isolation';

export interface DurableBenchmarkLifecycleEvent {
  seq: number;
  kind: string;
  stepId?: string;
  attempt?: number;
  atMs: number;
  evidence: string;
}

export interface DurableBenchmarkRunInput {
  scenarioId: DurableBenchmarkScenarioId;
  scenarioVersion: string;
  organizationId: string;
  runId: string;
}

export interface DurableBenchmarkRunResult {
  engineId: DurableBenchmarkEngineId;
  scenarioId: DurableBenchmarkScenarioId;
  scenarioVersion: string;
  organizationId: string;
  runId: string;
  terminalState: DurableBenchmarkTerminalState;
  lifecycle: readonly DurableBenchmarkLifecycleEvent[];
  retryCount: number;
  approvalRequired: boolean;
  approvalSatisfied: boolean;
  resumedFromExpectedStep: boolean;
  effectAttempts: number;
  committedEffects: number;
  recoveredAfterCrash: boolean;
  crossTenantViolation: boolean;
  durationMs: number;
  estimatedCostUsd?: number;
  engineVersion?: string;
}

export interface DurableBenchmarkAdapter {
  readonly engineId: DurableBenchmarkEngineId;
  run(input: DurableBenchmarkRunInput): Promise<DurableBenchmarkRunResult>;
}

const ENGINE_IDS = new Set<DurableBenchmarkEngineId>(['current', 'inngest', 'vercel_workflow']);
const SCENARIO_IDS = new Set<DurableBenchmarkScenarioId>([
  'happy_path',
  'transient_retry',
  'retry_exhausted',
  'approval_pause_resume',
  'process_crash_recovery',
  'duplicate_delivery_idempotency',
  'approval_denied_or_expired',
  'tenant_isolation',
]);
const TERMINAL_STATES = new Set<DurableBenchmarkTerminalState>(['completed', 'failed', 'rejected', 'expired']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && isNonNegativeFiniteNumber(value);
}

function validateLifecycle(value: unknown): value is readonly DurableBenchmarkLifecycleEvent[] {
  if (!Array.isArray(value) || value.length === 0) return false;

  let previousSeq = -1;
  let previousAtMs = -1;
  for (const item of value) {
    if (!isRecord(item)) return false;
    if (!Number.isInteger(item.seq) || (item.seq as number) <= previousSeq) return false;
    if (!isNonBlankString(item.kind) || !isNonBlankString(item.evidence)) return false;
    if (!isNonNegativeFiniteNumber(item.atMs) || (item.atMs as number) < previousAtMs) return false;
    if (item.stepId !== undefined && !isNonBlankString(item.stepId)) return false;
    if (item.attempt !== undefined && (!Number.isInteger(item.attempt) || (item.attempt as number) < 1)) return false;
    previousSeq = item.seq as number;
    previousAtMs = item.atMs as number;
  }

  return true;
}

export function validateDurableBenchmarkRunResult(value: unknown): value is DurableBenchmarkRunResult {
  if (!isRecord(value)) return false;
  if (!ENGINE_IDS.has(value.engineId as DurableBenchmarkEngineId)) return false;
  if (!SCENARIO_IDS.has(value.scenarioId as DurableBenchmarkScenarioId)) return false;
  if (!TERMINAL_STATES.has(value.terminalState as DurableBenchmarkTerminalState)) return false;
  if (!isNonBlankString(value.scenarioVersion) || !isNonBlankString(value.organizationId) || !isNonBlankString(value.runId)) {
    return false;
  }
  if (!validateLifecycle(value.lifecycle)) return false;

  for (const key of ['retryCount', 'effectAttempts', 'committedEffects'] as const) {
    if (!isNonNegativeInteger(value[key])) return false;
  }
  if (!isNonNegativeFiniteNumber(value.durationMs)) return false;
  if ((value.committedEffects as number) > (value.effectAttempts as number)) return false;

  for (const key of [
    'approvalRequired',
    'approvalSatisfied',
    'resumedFromExpectedStep',
    'recoveredAfterCrash',
    'crossTenantViolation',
  ] as const) {
    if (typeof value[key] !== 'boolean') return false;
  }

  if (value.estimatedCostUsd !== undefined && !isNonNegativeFiniteNumber(value.estimatedCostUsd)) return false;
  if (value.engineVersion !== undefined && !isNonBlankString(value.engineVersion)) return false;

  return true;
}
