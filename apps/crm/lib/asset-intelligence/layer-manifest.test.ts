import { describe, expect, it } from "vitest";
import { createLayerManifest, type LayerManifest } from "./layer-manifest";

describe("LayerManifest", () => {
  it("representa camadas com identidade, tipo, bounds, tag semântica e provenance do criador", () => {
    const manifest: LayerManifest = createLayerManifest({
      manifest_id: "manifest-1",
      asset_id: "asset-1",
      version: "1",
      layers: [
        {
          layer_id: "layer-hero",
          type: "TEXT",
          bounds: { x: 12, y: 24, width: 320, height: 48 },
          semantic_tag: "headline",
          provenance: { created_by: "human:owner-1", source_refs: ["upload:asset-1"] },
        },
      ],
    });

    expect(manifest.layers[0]).toEqual({
      layer_id: "layer-hero",
      type: "TEXT",
      bounds: { x: 12, y: 24, width: 320, height: 48 },
      semantic_tag: "headline",
      provenance: { created_by: "human:owner-1", source_refs: ["upload:asset-1"] },
    });
  });

  it("rejeita identidade, bounds ou provenance inválidos", () => {
    expect(() => createLayerManifest({
      manifest_id: "manifest-1",
      asset_id: "asset-1",
      version: "1",
      layers: [{
        layer_id: "",
        type: "IMAGE",
        bounds: { x: 0, y: 0, width: -1, height: 10 },
        semantic_tag: "background",
        provenance: { created_by: "" },
      }],
    })).toThrow(/layer_id|bounds|created_by/);
  });
});
