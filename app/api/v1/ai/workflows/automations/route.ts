/**
 * POST /api/v1/ai/workflows/automations — Create + schedule automation workflow run.
 * GET  /api/v1/ai/workflows/automations — List workflow runs for the active org.
 *
 * Authentication: manager+ (RBAC via `requireRole`).
 * Feature gating: OFF → 404; SHADOW → schedule only; ON/CANARY → execute.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveAiPlatformFeature } from "@/lib/agent-engine/platform/features";
import { buildAutomationSchedulingGraph } from "@/lib/agent-engine/workflows/automation/graph";
import { getWorkflowDbPool, getWorkflowLlmCfg } from "@/lib/agent-engine/workflows/proposal/runtime";

export const dynamic = "force-dynamic";

const WORKFLOW_TYPE = "automation_scheduling" as const;

const createAutomationSchema = z.object({
  automation_id: z.string().uuid(),
});

interface InterruptedResult {
  __interrupt__?: unknown[];
}

export async function POST(request: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "ai_workflow_runs" });
  if (!authz.ok) return authz.response;
  const { user, org: activeOrg } = authz;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return fail("invalid_request", "Body JSON inválido.", 400, { requestId });
  }
  const parsed = createAutomationSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("validation_failed", "Campos inválidos.", 422, { requestId, details: parsed.error.flatten() });
  }
  const { automation_id } = parsed.data;

  const feature = await resolveAiPlatformFeature({
    organizationId: activeOrg.orgId,
    feature: "langgraph_automation_workflow",
  });
  if (feature.mode === "off") {
    return fail("not_found", "Workflow indisponível.", 404, { requestId });
  }

  const supabase = await createClient();

  const threadId = randomUUID();
  const sideEffectKey = `${WORKFLOW_TYPE}:${threadId}`;

  const { data: created, error: insertErr } = await supabase
    .from("ai_workflow_runs")
    .insert({
      organization_id: activeOrg.orgId,
      workflow_type: WORKFLOW_TYPE,
      thread_id: threadId,
      status: "drafted",
      side_effect_key: sideEffectKey,
      created_by: user.id,
    })
    .select("id, thread_id")
    .maybeSingle();
  if (insertErr) return fail("internal_error", insertErr.message, 500, { requestId });
  if (!created) return fail("internal_error", "Failed to create workflow run.", 500, { requestId });

  const db = getWorkflowDbPool();
  const admin = createAdminClient();
  const llmCfg = getWorkflowLlmCfg();
  const graph = buildAutomationSchedulingGraph();
  const config = { configurable: { thread_id: created.thread_id, db, supabase: admin, llmCfg } };

  let result: InterruptedResult;
  try {
    result = (await graph.invoke(
      { automationId: automation_id, organizationId: activeOrg.orgId },
      config,
    )) as InterruptedResult;
  } catch (error) {
    return fail("internal_error", error instanceof Error ? error.message : "workflow failed", 500, {
      requestId,
    });
  }

  const pausedForApproval = Boolean(result.__interrupt__ && result.__interrupt__.length > 0);
  if (pausedForApproval) {
    await supabase
      .from("ai_workflow_runs")
      .update({ status: "awaiting_approval" })
      .eq("id", created.id)
      .eq("organization_id", activeOrg.orgId);
  }

  void audit({
    action: "workflow.created",
    actorUserId: user.id,
    organizationId: activeOrg.orgId,
    resourceType: "ai_workflow_run",
    resourceId: created.id,
    requestId,
    metadata: { workflow_type: WORKFLOW_TYPE, mode: feature.mode },
  });

  return ok(
    { run_id: created.id, status: pausedForApproval ? "awaiting_approval" : "drafted" },
    { requestId },
  );
}

export async function GET(request: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", { requestId, resource: "ai_workflow_runs" });
  if (!authz.ok) return authz.response;
  const { org: activeOrg } = authz;

  const supabase = await createClient();

  const { data: runs, error: err } = await supabase
    .from("ai_workflow_runs")
    .select("id, workflow_type, status, created_at")
    .eq("organization_id", activeOrg.orgId)
    .eq("workflow_type", WORKFLOW_TYPE)
    .order("created_at", { ascending: false })
    .limit(20);

  if (err) return fail("internal_error", err.message, 500, { requestId });

  return ok({ data: runs ?? [], meta: { requestId } });
}
