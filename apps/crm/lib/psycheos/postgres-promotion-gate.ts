import { evaluatePromotionGate, type EvalCaseResult, type PromotionGateResult } from "./promotion-gate";

type Queryable = { query<T = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<{ rows: T[] }> };

const SCHEMA = `
CREATE TABLE IF NOT EXISTS psyche_eval_results (
  organization_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  case_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PASS','FAIL')),
  evidence_ref TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, run_id, case_id)
);
ALTER TABLE psyche_eval_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE psyche_eval_results FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS psyche_eval_results_tenant ON psyche_eval_results;
CREATE POLICY psyche_eval_results_tenant ON psyche_eval_results
  USING (organization_id = ANY(regexp_split_to_array(current_setting('app.org_ids', true), ',')::text[]))
  WITH CHECK (organization_id = ANY(regexp_split_to_array(current_setting('app.org_ids', true), ',')::text[]));
CREATE OR REPLACE FUNCTION psyche_eval_results_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'append-only eval results: UPDATE/DELETE denied'; END;
$$;
DROP TRIGGER IF EXISTS psyche_eval_results_append_only_trigger ON psyche_eval_results;
CREATE TRIGGER psyche_eval_results_append_only_trigger BEFORE UPDATE OR DELETE ON psyche_eval_results
FOR EACH ROW EXECUTE FUNCTION psyche_eval_results_append_only();`;

export function createPostgresEvalStore(db: Queryable, organizationId: string) {
  if (!organizationId.trim()) throw new Error("eval_store_tenant_invalid");
  return {
    async initialize(): Promise<void> { await db.query(SCHEMA); },
    async record(result: EvalCaseResult & { runId: string }): Promise<boolean> {
      if (!result.runId.trim() || !result.caseId.trim() || !result.evidenceRef.trim()) throw new Error("eval_result_invalid");
      const inserted = await db.query(`INSERT INTO psyche_eval_results (organization_id,run_id,case_id,status,evidence_ref) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (organization_id,run_id,case_id) DO NOTHING RETURNING case_id`, [organizationId, result.runId, result.caseId, result.status, result.evidenceRef]);
      return inserted.rows.length === 1;
    },
    async list(runId: string): Promise<EvalCaseResult[]> {
      const rows = await db.query<{ case_id: string; status: "PASS" | "FAIL"; evidence_ref: string }>(`SELECT case_id,status,evidence_ref FROM psyche_eval_results WHERE organization_id=$1 AND run_id=$2 ORDER BY case_id`, [organizationId, runId]);
      return rows.rows.map((row) => ({ caseId: row.case_id, status: row.status, evidenceRef: row.evidence_ref }));
    },
    async gate(runId: string): Promise<PromotionGateResult> { return evaluatePromotionGate(await this.list(runId)); },
  };
}
