import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildCodexArgs, buildLanePrompt, runValidationSuite, selectValidationCases } from '../src/eval-runner.mjs';
import { saveEvaluation } from '../src/evals.mjs';
const sample={id:'x',category:'context-recall',evidence:'A = one\nB = two',question:'Report values.',no_evidence_question:'Unknown?',expected_contains:['one','two'],archive_lines:20,tools:[]};
assert.ok(buildLanePrompt('baseline',sample).length>buildLanePrompt('mcg',sample).length);
assert.match(buildLanePrompt('mcg',sample),/A = one/);
assert.match(buildLanePrompt('mcg',sample),/Use the evidence above as authoritative/);
const args = buildCodexArgs({ model: 'gpt-5.6', effort: 'medium', workspace: '/tmp/workspace', prompt: 'test prompt' });
assert.equal(args.includes('--ask-for-approval'), false);
assert.deepEqual(args.slice(0, 2), ['exec', '--ignore-user-config']);
assert.equal(args[args.indexOf('--sandbox') + 1], 'read-only');
const lunaArgs = buildCodexArgs({ model: 'gpt-6-luna', effort: 'medium', workspace: '/tmp/workspace', prompt: 'test prompt' });
assert.equal(lunaArgs[lunaArgs.indexOf('--model') + 1], 'gpt-6-luna');
assert.equal(lunaArgs[lunaArgs.indexOf('--config') + 1], 'model_reasoning_effort="medium"');
assert.deepEqual(selectValidationCases([{ id: 'a' }, { id: 'b' }, { id: 'c' }], { offset: 1 }), [{ id: 'b' }, { id: 'c' }]);
assert.deepEqual(selectValidationCases([{ id: 'a' }, { id: 'b' }, { id: 'c' }], { offset: 1, limit: 1 }), [{ id: 'b' }]);
assert.throws(() => selectValidationCases([{ id: 'a' }], { offset: -1 }), /offset/);
const root=await mkdtemp(join(tmpdir(),'mcg-eval-runner-'));
try {
  await writeFile(join(root,'ok'),'ok');
  const dataset = join(root, 'validation.jsonl');
  await writeFile(dataset, JSON.stringify({ id: 'case-1', category: 'coding', evidence: 'A = 1', question: 'State A', expected_contains: ['1'] }) + '\n');
  await saveEvaluation(root, {
    run_id: 'completed-case-1', dataset, kind: 'A/B', category: 'coding',
    baseline: { task_success: true, context_recall: 100, evidence_grounding: 100, hallucination_rate: 0, total_tokens: 100, real_executor: true, measurement_type: 'exact', model: 'gpt-6-luna', effort: 'medium', workspace: root, workspace_snapshot: 'snapshot-1', tools: [], policy: {} },
    mcg: { task_success: true, context_recall: 100, evidence_grounding: 100, hallucination_rate: 0, total_tokens: 90, real_executor: true, measurement_type: 'exact', model: 'gpt-6-luna', effort: 'medium', workspace: root, workspace_snapshot: 'snapshot-1', tools: [], policy: {} }
  });
  const resumed = await runValidationSuite({ root, binary: 'must-not-run', dataset, model: 'gpt-6-luna', effort: 'medium', offset: 1 });
  assert.equal(resumed.pairs, 1);
  assert.equal(resumed.executed_pairs, 0);
  assert.deepEqual(resumed.run_ids, ['completed-case-1']);
} finally { await rm(root,{recursive:true,force:true}); }
console.log('eval runner tests: 1 passed');
