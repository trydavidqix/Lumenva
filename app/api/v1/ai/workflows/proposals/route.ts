/**
 * POST /api/v1/ai/workflows/proposals — Create proposal workflow run.
 *
 * Authentication: Required (manager+ role via RLS)
 * Request: { contact_id, conversation_id?, lead_id? }
 * Response: { run_id, thread_id, status }
 *
 * Server generates thread_id and side_effect_key (never from client).
 * Feature gating: OFF → 404, SHADOW → creates run but no approval/send, ON/CANARY → full workflow.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth/server';
import { fail, ok } from '@/lib/api/wrappers';
import { audit } from '@/lib/audit';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  try {
    // Auth: manager+
    const user = await getUser();
    if (!user) {
      return fail('unauthorized', 'Authentication required', 401);
    }

    // TODO: Verify manager+ role via user_organizations

    const body = await request.json();
    const { contact_id, conversation_id, lead_id } = body;

    if (!contact_id) {
      return fail('invalid_input', 'contact_id required');
    }

    // TODO: Implement createProposalWorkflowRun
    // 1. Verify contact/conversation/lead belong to user's org
    // 2. Check feature flag (OFF/SHADOW/ON/CANARY)
    // 3. Create ai_workflow_runs row (generatesuuidv4 thread_id server-side)
    // 4. Audit: workflow.created
    // 5. Return { run_id, thread_id, status }

    const supabase = createAdminClient();
    const org = user.raw_user_meta_data?.organization_id;

    if (!org) {
      return fail('invalid_state', 'No organization in user context');
    }

    // Placeholder: would call createProposalWorkflowRun here
    const runId = crypto.randomUUID();
    const threadId = crypto.randomUUID();

    await audit(supabase, {
      organization_id: org,
      action: 'workflow.created',
      resource_type: 'ai_workflow_runs',
      resource_id: runId,
      user_id: user.id,
      metadata: { contact_id },
    });

    return ok({
      run_id: runId,
      thread_id: threadId,
      status: 'drafting',
    });
  } catch (error) {
    return fail('internal_error', error instanceof Error ? error.message : 'Unknown error', 500);
  }
}

export async function GET(request: NextRequest) {
  // TODO: List workflow runs for active org
  // Filters: status (drafting, awaiting_approval, completed, rejected, failed)
  // Pagination: cursor-based
  return ok({ runs: [], cursor: null });
}
