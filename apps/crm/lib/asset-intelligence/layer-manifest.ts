export type LayerBounds = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export type LayerProvenance = Readonly<{
  created_by: string;
  owner_id: string;
  source_id: string;
  license_ref: string;
  source_refs?: readonly string[];
}>;

export type LayerLicenseRecord = Readonly<{
  license_ref: string;
  source_id: string;
  owner_id: string;
  status: "REGISTERED" | "VERIFIED" | "SUPERSEDED" | "REVOKED";
  expires_at?: string | null;
}>;

export class LayerLicenseError extends Error {
  readonly code = "asset_license_required";
}

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
  organization_id: string;
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
  required(layer.provenance.owner_id, "owner_id");
  required(layer.provenance.source_id, "source_id");
  required(layer.provenance.license_ref, "license_ref");
  validBounds(layer.bounds);
  if (layer.provenance.source_refs?.some((ref) => !ref.trim())) {
    throw new Error("provenance source_refs must contain non-empty strings");
  }
}

export function createLayerManifest(input: LayerManifest): LayerManifest {
  required(input.manifest_id, "manifest_id");
  required(input.asset_id, "asset_id");
  required(input.organization_id, "organization_id");
  required(input.version, "version");
  for (const layer of input.layers) validateLayer(layer);
  return input;
}

/**
 * Authorization boundary for reuse. Manifest metadata is untrusted; only a
 * verified external source record can grant asset use.
 */
export async function assertLayerManifestLicensed(
  manifest: LayerManifest,
  findLicense: (licenseRef: string) => Promise<LayerLicenseRecord | null>,
  now = new Date(),
): Promise<void> {
  for (const layer of manifest.layers) {
    const provenance = layer.provenance;
    const license = await findLicense(provenance.license_ref);
    if (!license || license.license_ref !== provenance.license_ref || license.source_id !== provenance.source_id || license.owner_id !== provenance.owner_id || license.status !== "VERIFIED") {
      throw new LayerLicenseError("Asset license/provenance is not verified.");
    }
    if (license.expires_at) {
      const expiresAt = Date.parse(license.expires_at);
      if (!Number.isFinite(expiresAt)) {
        throw new LayerLicenseError("Asset license expiry timestamp is invalid.");
      }
      if (expiresAt <= now.getTime()) {
        throw new LayerLicenseError("Asset license is expired.");
      }
    }
  }
}
