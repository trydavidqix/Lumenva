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
  | "IDEMPOTENCY_CONFLICT";

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
