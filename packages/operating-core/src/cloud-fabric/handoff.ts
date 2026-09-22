import { createHash } from "node:crypto";

export interface HandoffRequest {
  handoff_id: string;
  broker: "maestri";
  task_id: string;
  trace_id?: string;
  from_agent: string;
  to_agent: string;
  goal: string;
  scope?: string;
  constraints: string[];
  requested_capabilities: string[];
  evidence_refs: string[];
  created_at: string;
}

export type HandoffRequestInput = Omit<HandoffRequest, "handoff_id" | "broker" | "created_at"> & { created_at?: string };

function required(value: string | undefined, field: string): string {
  if (!value?.trim()) throw new Error(`${field} is required`);
  return value.trim();
}

export function createHandoffRequest(input: Partial<HandoffRequestInput>): HandoffRequest {
  const task_id = required(input.task_id, "task_id");
  const from_agent = required(input.from_agent, "from_agent");
  const goal = required(input.goal, "goal");
  const to_agent = required(input.to_agent, "to_agent");
  const normalized = {
    task_id,
    trace_id: input.trace_id?.trim() || undefined,
    from_agent,
    to_agent,
    goal,
    scope: input.scope?.trim() || undefined,
    constraints: [...(input.constraints ?? [])],
    requested_capabilities: [...(input.requested_capabilities ?? [])],
    evidence_refs: [...(input.evidence_refs ?? [])],
  };
  const handoff_id = `handoff-${createHash("sha256").update(JSON.stringify(normalized)).digest("hex").slice(0, 16)}`;
  return {
    ...normalized,
    handoff_id,
    broker: "maestri",
    created_at: input.created_at ?? new Date().toISOString(),
  };
}
