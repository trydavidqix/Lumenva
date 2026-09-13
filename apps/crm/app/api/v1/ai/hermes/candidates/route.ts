import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';

import { ok, fail } from '@/lib/api/wrappers';
import { requireRole } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { parseHermesReadQuery } from '@/lib/agent-engine/hermes/read-api';
import { mapPhase6ProposalRow } from '@/lib/agent-engine/flywheel/store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole('manager', { requestId, resource: 'hermes_learning' });
  if (!authz.ok) return authz.response;

  let queryInput;
  try {
    queryInput = parseHermesReadQuery(req.nextUrl.searchParams);
  } catch (error) {
    return fail('validation_failed', 'Query inválida.', 422, {
      requestId,
      details: error instanceof Error ? error.message : 'hermes_read_query_invalid',
    });
  }

  const organizationId = authz.org.orgId;
  const db = await createClient();
  let query = db
    .from('flywheel_distiller_proposals')
    .select('id, organization_id, run_id, dataset, type, target, content, evidence, proposed_at, applied_at, applied_version_id, applied_by')
    .eq('organization_id', organizationId)
    .eq('dataset', 'agent_os_phase_6')
    .order('proposed_at', { ascending: false })
    .limit(queryInput.limit);
  if (queryInput.type) query = query.eq('type', queryInput.type);

  const { data, error } = await query;
  if (error) return fail('internal_error', 'Falha ao carregar candidatos Hermes.', 500, { requestId });

  const items = (data ?? []).flatMap((row) => {
    const phase6 = mapPhase6ProposalRow(row as never);
    if (!phase6) return [];
    if (queryInput.status && phase6.evidence.status !== queryInput.status) return [];
    return [{
      id: row.id,
      type: row.type,
      target: row.target,
      content: row.content,
      proposed_at: row.proposed_at,
      applied_at: row.applied_at,
      phase6,
    }];
  });

  return ok({ organization_id: organizationId, items, activation_endpoint: false }, { requestId });
}
