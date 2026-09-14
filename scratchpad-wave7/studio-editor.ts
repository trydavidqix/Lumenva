import { validateAIEditRequest, type ContextPack, type PermissionLevel, type RiskLevel } from "./context-pack";

export type LayerRef = {
  layer_id: string;
  asset_id?: string;
  semantic_role: string;
  bounds: { x: number; y: number; width: number; height: number };
  z_index: number;
  properties: Record<string, unknown>;
  source_refs: string[];
  locked: boolean;
};

export type CanvasDocument = {
  canvas_id: string;
  organization_id: string;
  session_id: string;
  project_id: string;
  version: number;
  parent_version?: number;
  viewport: { width: number; height: number; unit: "PX" | "PT" | "REM" };
  layers: LayerRef[];
  selected_variant_id?: string;
  editor_state: "DRAFT" | "IN_REVIEW" | "APPROVED" | "SUPERSEDED";
  source_refs: string[];
  evidence_refs: string[];
  created_by: string;
  created_at: string;
};

export type EditStatus = "PENDING_REVIEW" | "APPROVED" | "APPLIED" | "DENIED" | "STALE_VERSION";
export type AIEditProposal = {
  edit_id: string;
  organization_id: string;
  session_id: string;
  project_id: string;
  canvas_id: string;
  base_version: number;
  context_pack_id: string;
  instruction: string;
  target_layer_ids: string[];
  patch: Record<string, unknown>;
  permission_level: PermissionLevel;
  risk_level: RiskLevel;
  idempotency_key: string;
  status: EditStatus;
  eval_refs: string[];
  approved_by?: string;
  approved_at?: string;
};

export type VariantMix = {
  mix_id: string;
  organization_id: string;
  session_id: string;
  project_id: string;
  input_variant_ids: string[];
  output_canvas_id: string;
  mix_rules: string[];
  context_pack_id: string;
  status: "DRAFT" | "PREVIEW" | "EVALUATED" | "APPROVED" | "REJECTED";
  source_refs: string[];
  evidence_refs: string[];
};

export type EditorEvalRun = {
  eval_id: string;
  organization_id: string;
  session_id: string;
  canvas_id: string;
  input_version: number;
  eval_version: string;
  checks: string[];
  metrics: Record<string, number | string | boolean>;
  status: "PASS" | "FAIL" | "NOT_EXECUTED" | "NOT_PROVEN";
  evidence_refs: string[];
};

export type CreateCanvasInput = Omit<CanvasDocument, "version" | "created_at" | "parent_version" | "editor_state"> & {
  now?: string;
};

