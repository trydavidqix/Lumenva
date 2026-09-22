import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { parseCodexJsonl, parseCodexTools } from './codex-usage.mjs';
import { aggregatePairedEvaluations, gradeContextRecall, gradeHallucinations, qualityPreservingSavings, saveEvaluation, trustScore } from './evals.mjs';
import { runProcess } from './executor.mjs';

const DEFAULT_MODEL = 'gpt-5.6';
const DEFAULT_EFFORT = 'medium';

async function readJsonl(path) {
  const text = await readFile(path, 'utf8');
  return text.split(/\r?\n/).filter(Boolean).map((line, index) => {
    try { return JSON.parse(line); } catch (error) { throw new Error('invalid JSONL ' + path + ':' + (index + 1) + ': ' + error.message); }
  });
}

function answerFromJsonl(output) {
  let answer = '';
  for (const line of output.split(/\r?\n/)) {
    try {
      const item = JSON.parse(line).item;
      if (item?.type === 'agent_message' && typeof item.text === 'string') answer = item.text;
    } catch {}
  }
  return answer;
}

function archiveFor(test) {
  const count = Math.max(12, Number(test.archive_lines || 80));
  return Array.from({ length: count }, (_, index) => 'ARCHIVE_' + test.id + '_' + String(index + 1).padStart(3, '0') + ' = historical context not required by the current acceptance criteria.').join('\n');
}

function questionFor(test) {
  const noEvidence = test.no_evidence_question ? '\nIf evidence does not answer "' + test.no_evidence_question + '", answer exactly: Não há evidência suficiente.' : '';
  return test.question + noEvidence + '\nDo not edit files. Return only the requested answer.';
}

export function buildLanePrompt(lane, test) {
  const evidence = String(test.evidence || '');
  const context = lane === 'baseline' ? evidence + '\n' + archiveFor(test) : evidence;
  return 'Validation case: ' + test.id + '\nCategory: ' + test.category + '\nLane: ' + lane.toUpperCase() + '\nEvidence:\n' + context + '\n\nTask:\n' + questionFor(test);
}

function gradeCase(test, answer) {
  const recall = gradeContextRecall(test.evidence, answer);
  const hallucination = test.no_evidence_question ? gradeHallucinations(test.no_evidence_question, answer) : { classification: 'NOT_APPLICABLE' };
  const expected = (test.expected_contains || []).every(value => String(answer).toLowerCase().includes(String(value).toLowerCase()));
  const noHallucination = hallucination.classification !== 'HALLUCINATED';
  return {
    task_success: expected && noHallucination && (recall.recall == null || recall.recall >= Number(test.min_recall ?? 97)),
    context_recall: recall.recall,
    evidence_grounding: expected ? 100 : 0,
    hallucination_rate: hallucination.classification === 'HALLUCINATED' ? 100 : 0
  };
}

