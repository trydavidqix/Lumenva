/**
 * Flywheel proposal application compatibility layer.
 * Legacy proposals retain publish-on-click semantics. Phase 6 proposals only
 * approve already-validated candidates; they never create a different candidate,
 * publish immediately, or raise autonomy on the human click.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { publishAgentVersion } from "@/lib/ai/agents/publish";

export function composeAppliedPrompt(basePrompt: string, bulletContent: string): string {
  const bullet = bulletContent.trim();
  return `${basePrompt.trimEnd()}\n\n## Aprendizado do flywheel\n- ${bullet}\n`;
}

type Phase6EvidenceLike = {
  phase?: unknown;
  status?: unknown;
  proposalType?: unknown;
  scope?: unknown;
  candidateRef?: unknown;
  validationRef?: unknown;
  validationSummary?: unknown;
  rollbackTargetRef?: unknown;
  rolloutLevel?: unknown;
  [key: string]: unknown;
};

function asObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readPhase6Evidence(value: unknown): Phase6EvidenceLike | null {
  return asObject(asObject(value)?.phase6) as Phase6EvidenceLike | null;
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function assertValidatedPhase6Candidate(phase6: Phase6EvidenceLike): void {
  const validationSummary = asObject(phase6.validationSummary);
  if (!readNonEmptyString(phase6.validationRef) || validationSummary?.passed !== true) {
    throw new Error("flywheel_proposal_not_validated");
  }
  if (phase6.proposalType !== "eval_case" && !readNonEmptyString(phase6.candidateRef)) {
    throw new Error("flywheel_candidate_ref_missing");
  }
}

export function phase6ProposalApplyMode(
  phase6: Phase6EvidenceLike | null,
): "legacy" | "candidate_rollout" | "approval_only" {
  if (!phase6 || phase6.phase !== 6) return "legacy";
  if (phase6.status !== "ready_for_human_review") {
    throw new Error("flywheel_proposal_not_reviewable");
  }
  return phase6.proposalType === "eval_case" ? "approval_only" : "candidate_rollout";
}

export function assertPhase6ProposalScope(
  phase6: Phase6EvidenceLike | null,
  expected: { organizationId: string; agentId: string },
): void {
  if (!phase6 || phase6.phase !== 6) return;
  const scope = asObject(phase6.scope);
  if (
    !scope ||
    scope.organizationId !== expected.organizationId ||
    scope.agentId !== expected.agentId
  ) {
    throw new Error("flywheel_proposal_scope_mismatch");
  }
}

export type ApplyProposalResult =
  | { ok: true; versionId: string; versionNumber: number; rolloutPending?: boolean }
  | { ok: true; entryId: string }
  | { ok: true; proposalId: string; rolloutPending: boolean }
  | { ok: false; code: ApplyProposalErrorCode; message: string };

export type ApplyProposalErrorCode =
  | "proposal_not_found"
  | "proposal_already_applied"
  | "proposal_not_reviewable"
  | "proposal_type_unsupported"
  | "agent_not_published"
  | "publish_failed"
  | "internal_error";

const VERSION_COPY_COLUMNS =
  "id, version_number, system_prompt, provider, model, credential_id, tool_ids, trigger_config, channel_session_id, max_steps, token_budget, cost_budget_cents, history_message_window, history_token_window, handoff_keywords, handoff_tool_enabled";

async function loadAgentBase(
  admin: SupabaseClient,
  orgId: string,
  agentId: string,
): Promise<
  | { ok: true; base: Record<string, unknown>; nextNumber: number }
  | { ok: false; result: ApplyProposalResult }
> {
  const { data: agent } = await admin
    .from("ai_agents")
    .select("id, published_version_id")
    .eq("id", agentId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!agent?.published_version_id) {
    return {
      ok: false,
      result: { ok: false, code: "agent_not_published", message: "O agente precisa de uma versão publicada para receber a proposta." },
    };
  }

  const { data: base } = await admin
    .from("ai_agent_versions")
    .select(VERSION_COPY_COLUMNS)
    .eq("id", agent.published_version_id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!base) {
    return { ok: false, result: { ok: false, code: "internal_error", message: "Versão publicada não encontrada." } };
  }

  const { data: maxRow } = await admin
    .from("ai_agent_versions")
    .select("version_number")
    .eq("agent_id", agentId)
    .eq("organization_id", orgId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { ok: true, base, nextNumber: (maxRow?.version_number ?? 0) + 1 };
}

async function createDraftVersion(
  admin: SupabaseClient,
  params: { orgId: string; agentId: string; userId: string; content: string; base: Record<string, unknown>; nextNumber: number },
): Promise<{ id: string; version_number: number } | null> {
  const { orgId, agentId, userId, content, base, nextNumber } = params;
  const { data: created, error } = await admin
    .from("ai_agent_versions")
    .insert({
      organization_id: orgId,
      agent_id: agentId,
      version_number: nextNumber,
      system_prompt: composeAppliedPrompt(String(base.system_prompt ?? ""), content),
      provider: base.provider,
      model: base.model,
      credential_id: base.credential_id,
      tool_ids: base.tool_ids,
      trigger_config: base.trigger_config ?? undefined,
      channel_session_id: base.channel_session_id,
      max_steps: base.max_steps,
      token_budget: base.token_budget,
      cost_budget_cents: base.cost_budget_cents,
      history_message_window: base.history_message_window,
      history_token_window: base.history_token_window,
      handoff_keywords: base.handoff_keywords,
      handoff_tool_enabled: base.handoff_tool_enabled,
      status: "draft",
      created_by: userId,
    })
    .select("id, version_number")
    .single();
  return error || !created ? null : created;
}

async function loadValidatedCandidateVersion(
  admin: SupabaseClient,
  params: { orgId: string; agentId: string; candidateRef: string },
): Promise<{ id: string; version_number: number } | null> {
  const { data } = await admin
    .from("ai_agent_versions")
    .select("id, version_number, status")
    .eq("id", params.candidateRef)
    .eq("agent_id", params.agentId)
    .eq("organization_id", params.orgId)
    .eq("status", "draft")
    .maybeSingle();
  return data ? { id: data.id, version_number: data.version_number } : null;
}

export async function applyProposal(
  admin: SupabaseClient,
  params: { orgId: string; agentId: string; proposalId: string; userId: string },
): Promise<ApplyProposalResult> {
  const { orgId, agentId, proposalId, userId } = params;

  const { data: proposal } = await admin
    .from("flywheel_distiller_proposals")
    .select("id, type, content, evidence, applied_at")
    .eq("id", proposalId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!proposal) {
    return { ok: false, code: "proposal_not_found", message: "Proposta não encontrada." };
  }
  if (proposal.applied_at !== null) {
    return { ok: false, code: "proposal_already_applied", message: "Proposta já foi aplicada." };
  }

  const phase6 = readPhase6Evidence(proposal.evidence);
  let applyMode: ReturnType<typeof phase6ProposalApplyMode>;
  try {
    assertPhase6ProposalScope(phase6, { organizationId: orgId, agentId });
    applyMode = phase6ProposalApplyMode(phase6);
    if (applyMode !== "legacy" && phase6) assertValidatedPhase6Candidate(phase6);
  } catch {
    return { ok: false, code: "proposal_not_reviewable", message: "Proposta da Fase 6 não está validada e pronta para este agente." };
  }

  if (applyMode !== "legacy" && phase6) {
    const rootEvidence = asObject(proposal.evidence) ?? {};

    if (applyMode === "candidate_rollout") {
      const candidateRef = readNonEmptyString(phase6.candidateRef);
      if (!candidateRef) {
        return { ok: false, code: "proposal_not_reviewable", message: "Candidata validada não encontrada." };
      }

      // Skill candidates are concrete ai_agent_versions. Routing/threshold candidates
      // may use another certified candidate reference and therefore return proposalId.
      if (phase6.proposalType === "skill_change") {
        const candidate = await loadValidatedCandidateVersion(admin, { orgId, agentId, candidateRef });
        if (!candidate) {
          return { ok: false, code: "proposal_not_reviewable", message: "A versão candidata validada não existe ou não está em draft." };
        }
        const nextPhase6 = {
          ...phase6,
          status: "rolling_out_shadow",
          rolloutLevel: "shadow",
        };
        const { error } = await admin
          .from("flywheel_distiller_proposals")
          .update({ evidence: { ...rootEvidence, phase6: nextPhase6 }, applied_by: userId })
          .eq("id", proposalId)
          .eq("organization_id", orgId)
          .is("applied_at", null);
        if (error) return { ok: false, code: "internal_error", message: "Falha ao iniciar o rollout SHADOW da candidata validada." };
        return { ok: true, versionId: candidate.id, versionNumber: candidate.version_number, rolloutPending: true };
      }

      const nextPhase6 = { ...phase6, status: "rolling_out_shadow", rolloutLevel: "shadow" };
      const { error } = await admin
        .from("flywheel_distiller_proposals")
        .update({ evidence: { ...rootEvidence, phase6: nextPhase6 }, applied_by: userId })
        .eq("id", proposalId)
        .eq("organization_id", orgId)
        .is("applied_at", null);
      if (error) return { ok: false, code: "internal_error", message: "Falha ao iniciar o rollout SHADOW." };
      return { ok: true, proposalId, rolloutPending: true };
    }

    const nextPhase6 = { ...phase6, status: "approved", rolloutLevel: "off" };
    const { error } = await admin
      .from("flywheel_distiller_proposals")
      .update({ evidence: { ...rootEvidence, phase6: nextPhase6 }, applied_by: userId })
      .eq("id", proposalId)
      .eq("organization_id", orgId)
      .is("applied_at", null);
    if (error) return { ok: false, code: "internal_error", message: "Falha ao registrar a aprovação." };
    return { ok: true, proposalId, rolloutPending: false };
  }

  if (proposal.type === "org_memory_entry") {
    const title = proposal.content.length > 80 ? `${proposal.content.slice(0, 77)}...` : proposal.content;
    const { data: entry, error: entryErr } = await admin
      .from("org_memory_entries")
      .insert({ organization_id: orgId, title, body: proposal.content, source: "flywheel", status: "active", proposal_id: proposalId, created_by: userId })
      .select("id")
      .single();
    if (entryErr || !entry) return { ok: false, code: "internal_error", message: "Falha ao gravar a memória da org." };
    const { error: markErr } = await admin
      .from("flywheel_distiller_proposals")
      .update({ applied_at: new Date().toISOString(), applied_by: userId })
      .eq("id", proposalId)
      .eq("organization_id", orgId);
    if (markErr) return { ok: false, code: "internal_error", message: "Memória gravada, mas falhou ao marcar a proposta." };
    return { ok: true, entryId: entry.id };
  }

  if (proposal.type !== "playbook_bullet") {
    return { ok: false, code: "proposal_type_unsupported", message: `Aplicação automática só existe para playbook_bullet (esta é ${proposal.type}).` };
  }

  const loaded = await loadAgentBase(admin, orgId, agentId);
  if (!loaded.ok) return loaded.result;
  const created = await createDraftVersion(admin, { orgId, agentId, userId, content: proposal.content, base: loaded.base, nextNumber: loaded.nextNumber });
  if (!created) return { ok: false, code: "internal_error", message: "Falha ao criar a versão nova." };

  const published = await publishAgentVersion(admin, { orgId, agentId, versionId: created.id });
  if (!published.ok) {
    return { ok: false, code: "publish_failed", message: `Publicação vetada: ${published.code}. A proposta segue pendente.` };
  }

  const { error: markErr } = await admin
    .from("flywheel_distiller_proposals")
    .update({ applied_at: new Date().toISOString(), applied_version_id: created.id, applied_by: userId })
    .eq("id", proposalId)
    .eq("organization_id", orgId)
    .is("applied_at", null);
  if (markErr) return { ok: false, code: "internal_error", message: "Versão publicada, mas falhou ao marcar a proposta." };

  return { ok: true, versionId: created.id, versionNumber: created.version_number };
}
