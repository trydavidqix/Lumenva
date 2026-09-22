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
  it("passes the canonical context packet through the provider contract", async () => {
    let received: TaskContract | undefined;
    const context_packet = {
      packet_id: "packet-1", task_id: "task-claude", context_version: "v1", level: 0 as const,
      objective: "inspect a bounded task", relevant_instructions: [], relevant_files: [], relevant_symbols: [],
      prior_decisions: [], constraints: ["no writes"], available_tools: ["read_file"], evidence: [], token_budget: 1000, character_count: 20,
    };
    const adapter = new ClaudeAdapter({
      run: async (contractInput) => {
        received = contractInput;
        return { output: JSON.stringify({ status: "success", summary: "context received", files_changed: [], commands: [], tests: [], evidence: [] }) };
      },
    });

    await adapter.execute({ ...contract, context_packet });

    expect(received?.context_packet).toEqual(context_packet);
  });

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

  it("preserves exact Claude JSON usage metadata", async () => {
    const adapter = new ClaudeAdapter({
      run: async () => ({
        output: JSON.stringify({
          type: "result",
          result: JSON.stringify({ status: "success", summary: "measured", files_changed: [], commands: [], tests: [], evidence: [] }),
          usage: { input_tokens: 2, cache_creation_input_tokens: 30, cache_read_input_tokens: 7, output_tokens: 4 },
          total_cost_usd: 0.14,
          duration_ms: 1683,
        }),
      }),
    });

    const result = await adapter.execute(contract);
    expect(result.usage).toEqual({ input_tokens: 2, cached_tokens: 37, output_tokens: 4, duration_ms: 1683, cost_usd: 0.14 });
    await expect(adapter.usage()).resolves.toEqual(result.usage);
  });
});
