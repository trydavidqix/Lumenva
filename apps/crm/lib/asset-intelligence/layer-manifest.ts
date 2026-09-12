export type LayerBounds = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export type LayerProvenance = Readonly<{
  created_by: string;
  source_refs?: readonly string[];
}>;

/** The smallest provider-free description of one design layer. */
export type SemanticLayer = Readonly<{
  layer_id: string;
  type: string;
  bounds: LayerBounds;
  semantic_tag: string;
  provenance: LayerProvenance;
}>;

/** Versioned, asset-scoped collection of semantic design layers. */
export type LayerManifest = Readonly<{
  manifest_id: string;
  asset_id: string;
  version: string;
  layers: readonly SemanticLayer[];
}>;

function required(value: string, field: string): void {
  if (!value.trim()) {
    throw new Error(field + " must be a non-empty string");
  }
}

function validBounds(bounds: LayerBounds): void {
  for (const [field, value] of Object.entries(bounds)) {
    if (!Number.isFinite(value)) {
      throw new Error("bounds." + field + " must be finite");
    }
  }
  if (bounds.width < 0 || bounds.height < 0) {
    throw new Error("bounds width and height must be non-negative");
  }
}

function validateLayer(layer: SemanticLayer): void {
  required(layer.layer_id, "layer_id");
  required(layer.type, "type");
  required(layer.semantic_tag, "semantic_tag");
  required(layer.provenance.created_by, "created_by");
  validBounds(layer.bounds);
  if (layer.provenance.source_refs?.some((ref) => !ref.trim())) {
    throw new Error("provenance source_refs must contain non-empty strings");
  }
}

export function createLayerManifest(input: LayerManifest): LayerManifest {
  required(input.manifest_id, "manifest_id");
  required(input.asset_id, "asset_id");
  required(input.version, "version");
  for (const layer of input.layers) validateLayer(layer);
  return input;
}
