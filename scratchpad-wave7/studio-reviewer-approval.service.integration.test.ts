import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { createContextPack } from "../apps/crm/lib/studio/context-pack";
import { StudioEditorStore } from "./studio-editor";
import { assertAuthorizedReviewer, registerReviewer } from "./studio-reviewer-registry";

let admin: Pool;
let tenant: Pool;
let container = "";
const org = "11111111-1111-1111-1111-111111111111";
const otherOrg = "22222222-2222-2222-2222-222222222222";

describe("Studio approval service authority", () => {
  beforeAll(async () => {
    const { execFileSync } = await import("node:child_process");
    container = execFileSync("docker", ["run", "-d", "--rm", "-e", "POSTGRES_PASSWORD=test", "-p", "0:5432", "postgres:16"], { encoding: "utf8" }).trim();
    const port = execFileSync("docker", ["port", container, "5432/tcp"], { encoding: "utf8" }).trim().split("\n")[0]!.split(":").pop();
    const url = `postgres://postgres:test@127.0.0.1:${port}/postgres`;
    for (let attempt = 0; attempt < 40; attempt += 1) { try { const probe = new Pool({ connectionString: url }); await probe.query("select 1"); await probe.end(); break; } catch { await new Promise((resolve) => setTimeout(resolve, 200)); } }
    admin = new Pool({ connectionString: url });
    await admin.query("CREATE OR REPLACE FUNCTION public.fn_user_org_ids() RETURNS SETOF uuid LANGUAGE sql STABLE AS $$ SELECT unnest(string_to_array(current_setting('app.org_ids', true), ','))::uuid $$");
    await admin.query("CREATE ROLE authenticated LOGIN PASSWORD 'authenticated' NOSUPERUSER NOBYPASSRLS");
    await admin.query("CREATE ROLE service_role NOLOGIN");
    await admin.query("GRANT USAGE ON SCHEMA public TO authenticated, service_role");
    await admin.query("GRANT EXECUTE ON FUNCTION public.fn_user_org_ids() TO authenticated");
    await admin.query(readFileSync("supabase/migrations/20260917101000_0184_studio_reviewer_authorizations.sql", "utf8"));
    await registerReviewer(admin, { organizationId: org, reviewerId: "reviewer-a", role: "owner" });
    await registerReviewer(admin, { organizationId: otherOrg, reviewerId: "reviewer-b", role: "owner" });
    tenant = new Pool({ connectionString: url.replace("postgres:test", "authenticated:authenticated") });
    await tenant.query(`SET app.org_ids = '${org}'`);
  });
  afterAll(async () => { await tenant?.end(); if (admin) { await admin.query("DROP OWNED BY authenticated"); await admin.query("DROP OWNED BY service_role"); await admin.query("DROP ROLE IF EXISTS authenticated"); await admin.query("DROP ROLE IF EXISTS service_role"); await admin.end(); } if (container) { const { execFileSync } = await import("node:child_process"); execFileSync("docker", ["rm", "-f", container]); } });

  it("approveEdit consults persistent authority and rejects unknown reviewer", async () => {
    const store = new StudioEditorStore((organizationId, reviewerId) => assertAuthorizedReviewer(tenant, organizationId, reviewerId));
    store.registerContextPack(createContextPack({ contextPackId: "ctx", organizationId: org, projectId: "project", allowedLayerIds: ["layer"], allowedSources: ["source"] }));
    store.createCanvas({ canvas_id: "canvas", organization_id: org, session_id: "session", project_id: "project", viewport: { width: 100, height: 100, unit: "PX" }, layers: [{ layer_id: "layer", asset_id: "asset", semantic_role: "headline", bounds: { x: 0, y: 0, width: 10, height: 10 }, z_index: 1, properties: {}, source_refs: ["source"], locked: false }], source_refs: ["source"], evidence_refs: [], created_by: "creator" });
    store.proposeEdit({ organizationId: org, sessionId: "session", projectId: "project", canvasId: "canvas", baseVersion: 1, contextPackId: "ctx", editId: "edit", instruction: "change", targetLayerIds: ["layer"], idempotencyKey: "idem", patch: { color: "red" } });
    const evalRun = store.runEval({ evalId: "eval", organizationId: org, sessionId: "session", canvasId: "canvas", inputVersion: 1 });
    expect(evalRun.status).toBe("PASS");
    store.attachEval("edit", "eval");
    await expect(store.approveEdit({ editId: "edit", reviewerId: "unknown" })).rejects.toThrow("reviewer_not_authorized");
    await expect(store.approveEdit({ editId: "edit", reviewerId: "reviewer-b" })).rejects.toThrow("reviewer_not_authorized");
    await expect(store.approveEdit({ editId: "edit", reviewerId: "reviewer-a" })).resolves.toMatchObject({ version: 2, created_by: "reviewer-a" });
  });
});
