import assert from 'node:assert/strict';
import { evaluateRollout } from './rollout-gate.mjs';

assert.deepEqual(evaluateRollout({ branch: 'vps', target: 'vps', production: false, dirty: false }), {
  status: 'READY_FOR_VPS',
  blockers: [],
  target: 'vps',
});
assert.deepEqual(evaluateRollout({ branch: 'main', target: 'vps', production: false, dirty: false }).status, 'BLOCKED');
assert.deepEqual(evaluateRollout({ branch: 'vps', target: 'production', production: true, dirty: false }).blockers, ['production_disabled', 'target_must_be_vps']);
assert.deepEqual(evaluateRollout({ branch: 'vps', target: 'vps', production: false, dirty: true }).blockers, ['dirty_worktree']);
console.log('rollout gate tests: 1 passed');
