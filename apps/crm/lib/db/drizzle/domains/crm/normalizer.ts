import { CrmLead } from './types';

// Canonical version we can compare against the Supabase legacy response.
// We keep fields in snake_case and dates in ISO format.
export type CanonicalCrmLead = {
  id: string;
  organization_id: string;
  contact_id: string | null;
  stage_id: string;
  pipeline_id: string;
  position_in_stage: number | null;
  value_cents: number | null;
  assigned_at: string | null;
  last_activity_at: string | null;
  closed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export class CrmLeadNormalizer {
  public normalize(row: CrmLead | null): CanonicalCrmLead | null {
    if (!row) return null;

    // F6 F7 F8 rule: converte timestamp para UTC ISO
    // normalizes money to cents

    return {
      id: row.id,
      organization_id: row.organization_id,
      contact_id: row.contact_id || null, // Convert undefined to null for consistency
      stage_id: row.stage_id,
      pipeline_id: row.pipeline_id,
      position_in_stage: row.position_in_stage !== null ? Number(row.position_in_stage) : null,
      value_cents: row.value_cents ?? null,
      assigned_at: this.normalizeDate(row.assigned_at),
      last_activity_at: this.normalizeDate(row.last_activity_at),
      closed_at: this.normalizeDate(row.closed_at),
      created_at: this.normalizeDate(row.created_at),
      updated_at: this.normalizeDate(row.updated_at),
    };
  }

  public normalizeList(rows: readonly CrmLead[]): CanonicalCrmLead[] {
    // Normalizes and orders the list by a stable key (e.g. ID)
    // per F6 Normalization rules: "ordena listas por chave estável"
    return rows
      .map((row) => this.normalize(row) as CanonicalCrmLead)
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  private normalizeDate(dateVal: Date | string | null): string | null {
    if (!dateVal) return null;
    if (typeof dateVal === 'string') {
      return new Date(dateVal).toISOString();
    }
    return dateVal.toISOString();
  }
}
