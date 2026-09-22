import assert from 'node:assert/strict';
import { gradeContextRecall, gradeHallucinations, qualityPreservingSavings, trustScore } from '../src/evals.mjs';

const recall = gradeContextRecall('DB_PRIMARY_REGION = us-central1\nDEPLOY_POLICY = no-deploy-without-owner', 'DB_PRIMARY_REGION is us-central1. DEPLOY_POLICY is no-deploy-without-owner.');
assert.equal(recall.recall, 100);
assert.equal(recall.measurement_type, 'exact');
assert.equal(gradeHallucinations('What is the CEO birthday?', 'Não há evidência suficiente.').classification, 'MISSING_EVIDENCE');
assert.equal(gradeHallucinations('What is the CEO birthday?', 'The CEO birthday is January 1.').classification, 'HALLUCINATED');
const saving = qualityPreservingSavings({ task_success: true, context_recall: 100, evidence_grounding: 100, hallucination_rate: 0, total_tokens: 100 }, { task_success: true, context_recall: 100, evidence_grounding: 100, hallucination_rate: 0, total_tokens: 70 });
assert.equal(saving.qualified, true);
assert.equal(saving.percent, 30);
assert.equal(trustScore({ baseline: { task_success: 100, total_tokens: 100, real_executor: true }, mcg: { task_success: 100, total_tokens: 70, real_executor: true }, context_recall: 100, evidence_grounding: 100, hallucination_rate: 0, dataset_size: 30 }).status, 'VALIDATED');
console.log('eval tests: 1 passed');
