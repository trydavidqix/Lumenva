import { describe, expect, it } from "vitest";
import { AntigravityAdapter } from "./antigravity-adapter.js";
import { CodexAdapter } from "./codex-adapter.js";
import type { TaskContract } from "./execution-port.js";

const contract: TaskContract = {
  task_id: "task-1",
  goal: "run a bounded task",
  scope: "unit",
  allowed_paths: ["packages/operating-core/src"],
  constraints: ["no secrets"],
  capabilities: ["read_file"],
  risk: "low",
  base_sha: "abc123",
  context_budget: { input_tokens: 1000, output_tokens: 500, context_percent: 25 },
  tool_budget: { definitions: 5, calls: 2 },
  execution_budget: { seconds: 30, cost_usd: 0.1 },
  preferred_provider: "codex",
  evidence_required: ["tests"],
};

describe("ExecutionPort contract", () => {
  it("does not report simulated success when Codex is unavailable", async () => {
    const result = await new CodexAdapter().execute(contract);

    expect(result.status).toBe("unavailable");
    expect(result.error?.code).toBe("provider_unavailable");
    expect(result.files_changed).toEqual([]);
  });

  it("exposes health and capabilities without pretending to execute", async () => {
    const adapter = new AntigravityAdapter();

    expect(await adapter.health()).toMatchObject({ ok: false, status: "unavailable" });
    expect(await adapter.capabilities()).toEqual([]);
    await expect(adapter.resume("task-1")).resolves.toMatchObject({ status: "unavailable" });
    await expect(adapter.cancel("task-1")).resolves.toMatchObject({ status: "cancelled" });
  });

  it("normalizes a structured Codex result returned by an injected runner", async () => {
    const adapter = new CodexAdapter({
      run: async () => ({
        finalResponse: JSON.stringify({
          status: "success",
          summary: "implemented",
          files_changed: ["src/example.ts"],
          commands: ["pnpm test"],
          tests: [{ passed: true, report: "1 passed" }],
          evidence: ["test-report"],
        }),
      }),
    });

    await expect(adapter.execute(contract)).resolves.toMatchObject({
      task_id: "task-1",
      status: "success",
      files_changed: ["src/example.ts"],
    });
  });

  it("reports the injected provider health and capabilities instead of assuming them", async () => {
    const adapter = new CodexAdapter({
      run: async () => ({ finalResponse: "{}" }),
      health: async () => ({ ok: true, status: "healthy" }),
      capabilities: async () => ["execute", "structured_output"],
    });

    await expect(adapter.health()).resolves.toEqual({ ok: true, status: "healthy" });
    await expect(adapter.capabilities()).resolves.toEqual(["execute", "structured_output"]);
  });

  it("preserves exact Codex usage from the provider turn", async () => {
    const adapter = new CodexAdapter({
      run: async () => ({
        finalResponse: JSON.stringify({ status: "success", summary: "measured", files_changed: [], commands: [], tests: [], evidence: [] }),
        usage: { input_tokens: 10, cached_tokens: 4, output_tokens: 6, duration_ms: 25, cost_usd: 0 },
      }),
    });

    const result = await adapter.execute(contract);
    expect(result.usage).toEqual({ input_tokens: 10, cached_tokens: 4, output_tokens: 6, duration_ms: 25, cost_usd: 0 });
    await expect(adapter.usage()).resolves.toEqual(result.usage);
  });
});
