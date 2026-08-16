/**
 * POST /api/v1/ai/workflows/proposals/:id/decision — Manager approval decision.
 *
 * Authentication: Required (manager+ role)
 * Request: { decision: "approve" | "reject" | "edit", ... }
 * Response: { run_id, status, updated_at }
 *
 * Routes to LangGraph graph resumption (humanDecision input).
 * Idempotency: second decision after completed returns 409 or accepted per spec.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth/server';
import { fail, ok } from '@/lib/api/wrappers';
import { audit } from '@/lib/audit';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // Auth: manager+
    const user = await getUser();
    if (!user) {
      return fail('unauthorized', 'Authentication required', 401);
    }

    // TODO: Verify manager+ role

    const runId = params.id;
    const body = await request.json();
    const { decision, reason, body: editBody } = body;

    if (!decision) {
      return fail('invalid_input', 'decision required (approve|reject|edit)');
    }

    if (!['approve', 'reject', 'edit'].includes(decision)) {
      return fail('invalid_input', 'decision must be approve|reject|edit');
    }

    const supabase = createAdminClient();
    const org = user.raw_user_meta_data?.organization_id;

    if (!org) {
      return fail('invalid_state', 'No organization in user context');
    }

    // TODO: Implement resume logic
    // 1. Query ai_workflow_runs by id, verify org match
    // 2. Verify status is "awaiting_approval" (guard against double-decision)
    // 3. Check feature flag (OFF → reject, SHADOW → mock decision)
    // 4. Resume LangGraph with humanDecision input
    // 5. Update ai_workflow_runs.status + decision_payload
    // 6. Audit: workflow.{approved|rejected|edited}
    // 7. Return { run_id, status, updated_at }

    await audit(supabase, {
      organization_id: org,
      action: `workflow.${decision}`,
      resource_type: 'ai_workflow_runs',
      resource_id: runId,
      user_id: user.id,
      metadata: { decision },
    });

    // Placeholder response
    return ok({
      run_id: runId,
      status: decision === 'reject' ? 'rejected' : 'approved',
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    return fail('internal_error', error instanceof Error ? error.message : 'Unknown error', 500);
  }
}
