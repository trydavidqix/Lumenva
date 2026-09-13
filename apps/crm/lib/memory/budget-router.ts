export interface BudgetRequest {
  taskId: string;
  tokens: number;
  cost: number;
}

export interface BudgetState {
  tokensRemaining: number;
  costRemaining: number;
}

export interface BudgetDecision {
  allowed: boolean;
  reason: "budget_exhausted" | "budget_invalid" | null;
  tokensRemaining: number;
  costRemaining: number;
}

function validNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

export function routeBudget(
  request: BudgetRequest,
  budget: BudgetState,
): BudgetDecision {
  if (
    !request.taskId.trim() ||
    !validNonNegative(request.tokens) ||
    !validNonNegative(request.cost) ||
    !validNonNegative(budget.tokensRemaining) ||
    !validNonNegative(budget.costRemaining)
  ) {
    return {
      allowed: false,
      reason: "budget_invalid",
      tokensRemaining: budget.tokensRemaining,
      costRemaining: budget.costRemaining,
    };
  }

  if (
    request.tokens > budget.tokensRemaining ||
    request.cost > budget.costRemaining
  ) {
    return {
      allowed: false,
      reason: "budget_exhausted",
      tokensRemaining: budget.tokensRemaining,
      costRemaining: budget.costRemaining,
    };
  }

  return {
    allowed: true,
    reason: null,
    tokensRemaining: budget.tokensRemaining - request.tokens,
    costRemaining: budget.costRemaining - request.cost,
  };
}
