import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { rankPriorEvidence } from '../hermes/retrieval';
import type { ResearchExperimentRecord } from '../hermes/research-memory';

const experiment = (organizationId: string): ResearchExperimentRecord => ({
  id: `exp-${organizationId}`,
  organizationId,
  subjectKind: 'agent',
  subjectId: 'sales',
  contextFingerprint: 'fp',
  goal: 'improve conversion',
  strategy: 'prompt',
  metricName: 'conversion',
  baselineValue: 0.2,
  observedValue: 0.3,
  score: 1,
  status: 'keep',
  evidenceRefs: ['synthetic'],
  metadata: {},
  sourceVersion: null,
  supersedesId: null,
  createdAt: '2026-09-13T00:00:00.000Z',
});

describe('Hermes tenant boundaries', () => {
  it('never retrieves evidence from another organization', () => {
    const results = rankPriorEvidence(
      { organizationId: 'org-a', contextFingerprint: 'fp', goal: 'improve conversion', metricName: 'conversion' },
      [experiment('org-a'), experiment('org-b')],
    );
    expect(results.map((row) => row.record.organizationId)).toEqual(['org-a']);
  });

  it('keeps explicit organization filters in every service-role-capable store', () => {
    const files = ['research-memory.ts', 'outcome-ledger.ts'];
    for (const file of files) {
      const content = readFileSync(resolve(process.cwd(), `lib/agent-engine/hermes/${file}`), 'utf8');
      expect(content).toContain(".eq('organization_id', input.organizationId)");
    }
  });
});
