import { describe, expect, it } from "vitest";
import { assertLayerManifestLicensed, createLayerManifest, type LayerManifest } from "./layer-manifest";

describe("LayerManifest", () => {
  it("representa camadas com identidade, tipo, bounds, tag semântica e provenance do criador", () => {
    const manifest: LayerManifest = createLayerManifest({
      manifest_id: "manifest-1",
      asset_id: "asset-1",
      organization_id: "org-1",
      version: "1",
      layers: [
        {
          layer_id: "layer-hero",
          type: "TEXT",
          bounds: { x: 12, y: 24, width: 320, height: 48 },
          semantic_tag: "headline",
          provenance: { created_by: "human:owner-1", owner_id: "owner-1", source_id: "source-1", license_ref: "lic-1", source_refs: ["upload:asset-1"] },
        },
      ],
    });

    expect(manifest.layers[0]).toEqual({
      layer_id: "layer-hero",
      type: "TEXT",
      bounds: { x: 12, y: 24, width: 320, height: 48 },
      semantic_tag: "headline",
      provenance: { created_by: "human:owner-1", owner_id: "owner-1", source_id: "source-1", license_ref: "lic-1", source_refs: ["upload:asset-1"] },
    });
  });

  it("rejeita identidade, bounds ou provenance inválidos", () => {
    expect(() => createLayerManifest({
      manifest_id: "manifest-1",
      asset_id: "asset-1",
      organization_id: "org-1",
      version: "1",
      layers: [{
        layer_id: "",
        type: "IMAGE",
        bounds: { x: 0, y: 0, width: -1, height: 10 },
        semantic_tag: "background",
        provenance: { created_by: "", owner_id: "owner", source_id: "source", license_ref: "license" },
      }],
    })).toThrow(/layer_id|bounds|created_by/);
  });

  it("nega uso quando a licença/proveniência não é verificada", async () => {
    const manifest = createLayerManifest({
      manifest_id: "manifest-licensed",
      asset_id: "asset-1",
      organization_id: "org-1",
      version: "1",
      layers: [{ layer_id: "layer-1", type: "IMAGE", bounds: { x: 0, y: 0, width: 10, height: 10 }, semantic_tag: "hero", provenance: { created_by: "human:owner-1", owner_id: "owner-1", source_id: "source-1", license_ref: "lic-revoked" } }],
    });
    await expect(assertLayerManifestLicensed(manifest, async () => ({ license_ref: "lic-revoked", source_id: "source-1", owner_id: "owner-1", status: "REVOKED", expires_at: null }))).rejects.toThrow("license");
  });

  it("falha fechado quando expires_at tem timestamp inválido", async () => {
    const manifest = createLayerManifest({
      manifest_id: "manifest-invalid-expiry",
      asset_id: "asset-1",
      organization_id: "org-1",
      version: "1",
      layers: [{ layer_id: "layer-1", type: "IMAGE", bounds: { x: 0, y: 0, width: 10, height: 10 }, semantic_tag: "hero", provenance: { created_by: "human:owner-1", owner_id: "owner-1", source_id: "source-1", license_ref: "lic-1" } }],
    });
    await expect(assertLayerManifestLicensed(manifest, async () => ({ license_ref: "lic-1", source_id: "source-1", owner_id: "owner-1", status: "VERIFIED", expires_at: "not-a-timestamp" }))).rejects.toThrow("license");
  });
});