export async function runPairedCase({ root, binary, workspace = root, test, model = DEFAULT_MODEL, effort = DEFAULT_EFFORT, job_class = 'NORMAL', timeout_ms, signal } = {}) {
  if (!test?.id) throw new Error('validation test id required');
  const run_id = 'pair-' + test.id + '-' + Date.now() + '-' + randomUUID().slice(0, 8);
  const dir = join(root, 'state', 'evals', 'runs');
  await mkdir(dir, { recursive: true, mode: 0o700 });

  const runLane = async lane => {
    const prompt = buildLanePrompt(lane, test);
    const args = ['exec', '--ignore-user-config', '--ephemeral', '--skip-git-repo-check', '--sandbox', 'read-only', '--ask-for-approval', 'never', '--model', model, '--config', 'model_reasoning_effort="' + effort + '"', '--json', '-C', workspace, prompt];
    const result = await runProcess({ command: binary, args, cwd: workspace, job_class, timeout_ms, signal });
    const usage = parseCodexJsonl(result.stdout);
    const answer = answerFromJsonl(result.stdout);
    const grade = gradeCase(test, answer);
    const record = {
      lane, run_id, case_id: test.id, category: test.category, prompt_chars: prompt.length, ...grade,
      total_tokens: usage?.total_tokens ?? null, input_tokens: usage?.input_tokens ?? null, cached_input_tokens: usage?.cached_input_tokens ?? null,
      output_tokens: usage?.output_tokens ?? null, reasoning_tokens: usage?.reasoning_tokens ?? null,
      measurement_type: usage?.measurement_type || 'unavailable', source: usage?.source || 'codex.exec.jsonl',
      real_executor: result.classification === 'SUCCESS', executor: 'codex', runtime: 'Codex CLI',
      model, effort, workspace, tools: test.tools || [], observed_tools: parseCodexTools(result.stdout),
      policy: { sandbox: 'read-only', approval: 'never', user_config: 'ignored', ephemeral: true },
      workspace_snapshot: test.workspace_snapshot || 'same-workspace-read-only', job_class: result.policy.job_class,
      executor_result: { classification: result.classification, exit_code: result.code, duration_ms: result.duration_ms, last_activity_at: result.last_activity_at, heartbeat_count: result.heartbeat_count, timed_out: result.timed_out, cancelled: result.cancelled },
      timestamp: new Date().toISOString(),
      evidence: { raw_jsonl: 'state/evals/runs/' + run_id + '-' + lane + '.jsonl', stderr: 'state/evals/runs/' + run_id + '-' + lane + '.stderr.txt' }
    };
    await writeFile(join(dir, run_id + '-' + lane + '.jsonl'), result.stdout, { mode: 0o600 });
    await writeFile(join(dir, run_id + '-' + lane + '.stderr.txt'), result.stderr, { mode: 0o600 });
    return record;
  };

  const baseline = await runLane('baseline');
  const mcg = await runLane('mcg');
  if (baseline.model !== mcg.model || baseline.effort !== mcg.effort || baseline.workspace !== mcg.workspace || JSON.stringify(baseline.tools) !== JSON.stringify(mcg.tools) || JSON.stringify(baseline.policy) !== JSON.stringify(mcg.policy)) throw new Error('paired invariant mismatch');
  return saveEvaluation(root, { run_id, kind: 'A/B', dataset: test.dataset || null, case_id: test.id, category: test.category, baseline, mcg, quality_preserving_savings: qualityPreservingSavings(baseline, mcg) });
}

export async function runValidationSuite({ root, binary, workspace = root, dataset, model = DEFAULT_MODEL, effort = DEFAULT_EFFORT, limit = null, timeout_ms, signal } = {}) {
  const tests = await readJsonl(dataset);
  const selected = limit ? tests.slice(0, limit) : tests;
  const runs = [];
  for (const test of selected) runs.push(await runPairedCase({ root, binary, workspace, test: { ...test, dataset }, model, effort, timeout_ms, signal }));
  const aggregate = await aggregatePairedEvaluations(root);
  const trust = trustScore({ baseline: aggregate.baseline, mcg: aggregate.mcg, context_recall: aggregate.context_recall, evidence_grounding: aggregate.evidence_grounding, hallucination_rate: aggregate.hallucination_rate, dataset_size: aggregate.dataset_size, last_validation: new Date().toISOString() });
  const summary = { suite_id: 'suite-' + Date.now() + '-' + randomUUID().slice(0, 8), dataset, model, effort, pairs: runs.length, run_ids: runs.map(run => run.run_id), aggregate, trust, timestamp: new Date().toISOString(), source: 'real Codex CLI paired validation', measurement_type: aggregate.measurement_type };
  const out = join(root, 'state', 'evals', 'suites', summary.suite_id + '.json');
  await mkdir(dirname(out), { recursive: true, mode: 0o700 });
  await writeFile(out, JSON.stringify(summary, null, 2) + '\n', { mode: 0o600 });
  return summary;
}

export async function runAbValidation(options = {}) {
  const test = { id: 'legacy-smoke', category: 'context-recall', evidence: 'DB_PRIMARY_REGION = us-central1\nAUTH_CANONICAL_PROVIDER = firebase-admin\nCUTOVER_REQUIRES = owner-approval\nLEGACY_DELETE_ALLOWED = false\nDEPLOY_POLICY = no-deploy-without-owner', question: 'State all five configuration values exactly.', no_evidence_question: 'What is the CEO birthday?', expected_contains: ['us-central1', 'firebase-admin', 'owner-approval', 'false', 'no-deploy-without-owner'], archive_lines: 80 };
  const run = await runPairedCase({ ...options, test });
  const aggregate = await aggregatePairedEvaluations(options.root);
  return saveEvaluation(options.root, { ...run, aggregate, trust: trustScore({ baseline: aggregate.baseline, mcg: aggregate.mcg, context_recall: aggregate.context_recall, evidence_grounding: aggregate.evidence_grounding, hallucination_rate: aggregate.hallucination_rate, dataset_size: aggregate.dataset_size, last_validation: new Date().toISOString() }) });
}
