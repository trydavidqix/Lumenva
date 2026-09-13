import { z } from 'zod';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  status: z.string().trim().min(1).max(64).optional(),
  type: z.string().trim().min(1).max(64).optional(),
  subject_kind: z.string().trim().min(1).max(64).optional(),
  subject_id: z.string().trim().min(1).max(160).optional(),
});

export type HermesReadQuery = z.infer<typeof querySchema>;

/** Tenant scope always comes from the validated session, never from query input. */
export function parseHermesReadQuery(params: URLSearchParams): HermesReadQuery {
  if (
    params.has('organization_id') ||
    params.has('organizationId') ||
    params.has('tenant_id') ||
    params.has('tenantId')
  ) {
    throw new Error('hermes_tenant_override_forbidden');
  }
  const parsed = querySchema.safeParse(Object.fromEntries(params.entries()));
  if (!parsed.success) throw new Error('hermes_read_query_invalid');
  return parsed.data;
}

export function phase6EvidenceStatus(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const phase6 = (value as Record<string, unknown>).phase6;
  if (!phase6 || typeof phase6 !== 'object' || Array.isArray(phase6)) return null;
  const status = (phase6 as Record<string, unknown>).status;
  return typeof status === 'string' ? status : null;
}
