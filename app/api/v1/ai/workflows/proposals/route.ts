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
import { NextRequest } from 'next/server';
import { loadAuthUser, resolveActiveOrg } from '@/lib/auth/server';
import { fail, ok } from '@/lib/api/wrappers';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
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

    // TODO: Verify manager+ role via user_organizations

    const body = await request.json();
    const { contact_id, conversation_id, lead_id } = body;

    if (!contact_id) {
      return fail('invalid_input', 'contact_id required', 400);
    }

    // TODO: Implement createProposalWorkflowRun
    // 1. Verify contact/conversation/lead belong to activeOrg
    // 2. Check feature flag (OFF/SHADOW/ON/CANARY)
    // 3. Create ai_workflow_runs row (generatesuuidv4 thread_id server-side)
    // 4. Audit: workflow.created
    // 5. Return { run_id, thread_id, status }

    // Placeholder: would call createProposalWorkflowRun here
    const runId = crypto.randomUUID();
    const threadId = crypto.randomUUID();

    logger.info('workflow.created stub', { org: activeOrg.orgId, user_id: user.id, run_id: runId });

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
