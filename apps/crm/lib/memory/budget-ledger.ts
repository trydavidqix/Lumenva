export interface BudgetLedgerRow {
  tenant_id: string;
  budget_id: string;
  consumed: string;
  limit: string;
}

export interface BudgetDebit {
  tenantId: string;
  budgetId: string;
  amount: number;
  limit: number;
}

export interface Queryable {
  query<T extends BudgetLedgerRow = BudgetLedgerRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ rows: T[] }>;
}

export async function ensureBudgetLedger(client: Queryable): Promise<void> {
  await client.query(
    `CREATE TABLE IF NOT EXISTS budget_ledger (
      tenant_id text NOT NULL,
      budget_id text NOT NULL,
      consumed numeric NOT NULL DEFAULT 0,
      "limit" numeric NOT NULL,
      PRIMARY KEY (tenant_id, budget_id),
      CHECK (consumed >= 0),
      CHECK ("limit" >= 0)
    )`,
  );
}

export async function debitBudget(
  client: Queryable,
  debit: BudgetDebit,
): Promise<BudgetLedgerRow | null> {
  if (
    !debit.tenantId.trim() ||
    !debit.budgetId.trim() ||
    !Number.isFinite(debit.amount) ||
    !Number.isFinite(debit.limit) ||
    debit.amount < 0 ||
    debit.limit < 0
  ) {
    throw new Error("budget_debit_invalid");
  }

  const result = await client.query<BudgetLedgerRow>(
    `INSERT INTO budget_ledger (tenant_id, budget_id, consumed, "limit")
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (tenant_id, budget_id) DO UPDATE
       SET consumed = budget_ledger.consumed + EXCLUDED.consumed
       WHERE budget_ledger.consumed + EXCLUDED.consumed <= budget_ledger."limit"
     RETURNING tenant_id, budget_id, consumed::text, "limit"::text AS limit`,
    [debit.tenantId, debit.budgetId, debit.amount, debit.limit],
  );

  return result.rows[0] ?? null;
}
