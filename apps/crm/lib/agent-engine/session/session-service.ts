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

/**
 * In-memory lock store whose claim/release operations use compare-and-swap.
 * The critical section is synchronous, so no await can interleave the read and
 * CAS on the JavaScript event loop.
 */
export class ToolLoopLockStore {
  private readonly locks = new Map<string, ToolLoopLock>();

  constructor(lock: ToolLoopLock) {
    this.locks.set(lock.lock_id, { ...lock });
  }

  get(lockId: string): ToolLoopLock | undefined {
    const lock = this.locks.get(lockId);
    return lock ? { ...lock } : undefined;
  }

  private compareAndSwap(
    lockId: string,
    expected: ToolLoopLock,
    replacement: ToolLoopLock,
  ): boolean {
    if (this.locks.get(lockId) !== expected) return false;
    this.locks.set(lockId, replacement);
    return true;
  }

  claim(
    toolCallId: string,
    executionEpochOrNow?: number | Date,
    now?: Date,
  ): ToolLoopLock {
    const current = this.locks.get(this.lockId());
    if (!current) throw new ToolLoopLockError("TOOL_LOOP_BUSY", "tool_loop_lock_missing");
    const replacement = claimToolLoopLock(current, toolCallId, executionEpochOrNow, now);
    if (!this.compareAndSwap(current.lock_id, current, replacement)) {
      throw new ToolLoopLockError("TOOL_LOOP_BUSY", "tool_loop_claim_race_lost");
    }
    return { ...replacement };
  }

  complete(
    toolCallId: string,
    executionEpochOrNow?: number | Date,
    now?: Date,
  ): ToolLoopLock {
    const current = this.locks.get(this.lockId());
    if (!current) throw new ToolLoopLockError("TOOL_CALL_MISMATCH", "tool_loop_lock_missing");
    const replacement = completeToolLoopLock(current, toolCallId, executionEpochOrNow, now);
    if (!this.compareAndSwap(current.lock_id, current, replacement)) {
      throw new ToolLoopLockError("TOOL_LOOP_BUSY", "tool_loop_release_race_lost");
    }
    return { ...replacement };
  }

  private lockId(): string {
    const first = this.locks.keys().next();
    if (first.done) throw new ToolLoopLockError("TOOL_LOOP_BUSY", "tool_loop_lock_missing");
    return first.value;
  }
}

export class SessionServiceRuntimeError extends Error {
  constructor(
    readonly code: Extract<
      SessionServiceErrorCode,
      "STALE_VERSION" | "SESSION_NOT_FOUND" | "TENANT_MISMATCH" | "INVALID_EXECUTION_EPOCH" | "IDEMPOTENCY_CONFLICT"
    >,
    message: string,
  ) {
    super(message);
    this.name = "SessionServiceRuntimeError";
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

/** Provider-free SessionService backed by an in-memory Map. */
export class InMemorySessionService
  implements Pick<SessionService, "create" | "load" | "checkpoint">
{
  private readonly sessions = new Map<string, SessionState>();
  private readonly snapshots = new Map<string, SessionSnapshot>();
  private readonly idempotency = new Map<string, SessionWriteResult>();

  async create(input: SessionCreateInput): Promise<SessionWriteResult> {
    const key = this.key(input.organization_id, input.session_id);
    const prior = this.idempotency.get(`create:${key}:${input.idempotency_key}`);
    if (prior) return clone(prior);
    if (this.sessions.has(key)) {
      throw new SessionServiceRuntimeError("IDEMPOTENCY_CONFLICT", "session_already_exists");
    }

    const now = new Date().toISOString();
    const state: SessionState = {
      ...clone(input),
      state_version: 1,
      status: "CREATED",
      created_at: now,
      updated_at: now,
    };
    const result = this.writeSnapshot(state, input.idempotency_key);
    this.sessions.set(key, state);
    this.idempotency.set(`create:${key}:${input.idempotency_key}`, result);
    return clone(result);
  }

  async load(input: Pick<SessionCommand, "organization_id" | "session_id">): Promise<SessionLoadResult> {
    const state = this.sessions.get(this.key(input.organization_id, input.session_id));
    if (!state) throw new SessionServiceRuntimeError("SESSION_NOT_FOUND", "session_not_found");
    return { state: clone(state), snapshot: clone(this.snapshots.get(this.key(state.organization_id, state.session_id))!) };
  }

  async checkpoint(input: SessionCommand): Promise<SessionWriteResult> {
    const key = this.key(input.organization_id, input.session_id);
    const state = this.sessions.get(key);
    if (!state) throw new SessionServiceRuntimeError("SESSION_NOT_FOUND", "session_not_found");
    if (state.organization_id !== input.organization_id) {
      throw new SessionServiceRuntimeError("TENANT_MISMATCH", "session_tenant_mismatch");
    }
    if (state.execution_epoch !== input.execution_epoch) {
      throw new SessionServiceRuntimeError("INVALID_EXECUTION_EPOCH", "session_execution_epoch_mismatch");
    }

    const prior = this.idempotency.get(`checkpoint:${key}:${input.idempotency_key}`);
    if (prior) return clone(prior);
    if (state.state_version !== input.expected_state_version) {
      throw new SessionServiceRuntimeError("STALE_VERSION", "session_state_version_stale");
    }

    const next: SessionState = {
      ...clone(state),
      state_version: state.state_version + 1,
      status: "CHECKPOINTED",
      updated_at: new Date().toISOString(),
    };
    const result = this.writeSnapshot(next, input.idempotency_key);
    this.sessions.set(key, next);
    this.idempotency.set(`checkpoint:${key}:${input.idempotency_key}`, result);
    return clone(result);
  }

  private writeSnapshot(state: SessionState, idempotencyKey: string): SessionWriteResult {
    const snapshot: SessionSnapshot = {
      snapshot_id: `${state.session_id}:${state.state_version}`,
      session_id: state.session_id,
      organization_id: state.organization_id,
      execution_epoch: state.execution_epoch,
      state_version: state.state_version,
      state: clone(state),
      created_at: state.updated_at,
      idempotency_key: idempotencyKey,
    };
    this.snapshots.set(this.key(state.organization_id, state.session_id), snapshot);
    return { state: clone(state), snapshot: clone(snapshot) };
  }

  private key(organizationId: string, sessionId: string): string {
    return `${organizationId}:${sessionId}`;
  }
}

export { claimActiveSession, SessionSupersessionError } from "./postgres-session-supersession";
