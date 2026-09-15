import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "../apps/crm/node_modules/pg";
import { recordEditorEval, recordVariantMix } from "./studio-editor-repository";
import type { EditorEvalRun, VariantMix } from "./studio-editor";

let pool: Pool;
let container = "";
const evaluation: EditorEvalRun = {
  eval_id: "eval-1", organization_id: "org-a", session_id: "session-1", canvas_id: "canvas-1",
  input_version: 1, eval_version: "studio-v1", checks: ["provenance_complete"], metrics: { score: 1 }, status: "PASS", evidence_refs: ["evidence-1"],
};
const mix: VariantMix = {
  mix_id: "mix-1", organization_id: "org-a", session_id: "session-1", project_id: "project-1",
  input_variant_ids: ["variant-a", "variant-b"], output_canvas_id: "canvas-2", mix_rules: ["prefer headline"], context_pack_id: "ctx-1", status: "DRAFT", source_refs: ["source-1"], evidence_refs: ["evidence-1"],
};

describe("Studio Editor eval and variant persistence", () => {
  beforeAll(async () => {
    const { execFileSync } = await import("node:child_process");
    container = execFileSync("docker", ["run", "-d", "--rm", "-e", "POSTGRES_PASSWORD=postgres", "-p", "0:5432", "postgres:16"], { encoding: "utf8" }).trim();
    const port = execFileSync("docker", ["port", container, "5432/tcp"], { encoding: "utf8" }).trim().split("\n")[0]!.split(":").pop();
    const url = `postgres://postgres:postgres@127.0.0.1:${port}/postgres`;
    for (let attempt = 0; attempt < 40; attempt += 1) { try { const probe = new Pool({ connectionString: url }); await probe.query("select 1"); await probe.end(); break; } catch { await new Promise((resolve) => setTimeout(resolve, 200)); } }
    pool = new Pool({ connectionString: url });
    await pool.query("CREATE TABLE studio_editor_evals (organization_id text, session_id text, eval_id text, canvas_id text, input_version integer, eval_version text, checks jsonb, metrics jsonb, status text, evidence_refs jsonb, PRIMARY KEY (organization_id, session_id, eval_id))");
    await pool.query("CREATE TABLE studio_variant_mixes (organization_id text, session_id text, mix_id text, project_id text, input_variant_ids jsonb, output_canvas_id text, mix_rules jsonb, context_pack_id text, status text, source_refs jsonb, evidence_refs jsonb, PRIMARY KEY (organization_id, session_id, mix_id))");
  }, 30_000);
  afterAll(async () => { await pool?.end(); if (container) { const { execFileSync } = await import("node:child_process"); execFileSync("docker", ["rm", "-f", container]); } });

  it("persists evals and variant mixes idempotently across concurrent writers", async () => {
    await Promise.all([recordEditorEval(pool, evaluation), recordEditorEval(pool, { ...evaluation, status: "PASS" })]);
    await Promise.all([recordVariantMix(pool, mix), recordVariantMix(pool, { ...mix, status: "APPLIED" })]);
    const evalRows = await pool.query("SELECT organization_id, session_id, eval_id, status FROM studio_editor_evals");
    const mixRows = await pool.query("SELECT organization_id, session_id, mix_id, status FROM studio_variant_mixes");
    expect(evalRows.rows).toHaveLength(1);
    expect(mixRows.rows).toHaveLength(1);
    expect(evalRows.rows[0]).toMatchObject({ organization_id: "org-a", session_id: "session-1", eval_id: "eval-1" });
    expect(mixRows.rows[0]).toMatchObject({ organization_id: "org-a", session_id: "session-1", mix_id: "mix-1" });
  }, 30_000);
});
