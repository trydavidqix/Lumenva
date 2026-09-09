/**
 * POST /api/v1/ai/workflows/proposals/:id/decision — Manager approval decision.
 *
 * Authentication: manager+ (RBAC via `requireRole` — Task 1, Phase 8 Step 5).
 * Request: { decision: "approve" | "reject" | "edit", reason?, edited_draft_payload? }
 * Response: { run_id, status, updated_at }
 *
 * Feature gating (Task 1, Phase 8 Step 4):
 * - OFF → 404 (same as creation; the feature not existing hides the resource).
 * - SHADOW → decision is recorded, but the graph is NEVER resumed — resuming
 *   would run `send_once` for real. Shadow workflows record approve/reject/edit
 *   for comparison without ever reaching WAHA.
 * - ON/CANARY → resumes the real LangGraph interrupt via
 *   `graph.invoke(new Command({ resume: humanDecision }), config)`. A single
 *   resume call runs approve/reject through to completion (send_once ->
 *   schedule_followup -> completed); an edit re-pauses at a fresh interrupt.
 *
 * Idempotency / no double-decision: the decision is claimed via an atomic
 * conditional UPDATE (`status = 'awaiting_approval'`) before anything else
 * runs — a concurrent second decision on the same run gets `409 state_conflict`
 * instead of racing the graph resume.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { Command } from "@langchain/langgraph";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveAiPlatformFeature } from "@/lib/agent-engine/platform/features";
import { proposalDraftPayloadSchema } from "@/lib/workflows/commercial-proposal-graph";
import { createProposalApprovalGraph, type HumanDecision } from "@/lib/agent-engine/workflows/proposal/graph";
import { getWorkflowDbPool, getWorkflowLlmCfg } from "@/lib/agent-engine/workflows/proposal/runtime";

const decisionSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("approve"), reason: z.string().max(1000).optional() }),
  z.object({ decision: z.literal("reject"), reason: z.string().max(1000).optional() }),
  z.object({
    decision: z.literal("edit"),
    reason: z.string().max(1000).optional(),
    edited_draft_payload: proposalDraftPayloadSchema,
  }),
]);

interface InterruptibleResult {
  draft_payload: unknown;
  __interrupt__?: unknown[];
}

function auditActionFor(decision: "approve" | "reject" | "edit"): "workflow.approved" | "workflow.rejected" | "workflow.edited" {
  if (decision === "approve") return "workflow.approved";
  if (decision === "reject") return "workflow.rejected";
  return "workflow.edited";
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "ai_workflow_runs" });
  if (!authz.ok) return authz.response;
  const { user, org: activeOrg } = authz;

  const runId = params.id;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return fail("invalid_request", "Body JSON inválido.", 400, { requestId });
  }
  const parsed = decisionSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("validation_failed", "Campos inválidos.", 422, { requestId, details: parsed.error.flatten() });
  }
  const { decision, reason } = parsed.data;
  const editedDraftPayload = decision === "edit" ? parsed.data.edited_draft_payload : undefined;

  const supabase = await createClient();

  const { data: run, error: runErr } = await supabase
    .from("ai_workflow_runs")
    .select("id, organization_id, thread_id, status")
    .eq("id", runId)
    .eq("organization_id", activeOrg.orgId)
    .maybeSingle();
  if (runErr) return fail("internal_error", runErr.message, 500, { requestId });
  if (!run) return fail("not_found", "Workflow run não encontrado.", 404, { requestId }); // no cross-tenant leak

  const feature = await resolveAiPlatformFeature({
    organizationId: activeOrg.orgId,
    feature: "langgraph_proposal_workflow",
  });
  if (feature.mode === "off") {
    return fail("not_found", "Workflow indisponível.", 404, { requestId });
  }

  // Atomic claim: approve/reject are terminal (decided_by/decided_at record
  // who/when — required together by ai_workflow_runs_decision_coherence).
  // Edit is a loop-back, not final — decision_payload records the edit event,
  // decided_by/decided_at stay reserved for the eventual real verdict.
  const claimPatch =
    decision === "edit"
      ? { decision_payload: { decision, reason: reason ?? null, edited_at: new Date().toISOString() } }
      : {
          decided_by: user.id,
          decided_at: new Date().toISOString(),
          decision_payload: { decision, reason: reason ?? null },
        };

  const { data: claimed, error: claimErr } = await supabase
    .from("ai_workflow_runs")
    .update(claimPatch)
    .eq("id", runId)
    .eq("organization_id", activeOrg.orgId)
    .eq("status", "awaiting_approval")
    .select("id")
    .maybeSingle();
  if (claimErr) return fail("internal_error", claimErr.message, 500, { requestId });
  if (!claimed) {
    return fail(
      "state_conflict",
      "Decisão não pôde ser aplicada — workflow não está aguardando aprovação (corrida evitada ou já decidido).",
      409,
      { requestId },
    );
  }

  if (feature.mode === "shadow") {
    // SHADOW: record the decision, never resume the real graph (resuming
    // would run send_once for real) — the whole point of shadow mode.
    if (decision === "edit") {
      await supabase
        .from("ai_workflow_runs")
        .update({ status: "awaiting_approval", draft_payload: editedDraftPayload })
        .eq("id", runId)
        .eq("organization_id", activeOrg.orgId);
    } else {
      await supabase
        .from("ai_workflow_runs")
        .update({ status: decision === "reject" ? "rejected" : "completed" })
        .eq("id", runId)
        .eq("organization_id", activeOrg.orgId);
    }

    void audit({
      action: auditActionFor(decision),
      actorUserId: user.id,
      organizationId: activeOrg.orgId,
      resourceType: "ai_workflow_run",
      resourceId: runId,
      requestId,
      metadata: { mode: "shadow" },
    });

    const { data: shadowRun } = await supabase
      .from("ai_workflow_runs")
      .select("status, updated_at")
      .eq("id", runId)
      .eq("organization_id", activeOrg.orgId)
      .maybeSingle();

    return ok(
      { run_id: runId, status: shadowRun?.status ?? "unknown", updated_at: shadowRun?.updated_at ?? new Date().toISOString() },
      { requestId },
    );
  }

  // ON/CANARY — resume the real graph interrupt.
  const db = getWorkflowDbPool();
  const admin = createAdminClient();
  const llmCfg = getWorkflowLlmCfg();
  const graph = createProposalApprovalGraph(db);
  const config = { configurable: { thread_id: run.thread_id, db, supabase: admin, llmCfg } };

  const humanDecision: HumanDecision =
    decision === "edit" ? { decision, edited_draft_payload: editedDraftPayload } : { decision };

  let result: InterruptibleResult;
  try {
    result = (await graph.invoke(new Command({ resume: humanDecision }), config)) as InterruptibleResult;
  } catch (error) {
    return fail("internal_error", error instanceof Error ? error.message : "workflow resume failed", 500, {
      requestId,
    });
  }

  const pausedAgain = Boolean(result.__interrupt__ && result.__interrupt__.length > 0);
  if (pausedAgain) {
    // Edit loop: re-pausing at a fresh interrupt, not a terminal state yet.
    await supabase
      .from("ai_workflow_runs")
      .update({ status: "awaiting_approval", draft_payload: result.draft_payload })
      .eq("id", runId)
      .eq("organization_id", activeOrg.orgId);
  }

  const { data: updatedRun } = await supabase
    .from("ai_workflow_runs")
    .select("status, updated_at")
    .eq("id", runId)
    .eq("organization_id", activeOrg.orgId)
    .maybeSingle();

  void audit({
    action: auditActionFor(decision),
    actorUserId: user.id,
    organizationId: activeOrg.orgId,
    resourceType: "ai_workflow_run",
    resourceId: runId,
    requestId,
    metadata: { mode: feature.mode },
  });

  return ok(
    { run_id: runId, status: updatedRun?.status ?? "unknown", updated_at: updatedRun?.updated_at ?? new Date().toISOString() },
    { requestId },
  );
}
