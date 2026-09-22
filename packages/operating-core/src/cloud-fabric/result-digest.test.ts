import { describe, expect, it } from "vitest";
import { createResultDigest } from "./result-digest.js";
import type { ExecutionResult } from "./execution-port.js";

const result: ExecutionResult = {
  task_id: "task-1",
  status: "success",
  summary: "authentication inspected",
  files_changed: ["src/auth.ts"],
  commands: ["pnpm test"],
  tests: [{ passed: true, report: "4 passed" }],
  evidence: ["commit:abc123"],
  usage: { input_tokens: 10, cached_tokens: 3, output_tokens: 4, duration_ms: 50, cost_usd: 0.01 },
};

describe("ResultDigest", () => {
  it("keeps decision-relevant evidence without copying logs or session context", () => {
    const digest = createResultDigest(result, {
      important_decisions: ["reused existing middleware"],
      risk: "low",
    });

    expect(digest).toMatchObject({
      task_id: "task-1",
      status: "success",
      changed: ["src/auth.ts"],
      tests: [{ passed: true, report: "4 passed" }],
      important_decisions: ["reused existing middleware"],
      risk: "low",
      evidence: ["commit:abc123"],
      usage: result.usage,
    });
    expect(digest).not.toHaveProperty("commands");
    expect(digest).not.toHaveProperty("session");
  });
});
