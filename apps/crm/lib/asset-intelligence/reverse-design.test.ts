import { describe, expect, it } from "vitest";
import { createLayerManifest } from "./layer-manifest";
import { suggestLayerReuse } from "./reverse-design";

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
  });
});
