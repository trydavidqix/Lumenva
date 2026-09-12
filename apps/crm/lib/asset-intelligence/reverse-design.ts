import type { LayerManifest, SemanticLayer } from "./layer-manifest";

export type LayerReuseSuggestion = SemanticLayer & Readonly<{
  source_manifest_id: string;
}>;

/**
 * Produces a deterministic structural hypothesis for a new design.
 * A tag match is a suggestion only; it does not grant reuse, license, or approval.
 */
export function suggestLayerReuse(
  manifest: LayerManifest,
  targetSemanticTags: readonly string[],
): readonly LayerReuseSuggestion[] {
  const requestedTags = new Set(targetSemanticTags);

  return manifest.layers
    .filter((layer) => requestedTags.has(layer.semantic_tag))
    .map((layer) => ({
      ...layer,
      source_manifest_id: manifest.manifest_id,
    }));
}
