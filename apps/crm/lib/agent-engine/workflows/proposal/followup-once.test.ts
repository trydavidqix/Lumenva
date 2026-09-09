/**
 * Idempotent follow-up scheduling tests — Task 1 (Phase 8) real implementation.
 *
 * Uses a fake `pg.Pool.query` router (matched by SQL fragment) so the tests
 * exercise `scheduleFollowupOnce`'s decision logic — duplicate/skip guards,
 * org isolation, config-driven pointer resolution, live-enrollment conflict —
 * without a real database.
 */
import { describe, it, expect, vi } from 'vitest';
import type pg from 'pg';

import { scheduleFollowupOnce } from './followup-once';

const ORG_ID = 'org-1';
const RUN_ID = 'workflow-run-1';

const VALID_GRAPH = {
  nodes: [
    { id: 'n1', type: 'trigger', label: 'Início', position: { x: 0, y: 0 }, config: {} },
    { id: 'n2', type: 'end', label: 'Fim', position: { x: 1, y: 1 }, config: { outcome: 'converted' } },
  ],
  edges: [],
};

interface FakeDbOpts {
  run?: Record<string, unknown>;
  featureConfig?: Record<string, unknown> | null;
  pointer?: Record<string, unknown>;
  version?: Record<string, unknown>;
  insertThrows?: { code: string };
}

function fakeDb(opts: FakeDbOpts) {
  const query = vi.fn().mockImplementation((sql: string) => {
    if (sql.includes('from ai_workflow_runs') && sql.includes('select')) {
      return Promise.resolve({ rows: opts.run ? [opts.run] : [] });
    }
    if (sql.includes('from ai_platform_feature_flags')) {
      return Promise.resolve({ rows: opts.featureConfig !== undefined ? [{ config: opts.featureConfig }] : [] });
    }
    if (sql.includes('from followup_flow_pointers')) {
      return Promise.resolve({ rows: opts.pointer ? [opts.pointer] : [] });
    }
    if (sql.includes('from followup_flow_versions')) {
      return Promise.resolve({ rows: opts.version ? [opts.version] : [] });
    }
    if (sql.includes('insert into followup_enrollments')) {
      if (opts.insertThrows) {
        const err = new Error('duplicate') as Error & { code: string };
        err.code = opts.insertThrows.code;
        return Promise.reject(err);
      }
      return Promise.resolve({ rows: [{ id: 'enrollment-1' }] });
    }
    if (sql.includes('update ai_workflow_runs')) {
      return Promise.resolve({ rows: [] });
    }
    return Promise.resolve({ rows: [] });
  });
  return { query } as unknown as pg.Pool;
}

describe('scheduleFollowupOnce', () => {
  it('throws when the workflow run does not exist', async () => {
    const db = fakeDb({});
    await expect(scheduleFollowupOnce(RUN_ID, ORG_ID, db)).rejects.toThrow('not found');
  });

  it('throws on organization mismatch without scheduling', async () => {
    const db = fakeDb({
      run: { organization_id: 'other-org', status: 'sending', sent_message_id: 'm1', followup_id: null, contact_id: 'c1' },
    });
    await expect(scheduleFollowupOnce(RUN_ID, ORG_ID, db)).rejects.toThrow('organization mismatch');
  });

  it('resume returns existing followup, duplicate: true', async () => {
    const db = fakeDb({
      run: { organization_id: ORG_ID, status: 'completed', sent_message_id: 'm1', followup_id: 'fup-1', contact_id: 'c1' },
    });
    const result = await scheduleFollowupOnce(RUN_ID, ORG_ID, db);
    expect(result).toEqual({ followupId: 'fup-1', duplicate: true, skipped: false });
  });

  it('rejected workflow skips followup entirely', async () => {
    const db = fakeDb({
      run: { organization_id: ORG_ID, status: 'rejected', sent_message_id: null, followup_id: null, contact_id: 'c1' },
    });
    const result = await scheduleFollowupOnce(RUN_ID, ORG_ID, db);
    expect(result).toEqual({ followupId: null, duplicate: false, skipped: true });
  });

  it('send never happened (sent_message_id null): skip', async () => {
    const db = fakeDb({
      run: { organization_id: ORG_ID, status: 'failed', sent_message_id: null, followup_id: null, contact_id: 'c1' },
    });
    const result = await scheduleFollowupOnce(RUN_ID, ORG_ID, db);
    expect(result).toEqual({ followupId: null, duplicate: false, skipped: true });
  });

  it('no follow-up pointer configured for the org: skip (no invented default)', async () => {
    const db = fakeDb({
      run: { organization_id: ORG_ID, status: 'sending', sent_message_id: 'm1', followup_id: null, contact_id: 'c1' },
      featureConfig: {},
    });
    const result = await scheduleFollowupOnce(RUN_ID, ORG_ID, db);
    expect(result).toEqual({ followupId: null, duplicate: false, skipped: true });
  });

  it('pointer configured but not active: skip', async () => {
    const db = fakeDb({
      run: { organization_id: ORG_ID, status: 'sending', sent_message_id: 'm1', followup_id: null, contact_id: 'c1' },
      featureConfig: { followup_pointer_id: 'pointer-1' },
      pointer: { id: 'pointer-1', status: 'draft', active_version_id: null },
    });
    const result = await scheduleFollowupOnce(RUN_ID, ORG_ID, db);
    expect(result).toEqual({ followupId: null, duplicate: false, skipped: true });
  });

  it('enrolls the contact and persists followup_id when everything is configured', async () => {
    const db = fakeDb({
      run: { organization_id: ORG_ID, status: 'sending', sent_message_id: 'm1', followup_id: null, contact_id: 'c1' },
      featureConfig: { followup_pointer_id: 'pointer-1' },
      pointer: { id: 'pointer-1', status: 'active', active_version_id: 'version-1' },
      version: { graph: VALID_GRAPH },
    });
    const result = await scheduleFollowupOnce(RUN_ID, ORG_ID, db);
    expect(result).toEqual({ followupId: 'enrollment-1', duplicate: false, skipped: false });
  });

  it('contact already has a live enrollment on the pointer (23505): skip rather than steal it', async () => {
    const db = fakeDb({
      run: { organization_id: ORG_ID, status: 'sending', sent_message_id: 'm1', followup_id: null, contact_id: 'c1' },
      featureConfig: { followup_pointer_id: 'pointer-1' },
      pointer: { id: 'pointer-1', status: 'active', active_version_id: 'version-1' },
      version: { graph: VALID_GRAPH },
      insertThrows: { code: '23505' },
    });
    const result = await scheduleFollowupOnce(RUN_ID, ORG_ID, db);
    expect(result).toEqual({ followupId: null, duplicate: false, skipped: true });
  });

  it('a non-conflict DB error during insert propagates (not swallowed as a skip)', async () => {
    const db = fakeDb({
      run: { organization_id: ORG_ID, status: 'sending', sent_message_id: 'm1', followup_id: null, contact_id: 'c1' },
      featureConfig: { followup_pointer_id: 'pointer-1' },
      pointer: { id: 'pointer-1', status: 'active', active_version_id: 'version-1' },
      version: { graph: VALID_GRAPH },
      insertThrows: { code: '55000' },
    });
    await expect(scheduleFollowupOnce(RUN_ID, ORG_ID, db)).rejects.toThrow();
  });
});
