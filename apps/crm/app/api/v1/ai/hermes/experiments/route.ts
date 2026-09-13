import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';

import { ok, fail } from '@/lib/api/wrappers';
import { requireRole } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { parseHermesReadQuery } from '@/lib/agent-engine/hermes/read-api';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole('manager', { requestId, resource: 'hermes_learning' });
  if (!authz.ok) return authz.response;

  let input;
  try {
    input = parseHermesReadQuery(req.nextUrl.searchParams);
  } catch (error) {
    return fail('validation_failed', 'Query inválida.', 422, {
      requestId,
      details: error instanceof Error ? error.message : 'hermes_read_query_invalid',
    });
  }

  const organizationId = authz.org.orgId;
  const db = await createClient();
  let query = db
    .from('hermes_research_experiments')
    .select('id, subject_kind, subject_id, context_fingerprint, goal, strategy, metric_name, baseline_value, observed_value, score, status, evidence_refs, metadata, source_version, supersedes_id, created_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(input.limit);
  if (input.status) query = query.eq('status', input.status);
  if (input.subject_kind) query = query.eq('subject_kind', input.subject_kind);
  if (input.subject_id) query = query.eq('subject_id', input.subject_id);

  const { data, error } = await query;
  if (error) return fail('internal_error', 'Falha ao carregar experimentos Hermes.', 500, { requestId });

  return ok({ organization_id: organizationId, items: data ?? [] }, { requestId });
}
