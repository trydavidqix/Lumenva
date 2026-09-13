import { describe, expect, it } from "vitest";
import {
  createContextPack,
  proposeAIEdit,
  validateAIEditRequest,
  type AIEditRequest,
} from "./context-pack";

const pack = createContextPack({
  contextPackId: "ctx-1",
  organizationId: "org-1",
  projectId: "project-1",
  projectSpecVersion: "1",
  allowedLayerIds: ["layer-allowed"],
  allowedAssets: ["asset-1"],
  allowedSources: ["source-1"],
});

const request = (overrides: Partial<AIEditRequest> = {}): AIEditRequest => ({
  edit_id: "edit-1",
  organization_id: "org-1",
  project_id: "project-1",
  canvas_id: "canvas-1",
  base_version: 1,
  context_pack_id: "ctx-1",
  instruction: "Adjust spacing",
  target_layer_ids: ["layer-allowed"],
  permission_level: "P1",
  risk_level: "R1",
  idempotency_key: "idem-1",
  status: "REQUESTED",
  eval_refs: [],
  ...overrides,
});

describe("ContextPack authority scope", () => {
  it("allows an edit targeting an explicitly authorized layer", () => {
    expect(validateAIEditRequest(pack, request())).toEqual({ allowed: true });
  });

  it("rejects an edit targeting a layer outside the authority scope", () => {
    expect(validateAIEditRequest(pack, request({ target_layer_ids: ["layer-forbidden"] }))).toEqual({
      allowed: false,
      reason: "TARGET_OUTSIDE_AUTHORITY_SCOPE",
    });
  });

  it("rejects cross-tenant and cross-project edits", () => {
    expect(validateAIEditRequest(pack, request({ organization_id: "org-2" }))).toEqual({
      allowed: false,
      reason: "TENANT_SCOPE_MISMATCH",
    });
    expect(validateAIEditRequest(pack, request({ project_id: "project-2" }))).toEqual({
      allowed: false,
      reason: "PROJECT_SCOPE_MISMATCH",
    });
  });

  it("returns an edit proposal pending review without applying it", () => {
    expect(
      proposeAIEdit(pack, "Adjust spacing without changing copy", {
        editId: "edit-2",
        canvasId: "canvas-1",
        baseVersion: 3,
        targetLayerIds: ["layer-allowed"],
        idempotencyKey: "idem-2",
      }),
    ).toEqual({
      edit_id: "edit-2",
      organization_id: "org-1",
      project_id: "project-1",
      canvas_id: "canvas-1",
      base_version: 3,
      context_pack_id: "ctx-1",
      instruction: "Adjust spacing without changing copy",
      target_layer_ids: ["layer-allowed"],
      operation: "UPDATE_LAYER",
      permission_level: "P1",
      risk_level: "R1",
      idempotency_key: "idem-2",
      authority_envelope_ref: "context-pack:ctx-1",
      status: "PENDING_REVIEW",
      eval_refs: [],
    });
    expect(pack.allowed_layer_ids).toEqual(["layer-allowed"]);
  });

  it("rejects an invalid context pack or unauthorized target before proposing", () => {
    expect(() =>
      proposeAIEdit({ ...pack, redacted: false }, "Adjust spacing", {
        editId: "edit-3",
        canvasId: "canvas-1",
        baseVersion: 1,
        targetLayerIds: ["layer-allowed"],
        idempotencyKey: "idem-3",
      }),
    ).toThrow("context_pack_invalid");

    expect(() =>
      proposeAIEdit(pack, "Adjust spacing", {
        editId: "edit-4",
        canvasId: "canvas-1",
        baseVersion: 1,
        targetLayerIds: ["layer-forbidden"],
        idempotencyKey: "idem-4",
      }),
    ).toThrow("TARGET_OUTSIDE_AUTHORITY_SCOPE");
  });
});
