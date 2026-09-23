import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { aggregatePairedEvaluations, gradeContextRecall, gradeHallucinations, qualityPreservingSavings, saveEvaluation, trustScore } from '../src/evals.mjs';

const recall = gradeContextRecall('DB_PRIMARY_REGION = us-central1\nDEPLOY_POLICY = no-deploy-without-owner', 'DB_PRIMARY_REGION is us-central1. DEPLOY_POLICY is no-deploy-without-owner.');
assert.equal(recall.recall, 100);
assert.equal(recall.measurement_type, 'exact');
assert.equal(gradeContextRecall('ROUTER_RISK = R0-R4\nWORKTREE_MODE = isolated', 'R0-R4\nisolated').recall, 100);
assert.equal(gradeHallucinations('What is the CEO birthday?', 'Não há evidência suficiente.').classification, 'MISSING_EVIDENCE');
assert.equal(gradeHallucinations('What is the CEO birthday?', 'The CEO birthday is January 1.').classification, 'HALLUCINATED');
const saving = qualityPreservingSavings({ task_success: true, context_recall: 100, evidence_grounding: 100, hallucination_rate: 0, total_tokens: 100 }, { task_success: true, context_recall: 100, evidence_grounding: 100, hallucination_rate: 0, total_tokens: 70 });
assert.equal(saving.qualified, true);
assert.equal(saving.percent, 30);
assert.equal(qualityPreservingSavings({ task_success: 100, context_recall: 100, evidence_grounding: 100, hallucination_rate: 0, total_tokens: 100 }, { task_success: 100, context_recall: 100, evidence_grounding: 100, hallucination_rate: 0, total_tokens: 95 }).qualified, true);
assert.equal(trustScore({ baseline: { task_success: 100, total_tokens: 100, real_executor: true }, mcg: { task_success: 100, total_tokens: 70, real_executor: true }, context_recall: 100, evidence_grounding: 100, hallucination_rate: 0, dataset_size: 30 }).status, 'VALIDATED');
assert.equal(trustScore({ baseline: { task_success: 100, total_tokens: 100, real_executor: true }, mcg: { task_success: 100, total_tokens: 70, real_executor: true }, context_recall: 100, evidence_grounding: 100, hallucination_rate: 0, dataset_size: 1 }).status, 'VALIDATING');

const root = await mkdtemp(join(tmpdir(), 'mcg-evals-'));
try {
  for (let i = 0; i < 2; i++) {
    await saveEvaluation(root, {
      run_id: `pair-${i}`,
      kind: 'A/B',
      category: 'context-recall',
      baseline: { task_success: true, context_recall: 100, evidence_grounding: 100, hallucination_rate: 0, total_tokens: 100, real_executor: true, measurement_type: 'exact', model: null, effort: 'same', workspace: root },
      mcg: { task_success: true, context_recall: 100, evidence_grounding: 100, hallucination_rate: 0, total_tokens: 70, real_executor: true, measurement_type: 'exact', model: null, effort: 'same', workspace: root }
    });
  }
  await saveEvaluation(root, {
    run_id: 'pair-uncategorized',
    kind: 'A/B',
    baseline: { task_success: true, context_recall: 100, evidence_grounding: 100, hallucination_rate: 0, total_tokens: 100, real_executor: true, measurement_type: 'exact', model: null, effort: 'same', workspace: root },
    mcg: { task_success: true, context_recall: 100, evidence_grounding: 100, hallucination_rate: 0, total_tokens: 70, real_executor: true, measurement_type: 'exact', model: null, effort: 'same', workspace: root }
  });
  const aggregate = await aggregatePairedEvaluations(root);
  assert.equal(aggregate.dataset_size, 2);
  assert.deepEqual(aggregate.valid_run_ids, ['pair-0', 'pair-1']);
  assert.equal(aggregate.baseline.total_tokens, 200);
  assert.equal(aggregate.mcg.total_tokens, 140);
  assert.equal(aggregate.mcg.task_success, 100);
} finally {
  await rm(root, { recursive: true, force: true });
}
console.log('eval tests: 1 passed');
