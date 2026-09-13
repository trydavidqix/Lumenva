import { describe, expect, it } from "vitest";

import { routeBudget, type BudgetRequest, type BudgetState } from "./budget-router";

const request: BudgetRequest = { taskId: "task-1", tokens: 100, cost: 0.05 };
const budget: BudgetState = { tokensRemaining: 500, costRemaining: 1 };

describe("Budget Router mínimo", () => {
  it("permite tarefa quando tokens e custo cabem no orçamento", () => {
    expect(routeBudget(request, budget)).toEqual({
      allowed: true,
      reason: null,
      tokensRemaining: 400,
      costRemaining: 0.95,
    });
  });

  it("falha fechado quando tokens ou custo estão esgotados", () => {
    expect(routeBudget(request, { tokensRemaining: 99, costRemaining: 1 })).toEqual({
      allowed: false,
      reason: "budget_exhausted",
      tokensRemaining: 99,
      costRemaining: 1,
    });
    expect(routeBudget(request, { tokensRemaining: 500, costRemaining: 0.04 })).toMatchObject({
      allowed: false,
      reason: "budget_exhausted",
    });
  });

  it("falha fechado para valores inválidos ou negativos", () => {
    expect(routeBudget({ ...request, tokens: Number.NaN }, budget).allowed).toBe(false);
    expect(routeBudget({ ...request, cost: -1 }, budget).reason).toBe("budget_invalid");
    expect(routeBudget(request, { tokensRemaining: Number.POSITIVE_INFINITY, costRemaining: 1 }).reason).toBe("budget_invalid");
  });
});
