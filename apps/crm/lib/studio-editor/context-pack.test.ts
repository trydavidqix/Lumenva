import { describe, expect, it } from "vitest";
import { validateContextPackEdit, type ContextPack } from "./context-pack";

const pack: ContextPack = {
  context_pack_id: "ctx-1",
  organization_id: "org-1",
  project_id: "project-1",
  purpose: "EDIT",
  project_spec_version: "1",
  allowed_assets: ["asset-a"],
  allowed_sources: ["source-a"],
  constraints: ["no claims"],
  authority_envelope_ref: "auth-1",
  budget: { max_tokens: 1000, max_assets: 1, max_latency_ms: 5000 },
  provenance_refs: ["source-a"],
  redacted: true,
};

describe("Wave 7 ContextPack authority scope", () => {
  it("permite edição dentro do escopo autorizado", () => {
    expect(
      validateContextPackEdit(pack, {
        organization_id: "org-1",
        project_id: "project-1",
        asset_ids: ["asset-a"],
        source_refs: ["source-a"],
      }),
    ).toEqual({ allowed: true });
  });

  it("rejeita edição fora do authority scope", () => {
    expect(
      validateContextPackEdit(pack, {
        organization_id: "org-1",
        project_id: "project-1",
        asset_ids: ["asset-forbidden"],
        source_refs: ["source-a"],
      }),
    ).toEqual({ allowed: false, reason: "ASSET_OUT_OF_SCOPE" });
    expect(
      validateContextPackEdit(pack, {
        organization_id: "org-1",
        project_id: "project-2",
        asset_ids: ["asset-a"],
        source_refs: ["source-a"],
      }),
    ).toEqual({ allowed: false, reason: "PROJECT_MISMATCH" });
  });
});
