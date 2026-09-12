export type ContextPackPurpose = "EDIT" | "MIX_VARIANT" | "REVIEW" | "PREVIEW";

export type ContextPack = {
  context_pack_id: string;
  organization_id: string;
  project_id: string;
  purpose: ContextPackPurpose;
  project_spec_version: string;
  allowed_assets: string[];
  allowed_sources: string[];
  constraints: string[];
  authority_envelope_ref: string;
  budget: { max_tokens: number; max_assets: number; max_latency_ms: number };
  provenance_refs: string[];
  redacted: boolean;
};

export type ContextPackEdit = {
  organization_id: string;
  project_id: string;
  asset_ids: string[];
  source_refs: string[];
};

type ContextPackEditRejection =
  | "TENANT_MISMATCH"
  | "PROJECT_MISMATCH"
  | "ASSET_OUT_OF_SCOPE"
  | "SOURCE_OUT_OF_SCOPE";

export function validateContextPackEdit(
  pack: ContextPack,
  edit: ContextPackEdit,
): { allowed: true } | { allowed: false; reason: ContextPackEditRejection } {
  if (pack.organization_id !== edit.organization_id) {
    return { allowed: false, reason: "TENANT_MISMATCH" };
  }
  if (pack.project_id !== edit.project_id) {
    return { allowed: false, reason: "PROJECT_MISMATCH" };
  }
  if (edit.asset_ids.some((id) => !pack.allowed_assets.includes(id))) {
    return { allowed: false, reason: "ASSET_OUT_OF_SCOPE" };
  }
  if (edit.source_refs.some((ref) => !pack.allowed_sources.includes(ref))) {
    return { allowed: false, reason: "SOURCE_OUT_OF_SCOPE" };
  }
  return { allowed: true };
}
