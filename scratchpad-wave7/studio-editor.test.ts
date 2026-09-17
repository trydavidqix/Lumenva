import { describe, expect, it } from "vitest";
import { createContextPack } from "../apps/crm/lib/studio/context-pack";
import { StudioEditorStore, type LayerRef } from "./studio-editor";

const layer: LayerRef = {
  layer_id: "layer-1",
  asset_id: "asset-1",
  semantic_role: "headline",
  bounds: { x: 0, y: 0, width: 100, height: 20 },
  z_index: 1,
  properties: { color: "black" },
  source_refs: ["source-1"],
  locked: false,
};

function setup() {
  const store = new StudioEditorStore(async () => undefined);
  const pack = createContextPack({
    contextPackId: "ctx-1",
    organizationId: "org-1",
    projectId: "project-1",
    purpose: "EDIT",
    projectSpecVersion: "1",
    allowedLayerIds: ["layer-1"],
    allowedAssets: ["asset-1"],
    allowedSources: ["source-1"],
  });
  store.registerContextPack(pack);
  store.createCanvas({
    canvas_id: "canvas-1",
    organization_id: "org-1",
    session_id: "session-1",
    project_id: "project-1",
    viewport: { width: 800, height: 600, unit: "PX" },
    layers: [layer],
    source_refs: ["source-1"],
    evidence_refs: [],
    created_by: "actor-1",
  });
  return store;
}

describe("Studio Editor provider-free state", () => {
  it("keeps canvases isolated by tenant and session", () => {
    const store = setup();
    expect(() => store.getCanvas("org-2", "session-1", "canvas-1")).toThrow("canvas_not_found");
    expect(() => store.getCanvas("org-1", "session-2", "canvas-1")).toThrow("canvas_not_found");
    expect(store.getCanvas("org-1", "session-1", "canvas-1").version).toBe(1);
  });

  it("creates an idempotent pending edit and rejects stale bases", () => {
    const store = setup();
    const input = {
      organizationId: "org-1",
      sessionId: "session-1",
      projectId: "project-1",
      canvasId: "canvas-1",
      baseVersion: 1,
      contextPackId: "ctx-1",
      editId: "edit-1",
      instruction: "Adjust spacing",
      targetLayerIds: ["layer-1"],
      idempotencyKey: "idem-1",
      patch: { margin: 8 },
    };
    const first = store.proposeEdit(input);
    expect(first.status).toBe("PENDING_REVIEW");
    expect(store.proposeEdit({ ...input, editId: "different-id" })).toEqual(first);
    expect(() => store.proposeEdit({ ...input, idempotencyKey: "idem-2", baseVersion: 0 })).toThrow("stale_version");
  });

  it("requires a passing eval before approval and applies a new version", async () => {
    const store = setup();
    store.proposeEdit({
      organizationId: "org-1", sessionId: "session-1", projectId: "project-1", canvasId: "canvas-1",
      baseVersion: 1, contextPackId: "ctx-1", editId: "edit-1", instruction: "Adjust spacing",
      targetLayerIds: ["layer-1"], idempotencyKey: "idem-1", patch: { margin: 8 },
    });
    await expect(store.approveEdit({ editId: "edit-1", reviewerId: "owner-1" })).rejects.toThrow("edit_eval_required");
    const evalRun = store.runEval({ evalId: "eval-1", organizationId: "org-1", sessionId: "session-1", canvasId: "canvas-1", inputVersion: 1 });
    expect(evalRun.status).toBe("PASS");
    store.attachEval("edit-1", "eval-1");
    const applied = await store.approveEdit({ editId: "edit-1", reviewerId: "owner-1" });
    expect(applied.version).toBe(2);
    expect(applied.parent_version).toBe(1);
    expect(applied.layers[0].properties).toMatchObject({ color: "black", margin: 8 });
  });

  it("rejects cross-tenant eval attachment, locked layers, and unauthorized variants", () => {
    const store = setup();
    expect(() => store.proposeEdit({
      organizationId: "org-1", sessionId: "session-1", projectId: "project-1", canvasId: "canvas-1",
      baseVersion: 1, contextPackId: "ctx-1", editId: "edit-1", instruction: "x",
      targetLayerIds: ["forbidden"], idempotencyKey: "idem-1",
    })).toThrow("TARGET_OUTSIDE_AUTHORITY_SCOPE");
    expect(() => store.attachEval("edit-1", "eval-from-other-tenant")).toThrow("eval_not_found");
    expect(() => store.mixVariants({
      mix_id: "mix-1", organization_id: "org-1", session_id: "session-1", project_id: "project-1",
      input_variant_ids: ["a", "b"], output_canvas_id: "canvas-1", mix_rules: [], context_pack_id: "ctx-1",
      source_refs: [], evidence_refs: [],
    })).toThrow("variant_context_invalid");
  });

  it("only mixes two or more explicitly authorized variants", () => {
    const store = setup();
    const pack = createContextPack({ contextPackId: "mix-ctx", organizationId: "org-1", projectId: "project-1", purpose: "MIX_VARIANT", projectSpecVersion: "1", allowedLayerIds: ["layer-1"], allowedVariantIds: ["variant-a", "variant-b"] });
    store.registerContextPack(pack);
    expect(() => store.mixVariants({
      mix_id: "mix-1", organization_id: "org-1", session_id: "session-1", project_id: "project-1",
      input_variant_ids: ["only-one"], output_canvas_id: "canvas-1", mix_rules: [], context_pack_id: "mix-ctx",
      source_refs: [], evidence_refs: [],
    })).toThrow("variant_inputs_required");
    expect(() => store.mixVariants({
      mix_id: "mix-forbidden", organization_id: "org-1", session_id: "session-1", project_id: "project-1",
      input_variant_ids: ["variant-a", "variant-c"], output_canvas_id: "canvas-2", mix_rules: [], context_pack_id: "mix-ctx",
      source_refs: [], evidence_refs: [],
    })).toThrow("variant_outside_authority_scope");
    expect(store.mixVariants({
      mix_id: "mix-1", organization_id: "org-1", session_id: "session-1", project_id: "project-1",
      input_variant_ids: ["variant-a", "variant-b"], output_canvas_id: "canvas-2", mix_rules: ["prefer headline"], context_pack_id: "mix-ctx",
      source_refs: ["source-1"], evidence_refs: [],
    }).status).toBe("DRAFT");
  });
});
