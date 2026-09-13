import { describe, expect, it } from "vitest";
import { applyEditWithLock, recordEditorEval, recordVariantMix, upsertEditProposal } from "./studio-editor-repository";
import type { AIEditProposal, CanvasDocument, EditorEvalRun, VariantMix } from "./studio-editor";

function fakeDb() {
  const calls: Array<{ text: string; values?: unknown[] }> = [];
  return {
    calls,
    async query<T = Record<string, unknown>>(text: string, values?: unknown[]) {
      calls.push({ text, values });
      if (text.includes("select * from public.studio_canvas_documents")) {
        return { rows: [{ version: 1 }], rowCount: 1 } as never as { rows: T[]; rowCount: number };
      }
      if (text.includes("returning *")) return { rows: [{ edit_id: "edit-1" }], rowCount: 1 } as never as { rows: T[]; rowCount: number };
      return { rows: [], rowCount: 0 } as never as { rows: T[]; rowCount: number };
    },
  };
}

const proposal: AIEditProposal = {
  edit_id: "edit-1", organization_id: "org-1", session_id: "session-1", project_id: "project-1", canvas_id: "canvas-1",
  base_version: 1, context_pack_id: "ctx-1", instruction: "change", target_layer_ids: ["layer-1"], patch: { color: "red" },
  permission_level: "P1", risk_level: "R1", idempotency_key: "idem-1", status: "PENDING_REVIEW", eval_refs: [],
};

const nextCanvas: CanvasDocument = {
  canvas_id: "canvas-1", organization_id: "org-1", session_id: "session-1", project_id: "project-1", version: 2, parent_version: 1,
  viewport: { width: 800, height: 600, unit: "PX" }, layers: [], editor_state: "IN_REVIEW", source_refs: ["source-1"], evidence_refs: [], created_by: "reviewer-1", created_at: "2026-09-13T00:00:00.000Z",
};

describe("Studio Editor Postgres repository boundary", () => {
  it("uses tenant+session idempotent upsert for proposals", async () => {
    const db = fakeDb();
    await expect(upsertEditProposal(db, proposal)).resolves.toMatchObject({ edit_id: "edit-1" });
    expect(db.calls[0].text).toContain("on conflict (organization_id, session_id, idempotency_key)");
  });

  it("locks the latest tenant/session canvas before applying a new version", async () => {
    const db = fakeDb();
    await applyEditWithLock(db, proposal, nextCanvas);
    expect(db.calls.map((call) => call.text)).toEqual(expect.arrayContaining([
      "begin",
      expect.stringContaining("for update"),
      expect.stringContaining("insert into public.studio_canvas_documents"),
      "commit",
    ]));
    expect(db.calls.find((call) => call.text.includes("for update"))?.values).toEqual(["org-1", "session-1", "canvas-1"]);
  });

  it("rolls back on stale version instead of writing a second branch", async () => {
    const db = fakeDb();
    await expect(applyEditWithLock(db, { ...proposal, base_version: 7 }, nextCanvas)).rejects.toThrow("stale_version");
    expect(db.calls.at(-1)?.text).toBe("rollback");
  });

  it("upserts eval and variant records with tenant/session keys", async () => {
    const db = fakeDb();
    const evaluation: EditorEvalRun = { eval_id: "eval-1", organization_id: "org-1", session_id: "session-1", canvas_id: "canvas-1", input_version: 1, eval_version: "v1", checks: [], metrics: {}, status: "PASS", evidence_refs: [] };
    const mix: VariantMix = { mix_id: "mix-1", organization_id: "org-1", session_id: "session-1", project_id: "project-1", input_variant_ids: ["a", "b"], output_canvas_id: "canvas-2", mix_rules: [], context_pack_id: "ctx-1", status: "DRAFT", source_refs: [], evidence_refs: [] };
    await recordEditorEval(db, evaluation);
    await recordVariantMix(db, mix);
    expect(db.calls[0].text).toContain("on conflict (organization_id, session_id, eval_id)");
    expect(db.calls[1].text).toContain("on conflict (organization_id, session_id, mix_id)");
  });
});
