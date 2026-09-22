import { describe, expect, it } from "vitest";
import { createHandoffRequest } from "./handoff.js";

describe("HandoffRequest", () => {
  it("creates a bounded request routed through Maestri", () => {
    const request = createHandoffRequest({
      task_id: "task-1",
      trace_id: "trace-1",
      from_agent: "claude-ceo",
      to_agent: "codex-cto",
      goal: "inspect authentication",
      scope: "packages/auth",
      constraints: ["read-only"],
      requested_capabilities: ["read_file"],
      evidence_refs: ["execution:task-1:claude"],
    });

    expect(request).toMatchObject({
      task_id: "task-1",
      from_agent: "claude-ceo",
      to_agent: "codex-cto",
      broker: "maestri",
    });
    expect(request.handoff_id).toMatch(/^handoff-[a-f0-9]{16}$/);
    expect(request).not.toHaveProperty("session");
  });

  it("rejects an unbounded handoff without goal or target", () => {
    expect(() => createHandoffRequest({ task_id: "task-1", from_agent: "claude", goal: "" })).toThrow("goal");
    expect(() => createHandoffRequest({ task_id: "task-1", from_agent: "claude", goal: "inspect" })).toThrow("to_agent");
  });
});
