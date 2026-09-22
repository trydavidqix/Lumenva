import { describe, expect, it } from "vitest";
import { ClaudeAdapter } from "./claude-adapter.js";
import type { TaskContract } from "./execution-port.js";

const contract: TaskContract = {
  task_id: "task-claude",
  goal: "inspect a bounded task",
  scope: "read-only",
  allowed_paths: ["packages/operating-core/src"],
  constraints: ["no writes"],
  capabilities: ["read_file"],
  risk: "low",
  base_sha: "abc123",
  context_budget: { input_tokens: 1000 },
  tool_budget: { definitions: 5, calls: 2 },
  execution_budget: { seconds: 30 },
  preferred_provider: "claude",
  evidence_required: ["tests"],
};

describe("Claude execution adapter", () => {
  it("normalizes structured CLI output", async () => {
    const adapter = new ClaudeAdapter({
      run: async () => ({
        output: JSON.stringify({ status: "success", summary: "inspected", files_changed: [], commands: [], tests: [], evidence: ["read-only"] }),
      }),
    });

    await expect(adapter.execute(contract)).resolves.toMatchObject({ task_id: "task-claude", status: "success", summary: "inspected" });
  });

  it("does not claim health without an explicit probe", async () => {
    const adapter = new ClaudeAdapter();

    await expect(adapter.health()).resolves.toMatchObject({ ok: false, status: "unavailable" });
    await expect(adapter.capabilities()).resolves.toEqual([]);
  });
});
