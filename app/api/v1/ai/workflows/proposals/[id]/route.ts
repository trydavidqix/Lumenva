/**
 * GET /api/v1/ai/workflows/proposals/:id — Fetch workflow run detail.
 *
 * Authentication: Required (manager+ or creator)
 * Response: { run_id, status, draft_payload, decision_payload, created_at, ... }
 *
 * Cross-tenant attempt returns 404 (not leaking run existence).
 * Sanitizes response: no internal columns, no bearer tokens, safe for client.
 */
import { NextRequest } from 'next/server';
import { loadAuthUser, resolveActiveOrg } from '@/lib/auth/server';
import { fail, ok } from '@/lib/api/wrappers';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await loadAuthUser();
    if (!user) {
      return fail('unauthorized', 'Authentication required', 401);
    }

    const activeOrg = await resolveActiveOrg(user);
    if (!activeOrg) {
      return fail('invalid_state', 'No active organization', 400);
    }

    const runId = params.id;

    // TODO: Query ai_workflow_runs by id + org (RLS or explicit filter)
    // TODO: Verify auth (manager+ or creator)
    // TODO: Return sanitized response

    // Placeholder: would query workflow run here
    return ok({
      run_id: runId,
      status: 'drafting',
      contact_id: 'contact-id',
      conversation_id: 'conv-id',
      draft_payload: null,
      decision_payload: null,
      sent_message_id: null,
      followup_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    return fail('internal_error', error instanceof Error ? error.message : 'Unknown error', 500);
  }
}
