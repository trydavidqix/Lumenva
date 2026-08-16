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
import type { NextRequest } from 'next/server';
import { loadAuthUser, resolveActiveOrg } from '@/lib/auth/server';
import { fail, ok } from '@/lib/api/wrappers';
import { logger } from '@/lib/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // Auth: manager+
    const user = await loadAuthUser();
    if (!user) {
      return fail('unauthorized', 'Authentication required', 401);
    }

    const activeOrg = await resolveActiveOrg(user);
    if (!activeOrg) {
      return fail('invalid_state', 'No active organization', 400);
    }

    // TODO: Verify manager+ role

    const runId = params.id;
    const body = await request.json();
    const { decision, reason: _reason, body: _editBody } = body;

    if (!decision) {
      return fail('invalid_input', 'decision required (approve|reject|edit)', 400);
    }

    if (!['approve', 'reject', 'edit'].includes(decision)) {
      return fail('invalid_input', 'decision must be approve|reject|edit', 400);
    }

    // TODO: Implement resume logic
    // 1. Query ai_workflow_runs by id, verify org match
    // 2. Verify status is "awaiting_approval" (guard against double-decision)
    // 3. Check feature flag (OFF → reject, SHADOW → mock decision)
    // 4. Resume LangGraph with humanDecision input
    // 5. Update ai_workflow_runs.status + decision_payload
    // 6. Audit: workflow.{approved|rejected|edited}
    // 7. Return { run_id, status, updated_at }

    logger.info(`workflow.${decision} stub`, { org: activeOrg.orgId, run_id: runId, user_id: user.id });

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
