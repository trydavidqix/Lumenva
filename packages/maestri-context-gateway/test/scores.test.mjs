import assert from 'node:assert/strict';
import { efficiencyScore, regressionWatch } from '../src/scores.mjs';

assert.equal(efficiencyScore({ real_token_saving: 30, task_success: 100, context_retention: 100, evidence_grounding: 100, hallucination_rate: 0, dataset_size: 1 }).status, 'VALIDATING');
assert.equal(efficiencyScore({ real_token_saving: 30, task_success: 100, context_retention: 100, evidence_grounding: 100, hallucination_rate: 0, dataset_size: 30 }).status, 'VALIDATED');
assert.equal(efficiencyScore({}).status, 'UNVALIDATED');
assert.equal(regressionWatch({ task_success: 100, total_tokens: 100 }, { task_success: 95, total_tokens: 110 }, { dataset_size: 1 }).status, 'UNVALIDATED');
assert.equal(regressionWatch({ task_success: 100, total_tokens: 100 }, { task_success: 95, total_tokens: 110 }, { dataset_size: 30 }).status, 'REGRESSION_DETECTED');
assert.equal(regressionWatch({ task_success: 100, total_tokens: 100 }, { task_success: 100, total_tokens: 90 }, { dataset_size: 30 }).status, 'NO_REGRESSION');
console.log('score tests: 1 passed');
