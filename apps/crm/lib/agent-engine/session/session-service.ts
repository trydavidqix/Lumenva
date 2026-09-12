/**
 * Wave 3 Session-Aware Runtime contract.
 *
 * This module intentionally contains only the type surface. Persistence,
 * optimistic-concurrency checks and idempotency behaviour belong to the
 * implementation layer that will consume these contracts.
 */

export type SessionStatus =
  | "CREATED"
  | "ACTIVE"
  | "PAUSED"
  | "CHECKPOINTED"
  | "HANDOFF"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED";

export type ModelLock = {
  lock_id: string;
  session_id: string;
  model_ref: string;
  adapter_ref: string;
  agent_version: string;
  execution_epoch: number;
  expires_at: string;
};

export type ToolLoopLock = {
  lock_id: string;
  session_id: string;
  execution_epoch: number;
  iteration: number;
  max_iterations: number;
  active_tool_call_id?: string;
  expires_at: string;
};

export type ContextBudget = {
  max_tokens: number;
  max_items: number;
  max_latency_ms: number;
};

export type SessionState = {
  session_id: string;
  organization_id: string;
  agent_id: string;
  agent_version: string;
  task_id?: string;
  execution_epoch: number;
  state_version: number;
  status: SessionStatus;
  goal: string;
  constraints: string[];
  facts: string[];
  decisions: string[];
  promises: string[];
  completed: string[];
  pending: string[];
  artifacts: string[];
  errors: string[];
  blockers: string[];
  verification: string[];
  next_action?: string;
  model_lock?: ModelLock;
  tool_loop_lock?: ToolLoopLock;
  context_budget: ContextBudget;
  created_at: string;
  updated_at: string;
};

export type SessionSnapshot = {
  snapshot_id: string;
  session_id: string;
  organization_id: string;
  execution_epoch: number;
  state_version: number;
  state: SessionState;
  created_at: string;
  idempotency_key: string;
};

export type SessionCommand = {
  organization_id: string;
  session_id: string;
  execution_epoch: number;
  expected_state_version: number;
  idempotency_key: string;
};

export type SessionCreateInput = Omit<
  SessionState,
  "state_version" | "status" | "created_at" | "updated_at"
> & {
  idempotency_key: string;
};

export type SessionLoadResult = {
  state: SessionState;
  snapshot?: SessionSnapshot;
};

export type SessionWriteResult = {
  state: SessionState;
  snapshot: SessionSnapshot;
};

export type SessionServiceErrorCode =
  | "STALE_VERSION"
  | "SESSION_NOT_FOUND"
  | "TENANT_MISMATCH"
  | "INVALID_EXECUTION_EPOCH"
  | "IDEMPOTENCY_CONFLICT"
  | "TOOL_LOOP_BUSY"
  | "MAX_ITERATIONS_EXCEEDED"
  | "LOCK_EXPIRED"
  | "TOOL_CALL_MISMATCH";

export type SessionServiceError = {
  code: SessionServiceErrorCode;
  message: string;
};

export type SessionService = {
  create(input: SessionCreateInput): Promise<SessionWriteResult>;
  load(input: Pick<SessionCommand, "organization_id" | "session_id">): Promise<SessionLoadResult>;
  checkpoint(input: SessionCommand): Promise<SessionWriteResult>;
  resume(input: SessionCommand): Promise<SessionWriteResult>;
  compact(input: SessionCommand): Promise<SessionWriteResult>;
  handoff(input: SessionCommand): Promise<SessionWriteResult>;
  cancel(input: SessionCommand): Promise<SessionWriteResult>;
};

export class ToolLoopLockError extends Error {
  readonly code: Extract<
    SessionServiceErrorCode,
    | "INVALID_EXECUTION_EPOCH"
    | "TOOL_LOOP_BUSY"
    | "MAX_ITERATIONS_EXCEEDED"
    | "LOCK_EXPIRED"
    | "TOOL_CALL_MISMATCH"
  >;

  constructor(code: ToolLoopLockError["code"], message: string) {
    super(message);
    this.name = "ToolLoopLockError";
    this.code = code;
  }
}

type ToolLoopCallContext = {
  executionEpoch?: number;
  now: Date;
};

function resolveContext(executionEpochOrNow?: number | Date, now?: Date): ToolLoopCallContext {
  if (executionEpochOrNow instanceof Date) {
    return { now: executionEpochOrNow };
  }
  return { executionEpoch: executionEpochOrNow, now: now ?? new Date() };
}

function assertLiveToolLoopLock(lock: ToolLoopLock, context: ToolLoopCallContext): void {
  if (context.executionEpoch !== undefined && lock.execution_epoch !== context.executionEpoch) {
    throw new ToolLoopLockError("INVALID_EXECUTION_EPOCH", "tool_loop_execution_epoch_mismatch");
  }

  const expiresAt = Date.parse(lock.expires_at);
  if (!Number.isFinite(expiresAt) || expiresAt <= context.now.getTime()) {
    throw new ToolLoopLockError("LOCK_EXPIRED", "tool_loop_lock_expired");
  }
}

/** Claim one tool-call slot, atomically in the caller's lock store. */
export function claimToolLoopLock(
  lock: ToolLoopLock,
  toolCallId: string,
  executionEpochOrNow?: number | Date,
  now?: Date,
): ToolLoopLock {
  const context = resolveContext(executionEpochOrNow, now);
  assertLiveToolLoopLock(lock, context);

  if (lock.active_tool_call_id !== undefined) {
    throw new ToolLoopLockError("TOOL_LOOP_BUSY", "tool_loop_call_already_active");
  }
  if (lock.iteration >= lock.max_iterations) {
    throw new ToolLoopLockError("MAX_ITERATIONS_EXCEEDED", "tool_loop_max_iterations");
  }

  return { ...lock, iteration: lock.iteration + 1, active_tool_call_id: toolCallId };
}

/** Release the slot only for the worker that owns the active call. */
export function completeToolLoopLock(
  lock: ToolLoopLock,
  toolCallId: string,
  executionEpochOrNow?: number | Date,
  now?: Date,
): ToolLoopLock {
  const context = resolveContext(executionEpochOrNow, now);
  assertLiveToolLoopLock(lock, context);

  if (lock.active_tool_call_id !== toolCallId) {
    throw new ToolLoopLockError("TOOL_CALL_MISMATCH", "tool_loop_call_not_owned");
  }

  const { active_tool_call_id: _activeToolCallId, ...released } = lock;
  return released;
}
