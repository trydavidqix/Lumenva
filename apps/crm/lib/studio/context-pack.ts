export const CONTEXT_PACK_PURPOSES = ["EDIT", "MIX_VARIANT", "REVIEW", "PREVIEW"] as const;
export type ContextPackPurpose = (typeof CONTEXT_PACK_PURPOSES)[number];
export type PermissionLevel = "P0" | "P1" | "P2" | "P3" | "P4";
export type RiskLevel = "R0" | "R1" | "R2" | "R3" | "R4";

export type ContextPack = {
  context_pack_id: string;
  organization_id: string;
  project_id: string;
  purpose: ContextPackPurpose;
  project_spec_version: string;
  allowed_assets: string[];
  allowed_sources: string[];
  allowed_layer_ids: string[];
  allowed_operations: readonly ["UPDATE_LAYER"];
  constraints: string[];
  authority_envelope_ref: string;
  budget: { max_tokens: number; max_assets: number; max_latency_ms: number };
  provenance_refs: string[];
  redacted: boolean;
};

export type AIEditRequest = {
  edit_id: string;
  organization_id: string;
  project_id: string;
  canvas_id: string;
  base_version: number;
  context_pack_id: string;
  instruction: string;
  target_layer_ids: string[];
  permission_level: PermissionLevel;
  risk_level: RiskLevel;
  idempotency_key: string;
  status: "REQUESTED" | "VALIDATING" | "DENIED" | "APPROVED" | "RUNNING" | "PREVIEW_READY" | "APPLIED" | "FAILED" | "CANCELLED";
  eval_refs: string[];
};

export type AIEditProposal = {
  edit_id: string;
  organization_id: string;
  project_id: string;
  canvas_id: string;
  base_version: number;
  context_pack_id: string;
  instruction: string;
  target_layer_ids: string[];
  operation: "UPDATE_LAYER";
  permission_level: PermissionLevel;
  risk_level: RiskLevel;
  idempotency_key: string;
  authority_envelope_ref: string;
  status: "PENDING_REVIEW";
  eval_refs: string[];
};

export type AIEditProposalOptions = {
  editId: string;
  canvasId: string;
  baseVersion: number;
  targetLayerIds: string[];
  idempotencyKey: string;
  permissionLevel?: PermissionLevel;
  riskLevel?: RiskLevel;
};

export type ContextPackInput = {
  contextPackId: string;
  organizationId: string;
  projectId: string;
  projectSpecVersion: string;
  allowedLayerIds: string[];
  allowedAssets?: string[];
  allowedSources?: string[];
  constraints?: string[];
  authorityEnvelopeRef?: string;
  purpose?: ContextPackPurpose;
  budget?: ContextPack["budget"];
  provenanceRefs?: string[];
  redacted?: boolean;
};

export function createContextPack(input: ContextPackInput): ContextPack {
  return {
    context_pack_id: input.contextPackId,
    organization_id: input.organizationId,
    project_id: input.projectId,
    purpose: input.purpose ?? "EDIT",
    project_spec_version: input.projectSpecVersion,
    allowed_assets: [...(input.allowedAssets ?? [])],
    allowed_sources: [...(input.allowedSources ?? [])],
    allowed_layer_ids: [...input.allowedLayerIds],
    allowed_operations: ["UPDATE_LAYER"],
    constraints: [...(input.constraints ?? [])],
    authority_envelope_ref: input.authorityEnvelopeRef ?? `context-pack:${input.contextPackId}`,
    budget: input.budget ?? { max_tokens: 0, max_assets: input.allowedAssets?.length ?? 0, max_latency_ms: 0 },
    provenance_refs: [...(input.provenanceRefs ?? [])],
    redacted: input.redacted ?? true,
  };
}

export type ValidationResult =
  | { allowed: true }
  | { allowed: false; reason: "TENANT_SCOPE_MISMATCH" | "PROJECT_SCOPE_MISMATCH" | "CONTEXT_PACK_MISMATCH" | "TARGET_OUTSIDE_AUTHORITY_SCOPE" | "OPERATION_NOT_ALLOWED" };

export function validateAIEditRequest(pack: ContextPack, request: AIEditRequest): ValidationResult {
  if (request.organization_id !== pack.organization_id) return { allowed: false, reason: "TENANT_SCOPE_MISMATCH" };
  if (request.project_id !== pack.project_id) return { allowed: false, reason: "PROJECT_SCOPE_MISMATCH" };
  if (request.context_pack_id !== pack.context_pack_id) return { allowed: false, reason: "CONTEXT_PACK_MISMATCH" };
  if (!pack.allowed_operations.includes("UPDATE_LAYER")) return { allowed: false, reason: "OPERATION_NOT_ALLOWED" };
  if (request.target_layer_ids.length === 0 || request.target_layer_ids.some((id) => !pack.allowed_layer_ids.includes(id))) {
    return { allowed: false, reason: "TARGET_OUTSIDE_AUTHORITY_SCOPE" };
  }
  return { allowed: true };
}

export function proposeAIEdit(
  pack: ContextPack,
  instruction: string,
  options: AIEditProposalOptions,
): AIEditProposal {
  if (
    !pack.context_pack_id.trim() ||
    !pack.organization_id.trim() ||
    !pack.project_id.trim() ||
    !pack.project_spec_version.trim() ||
    !pack.redacted ||
    !pack.authority_envelope_ref.trim() ||
    !pack.allowed_operations.includes("UPDATE_LAYER")
  ) {
    throw new Error("context_pack_invalid");
  }
  if (!instruction.trim()) throw new Error("edit_instruction_invalid");
  if (!options.editId.trim() || !options.canvasId.trim() || !options.idempotencyKey.trim() || options.baseVersion < 0) {
    throw new Error("edit_proposal_invalid");
  }
  if (
    options.targetLayerIds.length === 0 ||
    options.targetLayerIds.some((layerId) => !pack.allowed_layer_ids.includes(layerId))
  ) {
    throw new Error("TARGET_OUTSIDE_AUTHORITY_SCOPE");
  }

  return {
    edit_id: options.editId,
    organization_id: pack.organization_id,
    project_id: pack.project_id,
    canvas_id: options.canvasId,
    base_version: options.baseVersion,
    context_pack_id: pack.context_pack_id,
    instruction,
    target_layer_ids: [...options.targetLayerIds],
    operation: "UPDATE_LAYER",
    permission_level: options.permissionLevel ?? "P1",
    risk_level: options.riskLevel ?? "R1",
    idempotency_key: options.idempotencyKey,
    authority_envelope_ref: pack.authority_envelope_ref,
    status: "PENDING_REVIEW",
    eval_refs: [],
  };
}
