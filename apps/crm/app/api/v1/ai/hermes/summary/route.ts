import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';

import { ok, fail } from '@/lib/api/wrappers';
import { requireRole } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { parseHermesReadQuery, phase6EvidenceStatus } from '@/lib/agent-engine/hermes/read-api';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole('manager', { requestId, resource: 'hermes_learning' });
  if (!authz.ok) return authz.response;

  try {
    parseHermesReadQuery(req.nextUrl.searchParams);
  } catch (error) {
    return fail('validation_failed', 'Query inválida.', 422, {
      requestId,
      details: error instanceof Error ? error.message : 'hermes_read_query_invalid',
    });
  }

  const organizationId = authz.org.orgId;
  const db = await createClient();
  const [candidateRows, experiments, outcomes, capabilities] = await Promise.all([
    db
      .from('flywheel_distiller_proposals')
      .select('id, evidence, applied_at')
      .eq('organization_id', organizationId)
      .eq('dataset', 'agent_os_phase_6')
      .order('proposed_at', { ascending: false })
      .limit(200),
    db.from('hermes_research_experiments').select('id, status', { count: 'exact' }).eq('organization_id', organizationId).limit(200),
    db.from('hermes_outcomes').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
    db.from('hermes_capability_identities').select('id, trust_status', { count: 'exact' }).eq('organization_id', organizationId).limit(200),
  ]);

  const firstError = [candidateRows.error, experiments.error, outcomes.error, capabilities.error].find(Boolean);
  if (firstError) {
    return fail('internal_error', 'Hermes Learning OS ainda não está disponível para leitura.', 500, { requestId });
  }

  const candidates = candidateRows.data ?? [];
  const experimentRows = experiments.data ?? [];
  const capabilityRows = capabilities.data ?? [];
  const statusCounts: Record<string, number> = {};
  for (const row of candidates) {
    const status = phase6EvidenceStatus(row.evidence) ?? (row.applied_at ? 'applied_legacy_state' : 'unknown');
    statusCounts[status] = (statusCounts[status] ?? 0) + 1;
  }

  return ok(
    {
      organization_id: organizationId,
      candidates: {
        total_loaded: candidates.length,
        by_status: statusCounts,
        ready_for_human_review: statusCounts.ready_for_human_review ?? 0,
      },
      experiments: {
        total: experiments.count ?? experimentRows.length,
        keep: experimentRows.filter((row) => row.status === 'keep').length,
        discard: experimentRows.filter((row) => row.status === 'discard').length,
        crash: experimentRows.filter((row) => row.status === 'crash').length,
        inconclusive: experimentRows.filter((row) => row.status === 'inconclusive').length,
      },
      outcomes: { total: outcomes.count ?? 0 },
      capabilities: {
        total: capabilities.count ?? capabilityRows.length,
        trusted: capabilityRows.filter((row) => row.trust_status === 'trusted').length,
        stale: capabilityRows.filter((row) => row.trust_status === 'stale').length,
        rejected: capabilityRows.filter((row) => row.trust_status === 'rejected').length,
      },
      activation_endpoint: false,
    },
    { requestId },
  );
}
