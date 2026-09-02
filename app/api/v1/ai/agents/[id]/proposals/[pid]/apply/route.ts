/** POST proposal review/apply. Legacy rows preserve old semantics; Phase 6 supports approve/reject/revision. */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyProposal, type ApplyProposalErrorCode } from "@/lib/ai/apply-proposal";
import { createSupabaseLearningProposalStore } from "@/lib/agent-engine/flywheel/store";
import { decideLearningProposal, type HumanProposalDecision } from "@/lib/agent-engine/flywheel/promotion-queue";

export const dynamic = "force-dynamic";

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DECISIONS = new Set<HumanProposalDecision>(["approve", "reject", "request_revision"]);

const HTTP_BY_CODE: Record<ApplyProposalErrorCode, number> = {
  proposal_not_found: 404,
  proposal_already_applied: 409,
  proposal_not_reviewable: 409,
  proposal_type_unsupported: 422,
  agent_not_published: 422,
  publish_failed: 422,
  internal_error: 500,
};

type Ctx = { params: Promise<{ id: string; pid: string }> };

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  const requestId = randomUUID();
  const { id, pid } = await ctx.params;
  if (!UUID_RX.test(id) || !UUID_RX.test(pid)) {
    return fail("invalid_request", "id inválido.", 400, { requestId });
  }

  const authz = await requireRole("admin", { requestId, resource: "flywheel_proposals" });
  if (!authz.ok) return authz.response;
  const { user: authUser, org } = authz;
  const admin = createAdminClient();

  const body = (await req.json().catch(() => ({}))) as { decision?: string; reason?: string };
  const decision = (body.decision ?? "approve") as HumanProposalDecision;
  const reason = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : "reviewed_by_operator";
  if (!DECISIONS.has(decision)) {
    return fail("validation_failed", "Decisão inválida.", 422, { requestId });
  }

  if (decision !== "approve") {
    try {
      const proposal = await decideLearningProposal(createSupabaseLearningProposalStore(admin), {
        organizationId: org.orgId,
        agentId: id,
        proposalId: pid,
        userId: authUser.id,
        decision,
        reason,
      });
      await audit({
        action: decision === "reject" ? "ai.flywheel_proposal_rejected" : "ai.flywheel_proposal_revision_requested",
        actorUserId: authUser.id,
        organizationId: org.orgId,
        resourceType: "flywheel_distiller_proposals",
        resourceId: pid,
        metadata: { agent_id: id, reason },
      });
      return ok({ proposal_id: proposal.id, status: proposal.evidence.status }, { requestId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "flywheel_decision_failed";
      const status = message === "flywheel_proposal_scope_mismatch" ? 404 : 409;
      return fail(message, "A proposta não pode receber esta decisão.", status, { requestId });
    }
  }

  const result = await applyProposal(admin, {
    orgId: org.orgId,
    agentId: id,
    proposalId: pid,
    userId: authUser.id,
  });
  if (!result.ok) {
    return fail(result.code, result.message, HTTP_BY_CODE[result.code], { requestId });
  }

  if ("entryId" in result) {
    await audit({
      action: "ai.flywheel_proposal_applied",
      actorUserId: authUser.id,
      organizationId: org.orgId,
      resourceType: "flywheel_distiller_proposals",
      resourceId: pid,
      metadata: { agent_id: id, entry_id: result.entryId },
    });
    return ok({ entry_id: result.entryId }, { requestId });
  }

  if ("proposalId" in result) {
    await audit({
      action: "ai.flywheel_proposal_approved",
      actorUserId: authUser.id,
      organizationId: org.orgId,
      resourceType: "flywheel_distiller_proposals",
      resourceId: pid,
      metadata: { agent_id: id, rollout_pending: result.rolloutPending },
    });
    return ok({ proposal_id: result.proposalId, rollout_pending: result.rolloutPending }, { requestId });
  }

  await audit({
    action: result.rolloutPending ? "ai.flywheel_candidate_approved" : "ai.flywheel_proposal_applied",
    actorUserId: authUser.id,
    organizationId: org.orgId,
    resourceType: "flywheel_distiller_proposals",
    resourceId: pid,
    metadata: {
      agent_id: id,
      version_id: result.versionId,
      version_number: result.versionNumber,
      rollout_pending: result.rolloutPending ?? false,
    },
  });

  return ok(
    { version_id: result.versionId, version_number: result.versionNumber, rollout_pending: result.rolloutPending ?? false },
    { requestId },
  );
}
