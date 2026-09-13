import { describe, expect, it } from "vitest";
import { createLayerManifest } from "./layer-manifest";
import { approveLayerReuse, approveLayerReuseFromStore, LayerReuseAuthorizationError, suggestLayerReuse } from "./reverse-design";

describe("Reverse Design", () => {
  it("sugere reaproveitamento somente por semantic tag compatível", () => {
    const manifest = createLayerManifest({
      manifest_id: "manifest-source",
      asset_id: "asset-source",
      organization_id: "org-1",
      version: "1",
      layers: [
        {
          layer_id: "layer-headline",
          type: "TEXT",
          bounds: { x: 0, y: 0, width: 300, height: 40 },
          semantic_tag: "headline",
          provenance: { created_by: "human:owner-1", owner_id: "owner-1", source_id: "source-1", license_ref: "lic-1" },
        },
        {
          layer_id: "layer-background",
          type: "IMAGE",
          bounds: { x: 0, y: 0, width: 800, height: 600 },
          semantic_tag: "background",
          provenance: { created_by: "agent:extractor-1", owner_id: "owner-1", source_id: "source-2", license_ref: "lic-2" },
        },
        {
          layer_id: "layer-logo",
          type: "IMAGE",
          bounds: { x: 12, y: 12, width: 80, height: 32 },
          semantic_tag: "logo",
          provenance: { created_by: "human:owner-1", owner_id: "owner-1", source_id: "source-3", license_ref: "lic-3" },
        },
      ],
    });

    const suggestions = suggestLayerReuse(manifest, ["headline", "logo", "button"]);

    expect(suggestions.map(({ layer_id, semantic_tag }) => ({ layer_id, semantic_tag }))).toEqual([
      { layer_id: "layer-headline", semantic_tag: "headline" },
      { layer_id: "layer-logo", semantic_tag: "logo" },
    ]);
    expect(suggestions.some(({ semantic_tag }) => semantic_tag === "background")).toBe(false);
    expect(suggestions.some(({ semantic_tag }) => semantic_tag === "button")).toBe(false);
    expect(suggestions.every((suggestion) => suggestion.authorization === "SUGGESTION_ONLY")).toBe(true);
  });

  it("nega downstream sem approval explícita e sem isolamento de tenant", async () => {
    const manifest = createLayerManifest({ manifest_id: "manifest-source", asset_id: "asset-source", organization_id: "org-1", version: "1", layers: [{ layer_id: "layer-1", type: "IMAGE", bounds: { x: 0, y: 0, width: 10, height: 10 }, semantic_tag: "hero", provenance: { created_by: "human:owner-1", owner_id: "owner-1", source_id: "source-1", license_ref: "lic-1" } }] });
    const findLicense = async () => ({ license_ref: "lic-1", source_id: "source-1", owner_id: "owner-1", status: "VERIFIED" as const, expires_at: null });
    await expect(approveLayerReuse(manifest, { organizationId: "org-1", targetSemanticTags: ["hero"] }, undefined, findLicense)).rejects.toBeInstanceOf(LayerReuseAuthorizationError);
    await expect(approveLayerReuse(manifest, { organizationId: "org-2", targetSemanticTags: ["hero"] }, { approval_id: "approval-1", organizationId: "org-2", status: "APPROVED", expires_at: "2099-01-01T00:00:00.000Z" }, findLicense)).rejects.toBeInstanceOf(LayerReuseAuthorizationError);
  });

  it("só libera reuse com approval vigente do tenant correto", async () => {
    const manifest = createLayerManifest({ manifest_id: "manifest-source", asset_id: "asset-source", organization_id: "org-1", version: "1", layers: [{ layer_id: "layer-1", type: "IMAGE", bounds: { x: 0, y: 0, width: 10, height: 10 }, semantic_tag: "hero", provenance: { created_by: "human:owner-1", owner_id: "owner-1", source_id: "source-1", license_ref: "lic-1" } }] });
    const approved = await approveLayerReuse(manifest, { organizationId: "org-1", targetSemanticTags: ["hero"] }, { approval_id: "approval-1", organizationId: "org-1", status: "APPROVED", expires_at: "2099-01-01T00:00:00.000Z" }, async () => ({ license_ref: "lic-1", source_id: "source-1", owner_id: "owner-1", status: "VERIFIED" as const, expires_at: null }));
    expect(approved).toHaveLength(1);
    expect(approved[0]!.authorization).toBe("APPROVED_FOR_REUSE");
  });

  it("carrega approval pelo registry antes de liberar reuse", async () => {
    const manifest = createLayerManifest({ manifest_id: "manifest-source", asset_id: "asset-source", organization_id: "org-1", version: "1", layers: [{ layer_id: "layer-1", type: "IMAGE", bounds: { x: 0, y: 0, width: 10, height: 10 }, semantic_tag: "hero", provenance: { created_by: "human:owner-1", owner_id: "owner-1", source_id: "source-1", license_ref: "lic-1" } }] });
    const approved = await approveLayerReuseFromStore(manifest, { organizationId: "org-1", approvalId: "approval-1", targetSemanticTags: ["hero"] }, { loadForTenant: async (organizationId, approvalId) => organizationId === "org-1" && approvalId === "approval-1" ? { approval_id: approvalId, organizationId, status: "APPROVED", expires_at: "2099-01-01T00:00:00.000Z" } : null }, async () => ({ license_ref: "lic-1", source_id: "source-1", owner_id: "owner-1", status: "VERIFIED" as const, expires_at: null }));
    expect(approved[0]!.authorization).toBe("APPROVED_FOR_REUSE");
  });
});
