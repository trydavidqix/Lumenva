import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { saveArtifact, linkEvidence, progressFromCriteria, loadArtifact } from '../src/evidence.mjs';

const root = await mkdtemp(join(tmpdir(), 'mcg-evidence-'));
try {
  const artifact = await saveArtifact(root, { task_id: 't1', type: 'test-result', content: 'PASS' });
  assert.equal((await loadArtifact(root, artifact.artifact_id)).hash.length, 64);
  await linkEvidence(root, 'task completed', [`artifact://${artifact.artifact_id}`]);
  const progress = progressFromCriteria([{ id: 'a', status: 'PASS', evidence: artifact.artifact_id }, { id: 'b', status: 'BLOCKED' }]);
  assert.equal(progress.progress_percent, 50); assert.equal(progress.criteria_blocked, 1); assert.equal(progress.evidence_coverage, '50.00');
} finally { await rm(root, { recursive: true, force: true }); }
console.log('evidence tests: 1 passed');
