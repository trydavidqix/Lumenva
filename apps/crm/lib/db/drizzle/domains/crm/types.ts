export type TenantReadContext = {
  userId: string;
  organizationId: string;
  role: 'viewer' | 'agent' | 'manager' | 'admin';
  requestId: string;
};

export interface DomainRepository<Row, Filter, Create, Patch> {
  findById(ctx: TenantReadContext, id: string): Promise<Row | null>;
  list(ctx: TenantReadContext, filter: Filter): Promise<readonly Row[]>;
  insert(ctx: TenantReadContext, input: Create): Promise<Row>;
  update(ctx: TenantReadContext, id: string, patch: Patch): Promise<Row>;
  delete(ctx: TenantReadContext, id: string): Promise<void>;
}

export type CrmLead = {
  id: string;
  organization_id: string;
  contact_id: string | null;
  stage_id: string;
  pipeline_id: string;
  position_in_stage: string | number | null;
  value_cents: number | null;
  assigned_at: Date | string | null;
  last_activity_at: Date | string | null;
  closed_at: Date | string | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
};

export type CrmLeadFilter = {
  stageId?: string;
  contactId?: string;
  cursor?: string;
  limit?: number;
};
