/**
 * GET /api/v1/ai/workflows/proposals/:id — Fetch workflow run detail.
 *
 * Authentication: manager+ (RBAC via `requireRole`) — matches `ai_workflow_runs`'s
 * own RLS policy (manager+ for both read and write, migration 0119; there is no
 * "creator" carve-out below manager in the RLS contract, so the route matches it).
 *
 * Cross-tenant attempt returns 404 (not leaking run existence) — enforced by
 * filtering `organization_id` explicitly in addition to RLS.
 * Sanitizes response: excludes `side_effect_key`/`thread_id` (internal
 * idempotency/checkpoint join keys — no business being client-visible).
 */
import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

const DETAIL_COLUMNS =
  "id, status, contact_id, conversation_id, lead_id, draft_payload, decision_payload, sent_message_id, followup_id, last_error_code, created_at, updated_at, decided_at";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "ai_workflow_runs" });
  if (!authz.ok) return authz.response;
  const { org: activeOrg } = authz;

  const supabase = await createClient();
  const { data: run, error } = await supabase
    .from("ai_workflow_runs")
    .select(DETAIL_COLUMNS)
    .eq("id", params.id)
    .eq("organization_id", activeOrg.orgId)
    .maybeSingle();

  if (error) return fail("internal_error", error.message, 500, { requestId });
  if (!run) return fail("not_found", "Workflow run não encontrado.", 404, { requestId });

  return ok(run, { requestId });
}
