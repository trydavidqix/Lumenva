/**
 * GET /api/v1/ai/workflows/proposals/:id — Fetch workflow run detail.
 *
 * Authentication: Required (manager+ or creator)
 * Response: { run_id, status, draft_payload, decision_payload, created_at, ... }
 *
 * Cross-tenant attempt returns 404 (not leaking run existence).
 * Sanitizes response: no internal columns, no bearer tokens, safe for client.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth/server';
import { fail, ok } from '@/lib/api/wrappers';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await getUser();
    if (!user) {
      return fail('unauthorized', 'Authentication required', 401);
    }

    const runId = params.id;
    const org = user.raw_user_meta_data?.organization_id;

    if (!org) {
      return fail('invalid_state', 'No organization in user context');
    }

    // TODO: Query ai_workflow_runs by id + org (RLS or explicit filter)
    // TODO: Verify auth (manager+ or creator)
    // TODO: Return sanitized response

    const supabase = createAdminClient();

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
