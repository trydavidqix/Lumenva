/**
 * POST /api/v1/ai/workflows/proposals — Create + draft a proposal workflow run.
 * GET  /api/v1/ai/workflows/proposals — List workflow runs for the active org.
 *
 * Authentication: manager+ (RBAC via `requireRole` — the single authz helper,
 * `.claude/rules/security.md`). Also matches `ai_workflow_runs`'s own RLS
 * policy (manager+ for both read and write, migration 0119).
 *
 * Feature gating (Task 1, Phase 8 Step 4): OFF → 404 (no row created).
 * SHADOW/ON/CANARY both draft (load_context -> draft -> validate -> interrupt)
 * — the real SEND is gated later, at decision time, not here (SHADOW still
 * lets a manager review a draft; it just never reaches WAHA).
 *
 * `thread_id`/`side_effect_key` are generated server-side — never accepted
 * from the client (Phase 7/8 doctrine: thread_id is not client authority).
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
import { createProposalApprovalGraph } from "@/lib/agent-engine/workflows/proposal/graph";
import { getWorkflowDbPool, getWorkflowLlmCfg } from "@/lib/agent-engine/workflows/proposal/runtime";

export const dynamic = "force-dynamic";

const WORKFLOW_TYPE = "commercial_proposal" as const;

const createProposalSchema = z.object({
  contact_id: z.string().uuid(),
  conversation_id: z.string().uuid().optional(),
  lead_id: z.string().uuid().optional(),
});

interface InterruptedResult {
  error: { code: string; message: string } | null;
  draft_payload: unknown;
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
  const parsed = createProposalSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("validation_failed", "Campos inválidos.", 422, { requestId, details: parsed.error.flatten() });
  }
  const { contact_id, conversation_id, lead_id } = parsed.data;

  const feature = await resolveAiPlatformFeature({
    organizationId: activeOrg.orgId,
    feature: "langgraph_proposal_workflow",
  });
  if (feature.mode === "off") {
    return fail("not_found", "Workflow indisponível.", 404, { requestId });
  }

  const supabase = await createClient();

  const { data: contact, error: contactErr } = await supabase
    .from("contacts")
    .select("id")
    .eq("id", contact_id)
    .eq("organization_id", activeOrg.orgId)
    .maybeSingle();
  if (contactErr) return fail("internal_error", contactErr.message, 500, { requestId });
  if (!contact) return fail("not_found", "Contato não encontrado.", 404, { requestId });

  if (conversation_id) {
    const { data: conversation, error: convErr } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", conversation_id)
      .eq("organization_id", activeOrg.orgId)
      .maybeSingle();
    if (convErr) return fail("internal_error", convErr.message, 500, { requestId });
    if (!conversation) return fail("not_found", "Conversa não encontrada.", 404, { requestId });
  }

  if (lead_id) {
    const { data: lead, error: leadErr } = await supabase
      .from("crm_leads")
      .select("id")
      .eq("id", lead_id)
      .eq("organization_id", activeOrg.orgId)
      .maybeSingle();
    if (leadErr) return fail("internal_error", leadErr.message, 500, { requestId });
    if (!lead) return fail("not_found", "Lead não encontrado.", 404, { requestId });
  }

  const threadId = randomUUID();
  const sideEffectKey = `${WORKFLOW_TYPE}:${threadId}`;

  const { data: created, error: insertErr } = await supabase
    .from("ai_workflow_runs")
    .insert({
      organization_id: activeOrg.orgId,
      workflow_type: WORKFLOW_TYPE,
      thread_id: threadId,
      contact_id,
      conversation_id: conversation_id ?? null,
      lead_id: lead_id ?? null,
      status: "drafting",
      side_effect_key: sideEffectKey,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (insertErr || !created) {
    return fail("internal_error", insertErr?.message ?? "ai_workflow_runs_insert_failed", 500, { requestId });
  }

  void audit({
    action: "workflow.created",
    actorUserId: user.id,
    organizationId: activeOrg.orgId,
    resourceType: "ai_workflow_run",
    resourceId: created.id,
    requestId,
    metadata: { workflow_type: WORKFLOW_TYPE, thread_id: threadId, mode: feature.mode },
  });

  // Run the graph forward to the human-approval interrupt
  // (load_context -> draft -> validate -> await_human_decision). SHADOW still
  // drafts — only the downstream SEND is skipped, at decision time.
  const db = getWorkflowDbPool();
  const admin = createAdminClient();
  const llmCfg = getWorkflowLlmCfg();
  const graph = createProposalApprovalGraph(db);
  const config = { configurable: { thread_id: threadId, db, supabase: admin, llmCfg } };

  let finalStatus = "drafting";
  try {
    const result = (await graph.invoke(
      {
        organization_id: activeOrg.orgId,
        contact_id,
        lead_id: lead_id ?? null,
        conversation_id: conversation_id ?? null,
        workflow_run_id: created.id,
      },
      config,
    )) as InterruptedResult;

    if (result.error) {
      finalStatus = "failed";
      await supabase
        .from("ai_workflow_runs")
        .update({ status: "failed", last_error_code: result.error.code })
        .eq("id", created.id)
        .eq("organization_id", activeOrg.orgId);
    } else if (result.draft_payload) {
      finalStatus = "awaiting_approval";
      await supabase
        .from("ai_workflow_runs")
        .update({ status: "awaiting_approval", draft_payload: result.draft_payload })
        .eq("id", created.id)
        .eq("organization_id", activeOrg.orgId);
    }
  } catch {
    finalStatus = "failed";
    await supabase
      .from("ai_workflow_runs")
      .update({ status: "failed", last_error_code: "graph_invoke_failed" })
      .eq("id", created.id)
      .eq("organization_id", activeOrg.orgId);
  }

  return ok({ run_id: created.id, thread_id: threadId, status: finalStatus }, { requestId, status: 201 });
}

export async function GET(request: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "ai_workflow_runs" });
  if (!authz.ok) return authz.response;
  const { org: activeOrg } = authz;

  const statusFilter = request.nextUrl.searchParams.get("status");

  const supabase = await createClient();
  let query = supabase
    .from("ai_workflow_runs")
    .select("id, status, contact_id, conversation_id, lead_id, created_at, updated_at")
    .eq("organization_id", activeOrg.orgId)
    .eq("workflow_type", WORKFLOW_TYPE)
    .order("created_at", { ascending: false });
  if (statusFilter !== null) query = query.eq("status", statusFilter);

  const { data, error } = await query;
  if (error) return fail("internal_error", error.message, 500, { requestId });

  return ok({ runs: data ?? [], cursor: null }, { requestId });
}
