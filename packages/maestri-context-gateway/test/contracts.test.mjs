import assert from 'node:assert/strict';
import { normalizeLegacy, validateContract } from '../src/contracts.mjs';

assert.equal(validateContract('trace', { trace_id: 'tr-1', timestamp: new Date().toISOString(), source: 'test' }).valid, true);
assert.equal(validateContract('trace', { timestamp: new Date().toISOString() }).valid, false);
const legacy = normalizeLegacy({ task_id: 'old-1', executor: 'codex', internal_state: 'DONE' }, 'task');
assert.equal(legacy.task_id, 'old-1');
assert.equal(legacy.status, 'completed');
assert.equal(legacy.measurement_type, 'unavailable');
console.log('contract tests: 1 passed');
