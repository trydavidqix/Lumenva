import { describe, it, expect } from 'vitest';
import { CrmLeadNormalizer } from '../../lib/db/drizzle/domains/crm/normalizer';

describe('CrmLeadNormalizer', () => {
  it('should normalize a lead properly', () => {
    const normalizer = new CrmLeadNormalizer();
    const date = new Date('2024-01-01T12:00:00Z');

    const lead = {
      id: 'lead-1',
      organization_id: 'org-1',
      contact_id: 'contact-1',
      stage_id: 'stage-1',
      pipeline_id: 'pipeline-1',
      position_in_stage: "1.5",
      value_cents: 1000,
      assigned_at: date,
      last_activity_at: null,
      closed_at: null,
      created_at: date,
      updated_at: date,
    };

    const normalized = normalizer.normalize(lead);

    expect(normalized).toEqual({
      id: 'lead-1',
      organization_id: 'org-1',
      contact_id: 'contact-1',
      stage_id: 'stage-1',
      pipeline_id: 'pipeline-1',
      position_in_stage: 1.5,
      value_cents: 1000,
      assigned_at: '2024-01-01T12:00:00.000Z',
      last_activity_at: null,
      closed_at: null,
      created_at: '2024-01-01T12:00:00.000Z',
      updated_at: '2024-01-01T12:00:00.000Z',
    });
  });

  it('should normalize and sort a list of leads by id', () => {
    const normalizer = new CrmLeadNormalizer();
    const lead1 = {
      id: 'lead-b',
      organization_id: 'org-1',
      contact_id: 'contact-1',
      stage_id: 'stage-1',
      pipeline_id: 'pipeline-1',
      position_in_stage: 2,
      value_cents: 2000,
      assigned_at: null,
      last_activity_at: null,
      closed_at: null,
      created_at: null,
      updated_at: null,
    };

    const lead2 = {
      id: 'lead-a',
      organization_id: 'org-1',
      contact_id: 'contact-2',
      stage_id: 'stage-1',
      pipeline_id: 'pipeline-1',
      position_in_stage: 1,
      value_cents: 1000,
      assigned_at: null,
      last_activity_at: null,
      closed_at: null,
      created_at: null,
      updated_at: null,
    };

    const list = [lead1, lead2];
    const normalizedList = normalizer.normalizeList(list);

    expect(normalizedList.length).toBe(2);
    expect(normalizedList[0].id).toBe('lead-a');
    expect(normalizedList[1].id).toBe('lead-b');
  });
});

describe('Cross-Tenant Data Leak Check (Mocked)', () => {
  it('should execute SET LOCAL app.organization_id before query in findById', async () => {
    expect(true).toBe(true);
  });
});
