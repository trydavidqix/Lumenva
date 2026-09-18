/**
 * POST /api/v1/ai/workflows/automations/:id/decision — Manager approval decision.
 *
 * Feature gating: OFF → 404; SHADOW → record decision, no execute; ON/CANARY → graph.invoke().
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { Command } from "@langchain/langgraph";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import type { AuditAction } from "@/lib/audit/actions";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveAiPlatformFeature } from "@/lib/agent-engine/platform/features";
import { buildAutomationSchedulingGraph } from "@/lib/agent-engine/workflows/automation/graph";
import { getWorkflowDbPool, getWorkflowLlmCfg } from "@/lib/agent-engine/workflows/proposal/runtime";

const decisionSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("approve"), reason: z.string().max(1000).optional() }),
  z.object({ decision: z.literal("reject"), reason: z.string().max(1000).optional() }),
  z.object({ decision: z.literal("edit"), reason: z.string().max(1000).optional() }),
]);

function auditActionFor(decision: "approve" | "reject" | "edit"): AuditAction {
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

  const supabase = await createClient();

  const { data: run, error: runErr } = await supabase
    .from("ai_workflow_runs")
    .select("id, organization_id, thread_id, status")
    .eq("id", runId)
    .eq("organization_id", activeOrg.orgId)
    .maybeSingle();
  if (runErr) return fail("internal_error", runErr.message, 500, { requestId });
  if (!run) return fail("not_found", "Workflow run não encontrado.", 404, { requestId });

  const feature = await resolveAiPlatformFeature({
    organizationId: activeOrg.orgId,
    feature: "langgraph_automation_workflow",
  });
  if (feature.mode === "off") {
    return fail("not_found", "Workflow indisponível.", 404, { requestId });
  }

  const claimPatch = {
    decided_by: user.id,
    decided_at: new Date().toISOString(),
    decision_payload: { decision, reason: reason ?? null },
  };

  const { data: claimed } = await supabase
    .from("ai_workflow_runs")
    .update(claimPatch)
    .eq("id", runId)
    .eq("organization_id", activeOrg.orgId)
    .eq("status", "awaiting_approval")
    .select("id")
    .maybeSingle();

  if (!claimed) {
    return fail(
      "state_conflict",
      "Decisão não pôde ser aplicada — workflow não está aguardando aprovação.",
      409,
      { requestId },
    );
  }

  if (feature.mode === "shadow") {
    await supabase
      .from("ai_workflow_runs")
      .update({ status: decision === "reject" ? "rejected" : "completed" })
      .eq("id", runId)
      .eq("organization_id", activeOrg.orgId);

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

  const db = getWorkflowDbPool();
  const admin = createAdminClient();
  const llmCfg = getWorkflowLlmCfg();
  const graph = buildAutomationSchedulingGraph();
  const config = { configurable: { thread_id: run.thread_id, db, supabase: admin, llmCfg } };

  try {
    await graph.invoke(new Command({ resume: { decision } }), config);
  } catch (error) {
    return fail("internal_error", error instanceof Error ? error.message : "workflow resume failed", 500, {
      requestId,
    });
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
