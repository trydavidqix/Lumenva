/**
 * POST/GET /api/v1/ai/workflows/lead-scoring
 *
 * Lead scoring workflow API.
 * POST: Create new scoring run
 * GET: List runs (paginated)
 *
 * Phase 8 Task 5: Skeleton.
 */

import type { NextRequest } from 'next/server';
import { loadAuthUser, resolveActiveOrg } from '@/lib/auth/server';
import { fail, ok } from '@/lib/api/wrappers';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const user = await loadAuthUser();
    if (!user) {
      return fail('unauthorized', 'Authentication required', 401);
    }

    const activeOrg = await resolveActiveOrg(user);
    if (!activeOrg) {
      return fail('invalid_state', 'No active organization', 400);
    }

    // TODO Step 5.3: RBAC — viewer/agent can trigger
    // const ROLE_RANK = { viewer: 1, agent: 2, manager: 4, admin: 5 };
    // if (ROLE_RANK[activeOrg.role] < ROLE_RANK['agent']) {
    //   return fail('forbidden', 'Agent+ role required', 403);
    // }

    const body = await request.json();
    const { lead_id: leadId } = body;

    if (!leadId) {
      return fail('invalid_input', 'lead_id required', 400);
    }

    // TODO Step 5.2: Implement
    // 1. Query lead by leadId, verify org match
    // 2. Create ai_workflow_runs row (type='lead_scoring', lead_id, status='drafted')
    // 3. Invoke leadScoringGraph.stream()
    // 4. Return { run_id, status, created_at }

    logger.info('workflow.lead_scoring.created stub', {
      org: activeOrg.orgId,
      lead_id: leadId,
      user_id: user.id,
    });

    return ok({
      run_id: `lead-score-${Date.now()}`,
      status: 'drafted',
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    return fail('internal_error', error instanceof Error ? error.message : 'Unknown error', 500);
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await loadAuthUser();
    if (!user) {
      return fail('unauthorized', 'Authentication required', 401);
    }

    const activeOrg = await resolveActiveOrg(user);
    if (!activeOrg) {
      return fail('invalid_state', 'No active organization', 400);
    }

    // TODO: Query ai_workflow_runs by org, type='lead_scoring'
    // Paginate by created_at cursor
    // Return { data: [...], meta: { cursor, has_more } }

    return ok({
      data: [],
      meta: { cursor: null, has_more: false },
    });
  } catch (error) {
    return fail('internal_error', error instanceof Error ? error.message : 'Unknown error', 500);
  }
}
