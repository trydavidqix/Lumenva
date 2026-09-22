import { describe, expect, it } from "vitest";
import { evaluateBudget, type BudgetLimits, type BudgetUsage } from "./context-budget.js";

const limits: BudgetLimits = {
  inputTokens: 1_000,
  outputTokens: 500,
  cachedTokens: 2_000,
  contextPercent: 80,
  toolDefinitions: 8,
  toolCalls: 20,
  executionMs: 60_000,
  monetaryCost: 0.25,
  providerQuota: 10_000,
};

const usage: BudgetUsage = {
  inputTokens: 900,
  outputTokens: 400,
  cachedTokens: 1_500,
  contextPercent: 72,
  toolDefinitions: 4,
  toolCalls: 10,
  executionMs: 30_000,
  monetaryCost: 0.12,
  providerQuota: 4_000,
};

describe("Context Budget Engine", () => {
  it("returns deterministic remaining budget across every dimension", () => {
    const result = evaluateBudget(usage, limits);

    expect(result.status).toBe("within");
    expect(result.violations).toEqual([]);
    expect(result.remaining).toEqual({
      inputTokens: 100,
      outputTokens: 100,
      cachedTokens: 500,
      contextPercent: 8,
      toolDefinitions: 4,
      toolCalls: 10,
      executionMs: 30_000,
      monetaryCost: 0.13,
      providerQuota: 6_000,
    });
  });

  it("fails closed and reports all exceeded dimensions in stable order", () => {
    const result = evaluateBudget({ ...usage, inputTokens: 1_500, contextPercent: 95, toolCalls: 25, monetaryCost: 0.4 }, limits);

    expect(result.status).toBe("exceeded");
    expect(result.violations).toEqual([
      { dimension: "inputTokens", overBy: 500 },
      { dimension: "contextPercent", overBy: 15 },
      { dimension: "toolCalls", overBy: 5 },
      { dimension: "monetaryCost", overBy: 0.15 },
    ]);
  });
});
