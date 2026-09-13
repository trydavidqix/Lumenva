import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { applyEditWithLock } from "./studio-editor-repository";
import type { AIEditProposal, CanvasDocument } from "./studio-editor";

let admin: Pool;
let container = "";
const proposal: AIEditProposal = {
  edit_id: "edit-concurrent", organization_id: "org-studio", session_id: "session-1", project_id: "project-1", canvas_id: "canvas-1",
  base_version: 1, context_pack_id: "ctx-1", instruction: "change", target_layer_ids: ["layer-1"], patch: { color: "red" },
  permission_level: "P1", risk_level: "R1", idempotency_key: "idem-concurrent", status: "PENDING_REVIEW", eval_refs: [],
};
const next: CanvasDocument = {
  canvas_id: "canvas-1", organization_id: "org-studio", session_id: "session-1", project_id: "project-1", version: 2, parent_version: 1,
  viewport: { width: 800, height: 600, unit: "PX" }, layers: [], editor_state: "IN_REVIEW", source_refs: ["source-1"], evidence_refs: [], created_by: "reviewer", created_at: "2026-09-13T00:00:00.000Z",
};

describe("Studio Editor concurrent persistence", () => {
  beforeAll(async () => {
    const { execFileSync } = await import("node:child_process");
    container = execFileSync("docker", ["run", "-d", "--rm", "-e", "POSTGRES_PASSWORD=postgres", "-p", "0:5432", "postgres:16"], { encoding: "utf8" }).trim();
    const port = execFileSync("docker", ["port", container, "5432/tcp"], { encoding: "utf8" }).trim().split("\n")[0]!.split(":").pop();
    const url = `postgres://postgres:postgres@127.0.0.1:${port}/postgres`;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try { const probe = new Pool({ connectionString: url }); await probe.query("select 1"); await probe.end(); break; } catch { await new Promise((resolve) => setTimeout(resolve, 200)); }
    }
    admin = new Pool({ connectionString: url });
    await admin.query("CREATE TABLE studio_canvas_documents (organization_id text, session_id text, canvas_id text, project_id text, version integer, parent_version integer, viewport jsonb, layers jsonb, selected_variant_id text, editor_state text, source_refs jsonb, evidence_refs jsonb, created_by text, created_at timestamptz, PRIMARY KEY (organization_id, session_id, canvas_id, version))");
    await admin.query("CREATE TABLE studio_edit_proposals (organization_id text, session_id text, edit_id text, approved_by text, approved_at timestamptz, status text, PRIMARY KEY (organization_id, session_id, edit_id))");
    await admin.query("INSERT INTO studio_canvas_documents (organization_id, session_id, canvas_id, project_id, version, viewport, layers, editor_state, source_refs, evidence_refs, created_by, created_at) VALUES ($1,$2,$3,$4,1,$5,$6,'DRAFT',$7,$8,$9,$10)", [next.organization_id, next.session_id, next.canvas_id, next.project_id, JSON.stringify(next.viewport), JSON.stringify([]), JSON.stringify(next.source_refs), JSON.stringify(next.evidence_refs), "creator", next.created_at]);
    await admin.query("INSERT INTO studio_edit_proposals (organization_id, session_id, edit_id, status) VALUES ($1,$2,$3,'PENDING_REVIEW')", [proposal.organization_id, proposal.session_id, proposal.edit_id]);
  }, 30_000);

  afterAll(async () => { await admin?.end(); if (container) { const { execFileSync } = await import("node:child_process"); execFileSync("docker", ["rm", "-f", container]); } });

  it("allows one concurrent apply and rejects the competing stale version", async () => {
    const connectionString = (admin as unknown as { options: { connectionString: string } }).options.connectionString;
    const dbA = new Pool({ connectionString });
    const dbB = new Pool({ connectionString });
    try {
      const results = await Promise.allSettled([
        applyEditWithLock(dbA, proposal, next),
        applyEditWithLock(dbB, proposal, next),
      ]);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((result) => result.status === "rejected" && result.reason?.message === "stale_version")).toHaveLength(1);
      const rows = await admin.query("SELECT version FROM studio_canvas_documents WHERE organization_id=$1 AND session_id=$2 AND canvas_id=$3 ORDER BY version", [proposal.organization_id, proposal.session_id, proposal.canvas_id]);
      expect(rows.rows.map((row) => row.version)).toEqual([1, 2]);
    } finally {
      await dbA.end(); await dbB.end();
    }
  }, 30_000);
});
