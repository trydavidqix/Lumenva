import assert from 'node:assert/strict';
import { buildLanePrompt } from '../src/eval-runner.mjs';

const baseline = buildLanePrompt('baseline');
const mcg = buildLanePrompt('mcg');
assert.ok(baseline.length > mcg.length);
assert.match(baseline, /DB_PRIMARY_REGION/);
assert.match(mcg, /DB_PRIMARY_REGION/);
assert.match(baseline, /What is the CEO birthday/);
assert.match(mcg, /What is the CEO birthday/);
console.log('eval runner tests: 1 passed');
