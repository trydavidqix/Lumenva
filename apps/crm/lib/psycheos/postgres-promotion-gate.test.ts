import { describe, expect, it } from "vitest";
import { Pool } from "pg";
import { createPostgresEvalStore } from "./postgres-promotion-gate";

describe("Postgres eval evidence store", () => {
  it("persists across pool restart, isolates tenants and is idempotent", async () => {
    const url = process.env.PSY_PROMOTION_DATABASE_URL;
    if (!url) return;
    const admin = new Pool({ connectionString: url });
    const store = createPostgresEvalStore(admin, "org-a");
    await store.initialize();
    await admin.query("CREATE ROLE eval_app LOGIN PASSWORD 'eval-app' NOSUPERUSER NOBYPASSRLS");
    await admin.query("GRANT USAGE ON SCHEMA public TO eval_app; GRANT SELECT, INSERT ON psyche_eval_results TO eval_app");
    const app = new Pool({ connectionString: url.replace("postgres:postgres@", "eval_app:eval-app@") });
    const client = await app.connect();
    await client.query("SET app.org_ids = 'org-a'");
    const tenantStore = createPostgresEvalStore(client, "org-a");
    const result = { runId: "run-1", caseId: "boundary", status: "PASS" as const, evidenceRef: "sha256:boundary" };
    expect(await tenantStore.record(result)).toBe(true);
    expect(await tenantStore.record(result)).toBe(false);
    client.release(); await app.end(); await admin.end();
    const reopened = new Pool({ connectionString: url.replace("postgres:postgres@", "eval_app:eval-app@") });
    const reopenedClient = await reopened.connect(); await reopenedClient.query("SET app.org_ids = 'org-a'");
    expect(await createPostgresEvalStore(reopenedClient, "org-a").list("run-1")).toEqual([{ caseId: result.caseId, status: result.status, evidenceRef: result.evidenceRef }]);
    await reopenedClient.query("SET app.org_ids = 'org-b'");
    expect(await createPostgresEvalStore(reopenedClient, "org-b").list("run-1")).toEqual([]);
    await expect(reopenedClient.query("DELETE FROM psyche_eval_results WHERE organization_id='org-a'")).rejects.toThrow(/append-only/i);
    reopenedClient.release(); await reopened.end();
  });
});
