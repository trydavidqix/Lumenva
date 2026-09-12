import { describe, expect, it } from "vitest";
import { proposeAIEdit, type ContextPack } from "./ai-edit";

const contextPack: ContextPack = {
  context_pack_id: "context-1",
  organization_id: "org-1",
  project_id: "project-1",
  purpose: "EDIT",
  project_spec_version: "spec-1",
  allowed_assets: ["asset-1"],
  allowed_sources: ["source-1"],
  constraints: ["keep-brand-colors"],
  authority_envelope_ref: "authority-1",
  budget: { max_tokens: 1000, max_assets: 2, max_latency_ms: 5000 },
  provenance_refs: ["provenance-1"],
  redacted: true,
};

describe("AI Edits", () => {
  it("cria proposta PENDING_REVIEW sem aplicar a edição", () => {
    const originalContextPack = structuredClone(contextPack);
    const proposal = proposeAIEdit(contextPack, "Aumentar o título e manter o contraste");

    expect(proposal).toMatchObject({
      context_pack_id: "context-1",
      organization_id: "org-1",
      project_id: "project-1",
      instruction: "Aumentar o título e manter o contraste",
      status: "PENDING_REVIEW",
      applied: false,
    });
    expect(proposal.target_layer_ids).toEqual([]);
    expect(contextPack).toEqual(originalContextPack);
  });

  it("rejeita Context Pack inválido ou instrução vazia", () => {
    expect(() => proposeAIEdit({ ...contextPack, purpose: "REVIEW" }, "Editar"))
      .toThrow(/purpose/);
    expect(() => proposeAIEdit(contextPack, "   "))
      .toThrow(/instruction/);
  });
});
