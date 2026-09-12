import type { SessionState } from "./session-service";

export type HandoffReason =
  | "PROVIDER_FAILURE"
  | "QUOTA"
  | "TIMEOUT"
  | "MODEL_CHANGE"
  | "OWNER_REQUEST"
  | "INCIDENT";

export type HandoffPack = {
  handoff_id: string;
  session_id: string;
  from_execution_epoch: number;
  to_execution_epoch?: number;
  reason: HandoffReason;
  normalized_goal: string;
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
  source_refs: string[];
  evidence_refs: string[];
  redacted: boolean;
};

export type HandoffInput = Pick<
  HandoffPack,
  "handoff_id" | "reason" | "source_refs" | "evidence_refs" | "redacted"
> & { to_execution_epoch?: number };

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function createHandoffPack(state: SessionState, input: HandoffInput): HandoffPack {
  return {
    handoff_id: input.handoff_id,
    session_id: state.session_id,
    from_execution_epoch: state.execution_epoch,
    ...(input.to_execution_epoch === undefined ? {} : { to_execution_epoch: input.to_execution_epoch }),
    reason: input.reason,
    normalized_goal: state.goal,
    constraints: clone(state.constraints),
    facts: clone(state.facts),
    decisions: clone(state.decisions),
    promises: clone(state.promises),
    completed: clone(state.completed),
    pending: clone(state.pending),
    artifacts: clone(state.artifacts),
    errors: clone(state.errors),
    blockers: clone(state.blockers),
    verification: clone(state.verification),
    ...(state.next_action === undefined ? {} : { next_action: state.next_action }),
    source_refs: clone(input.source_refs),
    evidence_refs: clone(input.evidence_refs),
    redacted: input.redacted,
  };
}

/** Rebuilds the session context on a target agent/model without losing fields. */
export function reconstructSessionState(base: SessionState, pack: HandoffPack): SessionState {
  if (base.session_id !== pack.session_id || base.execution_epoch !== pack.from_execution_epoch) {
    throw new Error("handoff_session_or_epoch_mismatch");
  }
  return {
    ...clone(base),
    goal: pack.normalized_goal,
    constraints: clone(pack.constraints),
    facts: clone(pack.facts),
    decisions: clone(pack.decisions),
    promises: clone(pack.promises),
    completed: clone(pack.completed),
    pending: clone(pack.pending),
    artifacts: clone(pack.artifacts),
    errors: clone(pack.errors),
    blockers: clone(pack.blockers),
    verification: clone(pack.verification),
    ...(pack.next_action === undefined ? { next_action: undefined } : { next_action: pack.next_action }),
  };
}
