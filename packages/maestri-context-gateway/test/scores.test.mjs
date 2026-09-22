import assert from 'node:assert/strict';
import { efficiencyScore, regressionWatch } from '../src/scores.mjs';

assert.equal(efficiencyScore({ real_token_saving: 30, task_success: 100, context_retention: 100, evidence_grounding: 100, hallucination_rate: 0 }).status, 'MEASURED');
assert.equal(efficiencyScore({}).status, 'UNVALIDATED');
assert.equal(regressionWatch({ task_success: 100, total_tokens: 100 }, { task_success: 95, total_tokens: 110 }).status, 'REGRESSION_DETECTED');
console.log('score tests: 1 passed');
