import { z } from 'zod';

import { createAdminClient } from '@/lib/supabase/admin';

import type {
  ApprovalRequest,
  ApprovalStatus,
  ApprovalStore,
} from '../policies/approval';

type DbError = { code?: string; message: string };
type DbResult<T> = { data: T | null; error: DbError | null };
type DbRow = Record<string, unknown>;

export interface ApprovalStoreQuery {
  select(columns?: string): ApprovalStoreQuery;
  eq(column: string, value: unknown): ApprovalStoreQuery;
  insert(values: Record<string, unknown>): ApprovalStoreQuery;
  upsert(values: Record<string, unknown>, options?: { onConflict?: string }): ApprovalStoreQuery;
  update(values: Record<string, unknown>): ApprovalStoreQuery;
  maybeSingle(): Promise<DbResult<DbRow>>;
}

export interface ApprovalStoreDatabase {
  from(table: string): ApprovalStoreQuery;
}

const approvalPayloadSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  runId: z.string().min(1),
  agentId: z.string().min(1),
  toolId: z.string().min(1),
  approvalType: z.string().min(1),
  idempotencyKey: z.string().min(1),
  reason: z.string().min(1),
  status: z.enum(['pending', 'approved', 'denied', 'executing', 'executed', 'expired', 'cancelled']),
  createdAt: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }).optional(),
  decidedAt: z.string().datetime({ offset: true }).optional(),
  decidedBy: z.string().optional(),
  decisionReason: z.string().optional(),
  cancelledAt: z.string().datetime({ offset: true }).optional(),
  cancelledBy: z.string().optional(),
  executedAt: z.string().datetime({ offset: true }).optional(),
});

function rowToApproval(row: DbRow): ApprovalRequest {
  const payload = approvalPayloadSchema.parse(row.payload);
  const status = row.status;
  if (typeof status !== 'string' || !approvalPayloadSchema.shape.status.options.includes(status as ApprovalStatus)) {
    throw new Error('approval_store_invalid_status');
  }
  return { ...payload, status: status as ApprovalStatus };
}

function failDatabase(error: DbError | null): never {
  throw new Error(`approval_store_database_error:${error?.code ?? 'unknown'}`);
}

export class SupabaseApprovalStore implements ApprovalStore {
  constructor(private readonly db: ApprovalStoreDatabase) {}

  async save(request: ApprovalRequest): Promise<void> {
    const result = await this.db
      .from('approval_requests')
      .upsert(
        {
          id: request.id,
          organization_id: request.organizationId,
          status: request.status,
          payload: request,
          created_at: request.createdAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      )
      .select('*')
      .maybeSingle();
    if (result.error) failDatabase(result.error);
  }

  async load(id: string): Promise<ApprovalRequest | null> {
    const result = await this.db
      .from('approval_requests')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (result.error) failDatabase(result.error);
    return result.data ? rowToApproval(result.data) : null;
  }

  async compareAndSet(
    id: string,
    expectedStatus: ApprovalStatus,
    next: ApprovalRequest,
  ): Promise<boolean> {
    const result = await this.db
      .from('approval_requests')
      .update({
        status: next.status,
        payload: next,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('status', expectedStatus)
      .select('*')
      .maybeSingle();
    if (result.error) failDatabase(result.error);
    if (!result.data) return false;
    rowToApproval(result.data);
    return true;
  }
}

export function createSupabaseApprovalStore(
  db: ApprovalStoreDatabase = createAdminClient() as unknown as ApprovalStoreDatabase,
): ApprovalStore {
  return new SupabaseApprovalStore(db);
}
