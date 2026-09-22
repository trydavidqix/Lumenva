import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileHistoryStore, HISTORY_TYPES } from '../src/history/store.mjs';

const root = await mkdtemp(join(tmpdir(), 'mcg-history-'));
try {
  const store = new FileHistoryStore(root);
  for (const type of HISTORY_TYPES) {
    await store.append(type, {
      source: `test.${type}`,
      measurement_type: type === 'telemetry' ? 'exact' : 'estimated',
      total_tokens: type === 'usage' ? 12 : undefined,
      provenance: { fixture: true }
    });
  }
  assert.equal((await store.listAvailableTypes()).length, HISTORY_TYPES.length);
  assert.equal((await store.query('telemetry', { period: 'Today' })).length, 1);
  assert.equal((await store.query('telemetry', { period: '7d' })).length, 1);
  assert.equal((await store.query('telemetry', { period: '30d' })).length, 1);
  assert.equal((await store.query('telemetry', { period: 'All time' })).length, 1);
  const rollup = await store.rollupDaily('usage');
  assert.equal(rollup.records, 1);
  assert.equal(rollup.total_tokens, 12);
  const safe = await store.append('telemetry', { source: 'secret-test', api_key: 'do-not-store', total_tokens: 5, measurement_type: 'exact' });
  assert.equal(safe.data.api_key, '[REDACTED]');
  assert.equal(safe.data.total_tokens, 5);
} finally {
  await rm(root, { recursive: true, force: true });
}
console.log('history store tests: 1 passed');
