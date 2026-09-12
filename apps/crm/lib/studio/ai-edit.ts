export type ContextPack = Readonly<{
  context_pack_id: string;
  organization_id: string;
  project_id: string;
  purpose: "EDIT" | "MIX_VARIANT" | "REVIEW" | "PREVIEW";
  project_spec_version: string;
  allowed_assets: readonly string[];
  allowed_sources: readonly string[];
  constraints: readonly string[];
  authority_envelope_ref: string;
  budget: Readonly<{
    max_tokens: number;
    max_assets: number;
    max_latency_ms: number;
  }>;
  provenance_refs: readonly string[];
  redacted: boolean;
}>;

export type AIEditProposal = Readonly<{
  edit_id: string;
  organization_id: string;
  project_id: string;
  context_pack_id: string;
  instruction: string;
  target_layer_ids: readonly string[];
  status: "PENDING_REVIEW";
  applied: false;
}>;

function required(value: string, field: string): void {
  if (!value.trim()) throw new Error(field + " must be a non-empty string");
}

function nonNegativeFinite(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(field + " must be a non-negative finite number");
  }
}

function validateContextPack(contextPack: ContextPack): void {
  required(contextPack.context_pack_id, "context_pack_id");
  required(contextPack.organization_id, "organization_id");
  required(contextPack.project_id, "project_id");
  required(contextPack.project_spec_version, "project_spec_version");
  required(contextPack.authority_envelope_ref, "authority_envelope_ref");
  if (contextPack.purpose !== "EDIT") throw new Error("purpose must be EDIT");
  nonNegativeFinite(contextPack.budget.max_tokens, "budget.max_tokens");
  nonNegativeFinite(contextPack.budget.max_assets, "budget.max_assets");
  nonNegativeFinite(contextPack.budget.max_latency_ms, "budget.max_latency_ms");
}

function deterministicEditId(contextPackId: string, instruction: string): string {
  let hash = 2166136261;
  for (const character of contextPackId + "\\0" + instruction) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return contextPackId + ":edit-" + (hash >>> 0).toString(16);
}

/** Creates a reviewable proposal; this function never applies a canvas mutation. */
export function proposeAIEdit(
  contextPack: ContextPack,
  instruction: string,
): AIEditProposal {
  validateContextPack(contextPack);
  required(instruction, "instruction");

  return {
    edit_id: deterministicEditId(contextPack.context_pack_id, instruction),
    organization_id: contextPack.organization_id,
    project_id: contextPack.project_id,
    context_pack_id: contextPack.context_pack_id,
    instruction,
    target_layer_ids: [],
    status: "PENDING_REVIEW",
    applied: false,
  };
}
