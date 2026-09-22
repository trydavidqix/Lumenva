import { describe, expect, it } from "vitest";
import { resolveContext, type ContextCandidate, type TaskContract } from "./context-engine.js";

const task: TaskContract = {
  taskId: "task-context-1",
  goal: "Implement the dashboard context flow",
  scope: "apps/core",
  allowedPaths: ["apps/core/src", "packages/maestri-context-gateway/src"],
  constraints: ["never inject secrets", "preserve provenance"],
  capabilities: ["read_file", "search_code"],
  risk: "low",
  baseSha: "abc123",
  contextBudget: 120,
  toolBudget: 5,
  executionBudget: 60_000,
  preferredProvider: "codex",
  evidenceRequired: true,
};

const candidates: ContextCandidate[] = [
  { path: "packages/maestri-context-gateway/src/dashboard.mjs", symbols: ["dashboardStats"], content: "dashboard content".repeat(40), score: 0.8 },
  { path: "apps/core/src/core-runtime.ts", symbols: ["CoreRuntime", "requestContext"], content: "runtime content".repeat(40), score: 0.9 },
];

describe("progressive Context Engine", () => {
  it("includes resolved instructions before lower-priority file excerpts", () => {
    const packet = resolveContext({ task: { ...task, contextBudget: 180 }, candidates, level: 2, instructions: ["Follow the repository doctrine", "Do not expose secrets"] });

    expect(packet.relevantInstructions).toEqual(["Follow the repository doctrine", "Do not expose secrets"]);
    expect(packet.characterCount).toBeLessThanOrEqual(180);
  });

  it("starts at L0 without file content and keeps a deterministic hard cap", () => {
    const packet = resolveContext({ task, candidates, level: 0 });

    expect(packet.level).toBe(0);
    expect(packet.objective).toBe(task.goal);
    expect(packet.relevantFiles).toEqual([]);
    expect(packet.relevantSymbols).toEqual([]);
    expect(packet.contextVersion).toMatch(/^[a-f0-9]{64}$/);
    expect(packet.tokenBudget).toBe(task.contextBudget);
    expect(packet.characterCount).toBeLessThanOrEqual(task.contextBudget);
  });

  it("expands deterministically from paths/symbols to bounded excerpts", () => {
    const levelOne = resolveContext({ task, candidates, level: 1 });
    const levelTwo = resolveContext({ task, candidates, level: 2 });
    const repeated = resolveContext({ task, candidates: [...candidates].reverse(), level: 2 });

    expect(levelOne.relevantFiles.map((file) => file.path)).toEqual([
      "apps/core/src/core-runtime.ts",
      "packages/maestri-context-gateway/src/dashboard.mjs",
    ]);
    expect(levelOne.relevantFiles.every((file) => file.excerpt === undefined)).toBe(true);
    expect(levelTwo.relevantFiles.some((file) => file.excerpt)).toBe(true);
    expect(levelTwo.characterCount).toBeLessThanOrEqual(task.contextBudget);
    expect(levelTwo).toEqual(repeated);
  });
});
