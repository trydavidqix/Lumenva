export const RUNTIME_PROTOCOL_VERSION = 1 as const;

export const RUNTIME_STATES = ["offline", "starting", "idle", "busy", "stopping", "failed"] as const;
export type RuntimeState = (typeof RUNTIME_STATES)[number];

export const RISK_LEVELS = ["R0", "R1", "R2", "R3", "R4"] as const;
export type RuntimeRiskLevel = (typeof RISK_LEVELS)[number];

export type Measurement =
  | { kind: "exact"; value: number; unit: string }
  | { kind: "estimated"; value: number; unit: string; method: string }
  | { kind: "unavailable"; reason: string };

export interface RuntimeCorrelation {
  organizationId: string;
  traceId: string;
  sessionId?: string;
  taskId?: string;
  jobId?: string;
  stepId?: string;
}

export interface RuntimeIdentity {
  runtimeId: string;
  hostId: string;
  version: string;
  protocolVersion: typeof RUNTIME_PROTOCOL_VERSION;
}

export interface RuntimeCapability {
  id: string;
  version: string;
  risk: RuntimeRiskLevel;
  deterministic: boolean;
}

export interface RuntimeHealth {
  identity: RuntimeIdentity;
  state: RuntimeState;
  startedAt: string | null;
  lastHeartbeatAt: string | null;
  capabilities: readonly RuntimeCapability[];
}

export const RUNTIME_JOB_STATES = [
  "queued", "claimed", "running", "waiting_approval", "validating", "done", "failed", "blocked", "cancelled",
] as const;
export type RuntimeJobState = (typeof RUNTIME_JOB_STATES)[number];

export interface RuntimeJob {
  id: string;
  correlation: RuntimeCorrelation;
  kind: string;
  state: RuntimeJobState;
  workspaceRoot: string;
  createdAt: string;
  updatedAt: string;
}

export interface RuntimeStep {
  id: string;
  jobId: string;
  kind: string;
  state: "pending" | "running" | "succeeded" | "failed" | "blocked" | "cancelled";
  attempt: number;
  startedAt?: string;
  finishedAt?: string;
}

export interface RuntimeCheckpoint {
  id: string;
  jobId: string;
  stepId?: string;
  executionEpoch: number;
  sequence: number;
  stateHash: string;
  createdAt: string;
}

export interface RuntimeCommand {
  id: string;
  correlation: RuntimeCorrelation;
  capabilityId: string;
  executable: string;
  args: readonly string[];
  cwd: string;
  timeoutMs: number;
  maxOutputBytes: number;
  risk: RuntimeRiskLevel;
}

export interface RuntimeCommandResult {
  commandId: string;
  exitCode: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
  truncated: boolean;
  timedOut: boolean;
  durationMs: number;
}

export const VALIDATION_PROFILES = ["QUICK", "STANDARD", "FULL", "CRITICAL"] as const;
export type RuntimeValidationProfile = (typeof VALIDATION_PROFILES)[number];

export interface RuntimeValidationResult {
  profile: RuntimeValidationProfile;
  status: "passed" | "failed" | "blocked";
  commandIds: readonly string[];
  independentVerifierRequired: boolean;
  independentVerifierId?: string;
}

export interface RuntimeApprovalRequest {
  id: string;
  correlation: RuntimeCorrelation;
  risk: Extract<RuntimeRiskLevel, "R2" | "R3" | "R4">;
  action: string;
  actionHash: string;
  requestedAt: string;
  expiresAt: string;
}

export interface RuntimeEvidence {
  id: string;
  correlation: RuntimeCorrelation;
  kind: string;
  ref: string;
  hash?: string;
  createdAt: string;
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
}

export const RUNTIME_EVENT_TYPES = [
  "runtime.started", "runtime.heartbeat", "runtime.offline",
  "job.claimed", "job.step.started", "job.step.finished",
  "command.started", "command.finished", "validation.started", "validation.finished",
  "patch.applied", "approval.requested", "approval.resolved", "job.checkpointed", "job.resumed",
] as const;
export type RuntimeEventType = (typeof RUNTIME_EVENT_TYPES)[number];

export interface RuntimeEvent<T = unknown> {
  id: string;
  type: RuntimeEventType;
  correlation: RuntimeCorrelation;
  occurredAt: string;
  payload: T;
}

export function assertRuntimeCorrelation(value: RuntimeCorrelation): void {
  if (!value.organizationId.trim()) throw new Error("runtime_organization_required");
  if (!value.traceId.trim()) throw new Error("runtime_trace_required");
}

export function assertRuntimeCommand(value: RuntimeCommand): void {
  assertRuntimeCorrelation(value.correlation);
  if (!value.id.trim()) throw new Error("runtime_command_id_required");
  if (!value.capabilityId.trim()) throw new Error("runtime_capability_required");
  if (!value.executable.trim()) throw new Error("runtime_executable_required");
  if (!value.cwd.trim()) throw new Error("runtime_cwd_required");
  if (!Number.isFinite(value.timeoutMs) || value.timeoutMs <= 0) throw new Error("runtime_timeout_invalid");
  if (!Number.isInteger(value.maxOutputBytes) || value.maxOutputBytes <= 0) throw new Error("runtime_output_limit_invalid");
}
