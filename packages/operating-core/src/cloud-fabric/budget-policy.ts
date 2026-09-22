export interface BudgetPolicy {
  monthly_limit_usd: number;
  warning_percent: number;
  critical_percent: number;
  reserve_percent: number;
}

export interface BudgetSnapshot {
  spent_usd: number;
  remaining_usd: number;
  used_percent: number;
  state: 'GREEN' | 'YELLOW' | 'RED' | 'RESERVE';
}

export const DEFAULT_BUDGET_POLICY: BudgetPolicy = {
  monthly_limit_usd: 50,
  warning_percent: 50,
  critical_percent: 80,
  reserve_percent: 90,
};

export function budgetSnapshot(
  spentUsd: number,
  policy: BudgetPolicy = DEFAULT_BUDGET_POLICY,
): BudgetSnapshot {
  const limit = Math.max(policy.monthly_limit_usd, 0.01);
  const spent = Math.max(0, spentUsd);
  const used = Math.min(100, (spent / limit) * 100);
  const state =
    used >= policy.reserve_percent ? 'RESERVE' :
    used >= policy.critical_percent ? 'RED' :
    used >= policy.warning_percent ? 'YELLOW' :
    'GREEN';

  return {
    spent_usd: spent,
    remaining_usd: Math.max(0, limit - spent),
    used_percent: used,
    state,
  };
}
