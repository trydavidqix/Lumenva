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

function redact(value: string): string {
  return value.replace(
    /((?:api[_ -]?key|token|secret|password|credential|bearer)\s*[:=]\s*)[^\s,;]+/gi,
    "$1[REDACTED]",
  );
}

function redactList(values: string[], enabled: boolean): string[] {
  return values.map((value) => (enabled ? redact(value) : value));
}

export function createHandoffPack(state: SessionState, input: HandoffInput): HandoffPack {
  const redacted = input.redacted;
  return {
    handoff_id: input.handoff_id,
    session_id: state.session_id,
    from_execution_epoch: state.execution_epoch,
    ...(input.to_execution_epoch === undefined ? {} : { to_execution_epoch: input.to_execution_epoch }),
    reason: input.reason,
    normalized_goal: redacted ? redact(state.goal) : state.goal,
    constraints: redactList(clone(state.constraints), redacted),
    facts: redactList(clone(state.facts), redacted),
    decisions: redactList(clone(state.decisions), redacted),
    promises: redactList(clone(state.promises), redacted),
    completed: redactList(clone(state.completed), redacted),
    pending: redactList(clone(state.pending), redacted),
    artifacts: redactList(clone(state.artifacts), redacted),
    errors: redactList(clone(state.errors), redacted),
    blockers: redactList(clone(state.blockers), redacted),
    verification: redactList(clone(state.verification), redacted),
    ...(state.next_action === undefined ? {} : { next_action: redacted ? redact(state.next_action) : state.next_action }),
    source_refs: redactList(clone(input.source_refs), redacted),
    evidence_refs: redactList(clone(input.evidence_refs), redacted),
    redacted,
  };
}

/** Rebuilds the session context on a target agent/model without losing fields. */
export function reconstructSessionState(base: SessionState, pack: HandoffPack): SessionState {
  if (base.session_id !== pack.session_id || base.execution_epoch !== pack.from_execution_epoch) {
    throw new Error("handoff_session_or_epoch_mismatch");
  }
  return {
    ...clone(base),
    execution_epoch: pack.to_execution_epoch ?? base.execution_epoch,
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
