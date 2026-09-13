import { describe, expect, it } from 'vitest';

import { createInMemoryResearchMemoryStore, type ResearchExperimentRecord } from '../hermes/research-memory';

const record = (overrides: Partial<ResearchExperimentRecord> = {}): ResearchExperimentRecord => ({
  id: 'exp-1',
  organizationId: 'org-a',
  subjectKind: 'agent',
  subjectId: 'sales-agent',
  contextFingerprint: 'fp-1',
  goal: 'improve conversion',
  strategy: 'prompt-v2',
  metricName: 'conversion',
  baselineValue: 0.2,
  observedValue: 0.24,
  score: 0.8,
  status: 'keep',
  evidenceRefs: ['run:1'],
  metadata: {},
  sourceVersion: 'v1',
  supersedesId: null,
  createdAt: '2026-09-13T12:00:00.000Z',
  ...overrides,
});

describe('Hermes research memory', () => {
  it('stores append-only experiment history and filters by tenant', async () => {
    const store = createInMemoryResearchMemoryStore();
    await store.append(record());
    await store.append(record({ id: 'exp-b', organizationId: 'org-b' }));

    const rows = await store.listBySubject({ organizationId: 'org-a', subjectKind: 'agent', subjectId: 'sales-agent' });
    expect(rows.map((row) => row.id)).toEqual(['exp-1']);
  });

  it('supersedes by appending a new record instead of mutating history', async () => {
    const store = createInMemoryResearchMemoryStore();
    await store.append(record());
    const replacement = {
      ...record({ id: 'exp-2', strategy: 'prompt-v3', createdAt: '2026-09-13T13:00:00.000Z' }),
      supersedesId: 'exp-1',
    };
    await store.supersede(replacement);

    const rows = await store.listBySubject({ organizationId: 'org-a', subjectKind: 'agent', subjectId: 'sales-agent' });
    expect(rows).toHaveLength(2);
    expect(rows[0]?.supersedesId).toBe('exp-1');
    expect(rows[1]?.strategy).toBe('prompt-v2');
  });
});
