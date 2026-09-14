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
  redacted: true;
};

export type HandoffInput = Pick<
  HandoffPack,
  "handoff_id" | "reason" | "source_refs" | "evidence_refs"
> & { to_execution_epoch?: number };

function clone<T>(value: T): T {
  return structuredClone(value);
}

function redact(value: string): string {
  return value.replace(
    /((?:api[_ -]?key|token|secret|password|credential|bearer)\s*[:=]\s*)[^\s,;]+/gi,
    "$1[REDACTED]",
  ).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL_REDACTED]")
    .replace(/\b\d{3}[.\s]?\d{3}[.\s]?\d{3}[-\s]?\d{2}\b/g, "[CPF_REDACTED]")
    .replace(/(?<!\d)(?:\+\d{1,3}[\s.-]?)?(?:\d[\s.-]?){8,14}\d(?!\d)/g, "[PHONE_REDACTED]");
}

function redactList(values: string[]): string[] {
  return values.map(redact);
}

export function createHandoffPack(state: SessionState, input: HandoffInput): HandoffPack {
  return {
    handoff_id: input.handoff_id,
    session_id: state.session_id,
    from_execution_epoch: state.execution_epoch,
    ...(input.to_execution_epoch === undefined ? {} : { to_execution_epoch: input.to_execution_epoch }),
    reason: input.reason,
    normalized_goal: redact(state.goal),
    constraints: redactList(clone(state.constraints)),
    facts: redactList(clone(state.facts)),
    decisions: redactList(clone(state.decisions)),
    promises: redactList(clone(state.promises)),
    completed: redactList(clone(state.completed)),
    pending: redactList(clone(state.pending)),
    artifacts: redactList(clone(state.artifacts)),
    errors: redactList(clone(state.errors)),
    blockers: redactList(clone(state.blockers)),
    verification: redactList(clone(state.verification)),
    ...(state.next_action === undefined ? {} : { next_action: redact(state.next_action) }),
    source_refs: redactList(clone(input.source_refs)),
    evidence_refs: redactList(clone(input.evidence_refs)),
    redacted: true,
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