function required(value: string, code: string): string {
  if (!value.trim()) throw new Error(code);
  return value;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class StudioEditorStore {
  private readonly canvases = new Map<string, CanvasDocument[]>();
  private readonly packs = new Map<string, ContextPack>();
  private readonly edits = new Map<string, AIEditProposal>();
  private readonly evals = new Map<string, EditorEvalRun>();
  private readonly mixes = new Map<string, VariantMix>();

  constructor(private readonly authorizeReviewer: (organizationId: string, reviewerId: string) => Promise<void>) {}

  registerContextPack(pack: ContextPack): void {
    required(pack.organization_id, "tenant_required");
    required(pack.project_id, "project_required");
    this.packs.set(`${pack.organization_id}:${pack.context_pack_id}`, clone(pack));
  }

  createCanvas(input: CreateCanvasInput): CanvasDocument {
    required(input.organization_id, "tenant_required");
    required(input.session_id, "session_required");
    required(input.canvas_id, "canvas_required");
    required(input.project_id, "project_required");
    if (input.viewport.width <= 0 || input.viewport.height <= 0) throw new Error("canvas_viewport_invalid");
    const key = this.canvasKey(input.organization_id, input.session_id, input.canvas_id);
    if (this.canvases.has(key)) throw new Error("canvas_duplicate");
    const canvas: CanvasDocument = {
      ...clone(input),
      version: 1,
      editor_state: "DRAFT",
      created_at: input.now ?? new Date().toISOString(),
      layers: clone(input.layers),
      source_refs: [...input.source_refs],
      evidence_refs: [...input.evidence_refs],
    };
    this.canvases.set(key, [canvas]);
    return clone(canvas);
  }

  getCanvas(organizationId: string, sessionId: string, canvasId: string, version?: number): CanvasDocument {
    const versions = this.canvases.get(this.canvasKey(organizationId, sessionId, canvasId));
    const canvas = versions?.find((candidate) => version === undefined ? candidate.version === versions.length : candidate.version === version);
    if (!canvas) throw new Error("canvas_not_found");
    return clone(canvas);
  }

  proposeEdit(input: {
    organizationId: string;
    sessionId: string;
    projectId: string;
    canvasId: string;
    baseVersion: number;
    contextPackId: string;
    editId: string;
    instruction: string;
    targetLayerIds: string[];
    permissionLevel?: PermissionLevel;
    riskLevel?: RiskLevel;
    idempotencyKey: string;
    patch?: Record<string, unknown>;
  }): AIEditProposal {
    required(input.organizationId, "tenant_required");
    required(input.sessionId, "session_required");
    required(input.idempotencyKey, "idempotency_required");
    const existing = [...this.edits.values()].find((edit) => edit.organization_id === input.organizationId && edit.session_id === input.sessionId && edit.idempotency_key === input.idempotencyKey);
    if (existing) return clone(existing);
    const pack = this.packs.get(`${input.organizationId}:${input.contextPackId}`);
    if (!pack) throw new Error("context_pack_not_found");
    const canvas = this.getCanvas(input.organizationId, input.sessionId, input.canvasId);
    if (canvas.project_id !== input.projectId || canvas.version !== input.baseVersion) throw new Error("stale_version");
    const validation = validateAIEditRequest(pack, {
      edit_id: input.editId,
      organization_id: input.organizationId,
      project_id: input.projectId,
      canvas_id: input.canvasId,
      base_version: input.baseVersion,
      context_pack_id: input.contextPackId,
      instruction: input.instruction,
      target_layer_ids: input.targetLayerIds,
      permission_level: input.permissionLevel ?? "P1",
      risk_level: input.riskLevel ?? "R1",
      idempotency_key: input.idempotencyKey,
      status: "REQUESTED",
      eval_refs: [],
    });
    if (!validation.allowed) throw new Error(validation.reason);
    if (canvas.layers.some((layer) => input.targetLayerIds.includes(layer.layer_id) && layer.locked)) throw new Error("locked_layer_requires_approval");
    const proposal: AIEditProposal = {
      edit_id: input.editId,
      organization_id: input.organizationId,
      session_id: input.sessionId,
      project_id: input.projectId,
      canvas_id: input.canvasId,
      base_version: input.baseVersion,
      context_pack_id: input.contextPackId,
      instruction: input.instruction,
      target_layer_ids: [...input.targetLayerIds],
      patch: clone(input.patch ?? {}),
      permission_level: input.permissionLevel ?? "P1",
      risk_level: input.riskLevel ?? "R1",
      idempotency_key: input.idempotencyKey,
      status: "PENDING_REVIEW",
      eval_refs: [],
    };
    this.edits.set(input.editId, proposal);
    return clone(proposal);
  }

  runEval(input: { evalId: string; organizationId: string; sessionId: string; canvasId: string; inputVersion: number; evalVersion?: string }): EditorEvalRun {
    const canvas = this.getCanvas(input.organizationId, input.sessionId, input.canvasId, input.inputVersion);
    const boundsValid = canvas.layers.every((layer) => layer.bounds.width >= 0 && layer.bounds.height >= 0 && Number.isFinite(layer.bounds.x) && Number.isFinite(layer.bounds.y));
    const provenanceComplete = canvas.layers.every((layer) => layer.source_refs.length > 0) && canvas.source_refs.length > 0;
    const result: EditorEvalRun = {
      eval_id: input.evalId,
      organization_id: input.organizationId,
      session_id: input.sessionId,
      canvas_id: input.canvasId,
      input_version: input.inputVersion,
      eval_version: input.evalVersion ?? "studio-editor-v1",
      checks: ["layer_integrity", "bounds_valid", "tenant_isolation", "provenance_complete"],
      metrics: { layer_count: canvas.layers.length, bounds_valid: boundsValid, provenance_complete: provenanceComplete },
      status: boundsValid && provenanceComplete ? "PASS" : "FAIL",
      evidence_refs: [`canvas:${input.canvasId}:v${input.inputVersion}`],
    };
    this.evals.set(input.evalId, result);
    return clone(result);
  }

  async approveEdit(input: { editId: string; reviewerId: string; now?: string }): Promise<CanvasDocument> {
    required(input.reviewerId, "reviewer_required");
    const proposal = this.edits.get(input.editId);
    if (!proposal) throw new Error("edit_not_found");
    await this.authorizeReviewer(proposal.organization_id, input.reviewerId);
    if (proposal.status !== "PENDING_REVIEW") throw new Error("edit_not_pending");
    const evalPassed = proposal.eval_refs.length > 0 && proposal.eval_refs.every((id) => this.evals.get(id)?.status === "PASS");
    if (!evalPassed) throw new Error("edit_eval_required");
    const current = this.getCanvas(proposal.organization_id, proposal.session_id, proposal.canvas_id);
    if (current.version !== proposal.base_version) {
      proposal.status = "STALE_VERSION";
      throw new Error("stale_version");
    }
    const updatedLayers = current.layers.map((layer) => proposal.target_layer_ids.includes(layer.layer_id) ? { ...layer, properties: { ...layer.properties, ...proposal.patch } } : layer);
    const next: CanvasDocument = {
      ...current,
      version: current.version + 1,
      parent_version: current.version,
      layers: updatedLayers,
      editor_state: "IN_REVIEW",
      created_by: input.reviewerId,
      created_at: input.now ?? new Date().toISOString(),
    };
    this.canvases.get(this.canvasKey(proposal.organization_id, proposal.session_id, proposal.canvas_id))!.push(next);
    proposal.status = "APPLIED";
    proposal.approved_by = input.reviewerId;
    proposal.approved_at = next.created_at;
    return clone(next);
  }

  attachEval(editId: string, evalId: string): void {
    const proposal = this.edits.get(editId);
    if (!proposal || !this.evals.has(evalId)) throw new Error("eval_not_found");
    if (proposal.organization_id !== this.evals.get(evalId)!.organization_id || proposal.session_id !== this.evals.get(evalId)!.session_id) throw new Error("tenant_session_mismatch");
    proposal.eval_refs = [...new Set([...proposal.eval_refs, evalId])];
  }

  mixVariants(input: Omit<VariantMix, "status">): VariantMix {
    required(input.organization_id, "tenant_required");
    required(input.session_id, "session_required");
    if (input.input_variant_ids.length < 2) throw new Error("variant_inputs_required");
    const pack = this.packs.get(`${input.organization_id}:${input.context_pack_id}`);
    if (!pack || pack.project_id !== input.project_id || pack.purpose !== "MIX_VARIANT") throw new Error("variant_context_invalid");
    if (input.input_variant_ids.some((variantId) => !pack.allowed_variant_ids.includes(variantId))) {
      throw new Error("variant_outside_authority_scope");
    }
    const mix: VariantMix = { ...clone(input), status: "DRAFT" };
    this.mixes.set(input.mix_id, mix);
    return clone(mix);
  }

  private canvasKey(organizationId: string, sessionId: string, canvasId: string): string {
    return `${organizationId}:${sessionId}:${canvasId}`;
  }
}
