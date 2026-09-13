import { describe, expect, it } from 'vitest';

import {
  businessKpiCanBypassSafety,
  summarizeOutcomeDelta,
  type HermesOutcomeStore,
} from '../hermes/outcome-ledger';
import { mirrorFollowupOutcomesToHermes } from '../flywheel/outcome-collector';

describe('Hermes outcome ledger', () => {
  it('connects technical, cost, latency and business KPI deltas', () => {
    expect(
      summarizeOutcomeDelta(
        { technicalQuality: 0.8, costCents: 100, latencyMs: 500, kpiValue: 0.2 },
        { technicalQuality: 0.9, costCents: 80, latencyMs: 450, kpiValue: 0.25 },
      ),
    ).toEqual({
      qualityDelta: 0.09999999999999998,
      costDeltaCents: -20,
      latencyDeltaMs: -50,
      kpiDelta: 0.04999999999999999,
    });
  });

  it('never allows a KPI gain to bypass safety gates', () => {
    expect(businessKpiCanBypassSafety()).toBe(false);
  });

  it('mirrors legacy follow-up aggregates after the compatibility write boundary', async () => {
    const appended: Array<{ organizationId: string; subjectId: string; kpiObserved: number | null }> = [];
    const store: HermesOutcomeStore = {
      async append(record) {
        appended.push({
          organizationId: record.organizationId,
          subjectId: record.subjectId,
          kpiObserved: record.kpiObserved,
        });
      },
      async listForSubject() {
        return [];
      },
    };

    const result = await mirrorFollowupOutcomesToHermes(
      {
        run_id: 'run-1',
        organization_id: 'org-a',
        outcomes: { converted: 2, replied: 1 },
        recorded_at: '2026-09-13T13:30:00.000Z',
      },
      { store, idFactory: () => 'outcome-id' },
    );

    expect(result).toEqual({ attempted: 2, mirrored: 2, errors: [] });
    expect(appended).toEqual([
      { organizationId: 'org-a', subjectId: 'converted', kpiObserved: 2 },
      { organizationId: 'org-a', subjectId: 'replied', kpiObserved: 1 },
    ]);
  });

  it('makes mirror failure visible without turning the legacy result into failure', async () => {
    let calls = 0;
    const store: HermesOutcomeStore = {
      async append() {
        calls += 1;
        if (calls === 1) throw new Error('mirror unavailable');
      },
      async listForSubject() {
        return [];
      },
    };

    const result = await mirrorFollowupOutcomesToHermes(
      {
        run_id: 'run-2',
        organization_id: 'org-a',
        outcomes: { converted: 1, replied: 3 },
        recorded_at: '2026-09-13T13:31:00.000Z',
      },
      { store, idFactory: () => 'outcome-id' },
    );

    expect(result.attempted).toBe(2);
    expect(result.mirrored).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('mirror unavailable');
  });
});
