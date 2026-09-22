import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { parseCodexJsonl } from './codex-usage.mjs';
import { gradeContextRecall, gradeHallucinations, qualityPreservingSavings, saveEvaluation, trustScore } from './evals.mjs';

const facts = `DB_PRIMARY_REGION = us-central1
AUTH_CANONICAL_PROVIDER = firebase-admin
CUTOVER_REQUIRES = owner-approval
LEGACY_DELETE_ALLOWED = false
DEPLOY_POLICY = no-deploy-without-owner`;
const archive = Array.from({ length: 80 }, (_, index) => `ARCHIVE_NOTE_${String(index + 1).padStart(3, '0')} = historical review record; not required for this task.`).join('\n');
const question = `State all five configuration values exactly. Then answer: What is the CEO birthday? If evidence lacks it, answer exactly: Não há evidência suficiente. Do not edit files.`;

export function buildLanePrompt(lane) {
  const context = lane === 'baseline' ? `${facts}\n${archive}` : facts;
  return `Validation lane: ${lane.toUpperCase()}\nEvidence:\n${context}\n\nTask:\n${question}`;
}

function codex(root, prompt, binary) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, ['exec', '--ignore-user-config', '--ephemeral', '--skip-git-repo-check', '--sandbox', 'read-only', '--json', '-C', root, prompt], { windowsHide: true }); const stdout = []; const stderr = [];
    const timer = setTimeout(() => { child.kill(); resolve({ code: 124, stdout: Buffer.concat(stdout).toString('utf8'), stderr: `${Buffer.concat(stderr).toString('utf8')}\nMCG_TIMEOUT: validation lane exceeded 45s` }); }, 45_000);
    child.stdin.end();
    child.stdout.on('data', data => stdout.push(data)); child.stderr.on('data', data => stderr.push(data)); child.on('error', reject); child.on('close', code => resolve({ code, stdout: Buffer.concat(stdout).toString('utf8'), stderr: Buffer.concat(stderr).toString('utf8') }));
    child.on('close', () => clearTimeout(timer));
  });
}

function answerFromJsonl(output) {
  let answer = '';
  for (const line of output.split(/\r?\n/)) try { const item = JSON.parse(line).item; if (item?.type === 'agent_message' && typeof item.text === 'string') answer = item.text; } catch {}
  return answer;
}

export async function runAbValidation({ root, binary, workspace = root }) {
  const run_id = `ab-${Date.now()}-${randomUUID().slice(0, 8)}`; const dir = join(root, 'state', 'evals', 'runs'); await mkdir(dir, { recursive: true, mode: 0o700 });
  const runLane = async lane => {
    const prompt = buildLanePrompt(lane); const result = await codex(workspace, prompt, binary); const usage = parseCodexJsonl(result.stdout); const answer = answerFromJsonl(result.stdout); const recall = gradeContextRecall(facts, answer); const hallucination = gradeHallucinations('What is the CEO birthday?', answer); const task_success = result.code === 0 && recall.recall === 100 && hallucination.classification === 'MISSING_EVIDENCE';
    const record = { lane, run_id, prompt_chars: prompt.length, task_success, context_recall: recall.recall, evidence_grounding: recall.recall, hallucination_rate: hallucination.classification === 'HALLUCINATED' ? 100 : 0, total_tokens: usage?.total_tokens ?? null, input_tokens: usage?.input_tokens ?? null, cached_input_tokens: usage?.cached_input_tokens ?? null, output_tokens: usage?.output_tokens ?? null, reasoning_tokens: usage?.reasoning_tokens ?? null, measurement_type: usage?.measurement_type || 'unavailable', source: usage?.source || 'codex.exec.jsonl', real_executor: result.code === 0, executor: 'codex', runtime: 'Codex CLI', model: null, effort: 'CLI profile/default not exposed', workspace, timestamp: new Date().toISOString(), evidence: { raw_jsonl: `state/evals/runs/${run_id}-${lane}.jsonl`, stderr: `state/evals/runs/${run_id}-${lane}.stderr.txt` } };
    await writeFile(join(dir, `${run_id}-${lane}.jsonl`), result.stdout, { mode: 0o600 }); await writeFile(join(dir, `${run_id}-${lane}.stderr.txt`), result.stderr, { mode: 0o600 }); return record;
  };
  const baseline = await runLane('baseline'); const mcg = await runLane('mcg'); const savings = qualityPreservingSavings(baseline, mcg); const trust = trustScore({ baseline, mcg, context_recall: mcg.context_recall, evidence_grounding: mcg.evidence_grounding, hallucination_rate: mcg.hallucination_rate, dataset_size: 1, last_validation: new Date().toISOString() });
  return saveEvaluation(root, { run_id, kind: 'A/B', dataset: 'evals/datasets/smoke.jsonl', baseline, mcg, quality_preserving_savings: savings, trust });
}
