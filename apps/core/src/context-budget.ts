export type BudgetDimension =
  | "inputTokens"
  | "outputTokens"
  | "cachedTokens"
  | "contextPercent"
  | "toolDefinitions"
  | "toolCalls"
  | "executionMs"
  | "monetaryCost"
  | "providerQuota";

export type BudgetUsage = Record<BudgetDimension, number>;
export type BudgetLimits = Record<BudgetDimension, number>;

export type BudgetResult = {
  status: "within" | "exceeded";
  remaining: BudgetUsage;
  violations: Array<{ dimension: BudgetDimension; overBy: number }>;
};

const DIMENSIONS: BudgetDimension[] = [
  "inputTokens",
  "outputTokens",
  "cachedTokens",
  "contextPercent",
  "toolDefinitions",
  "toolCalls",
  "executionMs",
  "monetaryCost",
  "providerQuota",
];

export function evaluateBudget(usage: BudgetUsage, limits: BudgetLimits): BudgetResult {
  const remaining = {} as BudgetUsage;
  const violations: BudgetResult["violations"] = [];

  for (const dimension of DIMENSIONS) {
    const current = finiteNonNegative(usage[dimension]);
    const limit = finiteNonNegative(limits[dimension]);
    remaining[dimension] = round(Math.max(0, limit - current));
    if (current > limit) {
      violations.push({ dimension, overBy: round(current - limit) });
    }
  }

  return {
    status: violations.length ? "exceeded" : "within",
    remaining,
    violations,
  };
}

function finiteNonNegative(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

function round(value: number): number {
  return Number(value.toFixed(10));
}
