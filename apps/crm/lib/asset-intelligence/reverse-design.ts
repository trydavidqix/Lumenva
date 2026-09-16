import { assertLayerManifestLicensed, type LayerLicenseRecord, type LayerManifest, type SemanticLayer } from "./layer-manifest";

export type LayerReuseAuthorization = "SUGGESTION_ONLY" | "APPROVED_FOR_REUSE";

export type LayerReuseSuggestion = SemanticLayer & Readonly<{
  source_manifest_id: string;
  authorization: LayerReuseAuthorization;
}>;

export type LayerReuseApproval = Readonly<{
  approval_id: string;
  organizationId: string;
  status: "APPROVED" | "REVOKED" | "EXPIRED";
  expires_at: string;
}>;

export type LayerReuseApprovalReader = Readonly<{
  loadForTenant: (organizationId: string, approvalId: string) => Promise<LayerReuseApproval | null>;
}>;

export class LayerReuseAuthorizationError extends Error {
  readonly code = "layer_reuse_approval_required";
}

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
      authorization: "SUGGESTION_ONLY" as const,
    }));
}

export async function approveLayerReuse(
  manifest: LayerManifest,
  request: { organizationId: string; targetSemanticTags: readonly string[] },
  approval: LayerReuseApproval | undefined,
  findLicense: (licenseRef: string) => Promise<LayerLicenseRecord | null>,
  now = new Date(),
): Promise<readonly LayerReuseSuggestion[]> {
  if (manifest.organization_id !== request.organizationId) throw new LayerReuseAuthorizationError("Layer reuse tenant mismatch.");
  if (!approval || !approval.approval_id.trim() || approval.organizationId !== request.organizationId || approval.status !== "APPROVED" || Date.parse(approval.expires_at) <= now.getTime()) {
    throw new LayerReuseAuthorizationError("Explicit layer reuse approval is required.");
  }
  await assertLayerManifestLicensed(manifest, findLicense, now);
  return suggestLayerReuse(manifest, request.targetSemanticTags).map((suggestion) => ({ ...suggestion, authorization: "APPROVED_FOR_REUSE" as const }));
}

export async function approveLayerReuseFromStore(
  manifest: LayerManifest,
  request: { organizationId: string; targetSemanticTags: readonly string[]; approvalId: string },
  store: LayerReuseApprovalReader,
  findLicense: (licenseRef: string) => Promise<LayerLicenseRecord | null>,
  now = new Date(),
): Promise<readonly LayerReuseSuggestion[]> {
  const approval = await store.loadForTenant(request.organizationId, request.approvalId);
  return approveLayerReuse(manifest, request, approval ?? undefined, findLicense, now);
}
