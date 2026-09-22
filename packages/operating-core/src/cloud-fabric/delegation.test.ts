import { describe, expect, it } from "vitest";
import type { ExecutionPort, TaskContract } from "./execution-port.js";
import { createHandoffRequest } from "./handoff.js";
import { MaestriDelegator } from "./delegation.js";
import type { ContextPacket } from "./context-packet.js";

const contract: TaskContract = {
  task_id: "task-delegate",
  goal: "inspect auth",
  scope: "packages/auth",
  allowed_paths: ["packages/auth"],
  constraints: ["read-only"],
  capabilities: ["read_only"],
  risk: "low",
  base_sha: "abc123",
  context_budget: { input_tokens: 1000 },
  tool_budget: { calls: 5 },
  execution_budget: { seconds: 30 },
  preferred_provider: "codex",
  evidence_required: ["tests"],
};

function provider(): ExecutionPort {
  return {
    name: "codex",
    health: async () => ({ ok: true, status: "healthy" }),
    capabilities: async () => ["execute", "read_only"],
    quota: async () => ({ provider: "codex", tokens_used: 0, cost_usd: 0, available: true, remaining_budget: 100 }),
    checkQuota: async () => ({ provider: "codex", tokens_used: 0, cost_usd: 0, available: true, remaining_budget: 100 }),
    usage: async () => ({ input_tokens: 0, cached_tokens: 0, output_tokens: 0, duration_ms: 0, cost_usd: 0 }),
    execute: async () => ({ task_id: "task-delegate", status: "success", summary: "done", files_changed: [], commands: [], tests: [], evidence: ["evidence:1"] }),
    resume: async () => { throw new Error("not used"); },
    cancel: async () => { throw new Error("not used"); },
  };
}

function contextPacket(): ContextPacket {
  return {
    packet_id: "packet-1",
    task_id: "task-delegate",
    context_version: "v1",
    level: 0,
    objective: "inspect auth",
    relevant_instructions: [],
    relevant_files: [],
    relevant_symbols: [],
    prior_decisions: [],
    constraints: [],
    available_tools: ["read_only"],
    evidence: [],
    token_budget: 1000,
    character_count: 12,
  };
}

describe("MaestriDelegator", () => {
  it("resolves context before execution and returns only a digest downstream", async () => {
    const order: string[] = [];
    const delegator = new MaestriDelegator({
      route: async () => ({ provider: "codex", adapter: provider() }),
      resolveContext: async () => { order.push("context"); return contextPacket(); },
      execute: async ({ target, contract: taskContract, context }) => {
        order.push(`execute:${target.provider}:${context.packet_id}:${taskContract.task_id}`);
        return target.adapter!.execute(taskContract);
      },
    });

    const result = await delegator.delegate({
      request: createHandoffRequest({ task_id: "task-delegate", trace_id: "trace-1", from_agent: "claude", to_agent: "codex", goal: "inspect auth" }),
      contract,
    });

    expect(order).toEqual(["context", "execute:codex:packet-1:task-delegate"]);
    expect(result.digest.task_id).toBe("task-delegate");
    expect(result.digest.evidence).toEqual(["evidence:1"]);
  });

  it("rejects direct agent-to-agent requests", async () => {
    const delegator = new MaestriDelegator({
      route: async () => ({ provider: "codex", adapter: provider() }),
      resolveContext: async () => contextPacket(),
      execute: async ({ target, contract: taskContract }) => target.adapter!.execute(taskContract),
    });
    const request = createHandoffRequest({ task_id: "task-delegate", from_agent: "claude", to_agent: "codex", goal: "inspect auth" });
    const direct = { ...request, broker: "agent" as "maestri" };

    await expect(delegator.delegate({ request: direct, contract })).rejects.toThrow("broker");
  });
});
