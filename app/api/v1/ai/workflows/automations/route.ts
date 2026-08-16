/**
 * POST/GET /api/v1/ai/workflows/automations
 *
 * Automation scheduling workflow API.
 * POST: Create new automation run
 * GET: List runs (paginated)
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

    // TODO Step 4.3: RBAC — manager+ creates
    // const ROLE_RANK = { viewer: 1, agent: 2, manager: 4, admin: 5 };
    // if (ROLE_RANK[activeOrg.role] < ROLE_RANK['manager']) {
    //   return fail('forbidden', 'Manager+ role required', 403);
    // }

    const body = await request.json();
    const { automation_id: automationId } = body;

    if (!automationId) {
      return fail('invalid_input', 'automation_id required', 400);
    }

    // TODO Step 4.2: Implement
    // 1. Query automation by automationId, verify org match
    // 2. Create ai_workflow_runs row (type='automation_scheduling', automation_id, status='drafted')
    // 3. Invoke automationSchedulingGraph.stream()
    // 4. Return { run_id, status, created_at }

    logger.info('workflow.automation_scheduling.created stub', {
      org: activeOrg.orgId,
      automation_id: automationId,
      user_id: user.id,
    });

    return ok({
      run_id: `auto-sched-${Date.now()}`,
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

    // TODO: Query ai_workflow_runs by org, type='automation_scheduling'
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
