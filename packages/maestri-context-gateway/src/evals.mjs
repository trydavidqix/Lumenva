import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const now = () => new Date().toISOString();
const facts = text => String(text || '').split(/\r?\n/).map(line => line.trim()).filter(line => line.includes('=')).map(line => line.split('=').map(value => value.trim()));

export function gradeContextRecall(evidence, answer) {
  const expected = facts(evidence); const lower = String(answer || '').toLowerCase();
  const checks = expected.map(([key, value]) => ({ key, expected: value, found: lower.includes(key.toLowerCase()) && lower.includes(value.toLowerCase()) }));
  const recall = checks.length ? Number((checks.filter(check => check.found).length / checks.length * 100).toFixed(2)) : null;
  return { recall, checks, source: 'deterministic evidence matcher', measurement_type: 'exact', timestamp: now() };
}

export function gradeHallucinations(question, answer) {
  const text = String(answer || '').toLowerCase(); const missing = /não há evidência suficiente|nao ha evidencia suficiente|insufficient evidence|not enough evidence/.test(text);
  return { question, classification: missing ? 'MISSING_EVIDENCE' : 'HALLUCINATED', source: 'deterministic no-evidence grader', measurement_type: 'exact', timestamp: now() };
}

export function qualityPreservingSavings(baseline, mcg) {
  const total = Number.isFinite(baseline?.total_tokens) && Number.isFinite(mcg?.total_tokens) && baseline.total_tokens > 0 ? Number(((baseline.total_tokens - mcg.total_tokens) / baseline.total_tokens * 100).toFixed(2)) : null;
  const success = mcg.task_success === true || (Number.isFinite(mcg.task_success) && mcg.task_success >= 98);
  const qualified = total != null && total >= 20 && success && mcg.context_recall >= 97 && mcg.evidence_grounding >= 98 && mcg.hallucination_rate <= baseline.hallucination_rate && mcg.total_tokens < baseline.total_tokens;
  return { percent: total, qualified, source: 'baseline and MCG run records', measurement_type: baseline?.measurement_type === 'exact' && mcg?.measurement_type === 'exact' ? 'exact' : 'estimated', timestamp: now() };
}

export function trustScore({ baseline, mcg, context_recall, evidence_grounding, hallucination_rate, dataset_size = 0, last_validation = null }) {
  const savings = qualityPreservingSavings({ ...baseline, hallucination_rate: baseline?.hallucination_rate ?? hallucination_rate }, { ...mcg, context_recall, evidence_grounding, hallucination_rate });
  const minimum_dataset = 30;
  const real = baseline?.real_executor === true && mcg?.real_executor === true;
  const validated = real && dataset_size >= minimum_dataset && savings.qualified;
  const status = validated ? 'VALIDATED' : real && dataset_size < minimum_dataset ? 'VALIDATING' : real ? 'DEGRADED' : 'UNVALIDATED';
  const score = validated ? Number(((Math.min(100, context_recall) + Math.min(100, evidence_grounding) + Math.max(0, 100 - hallucination_rate) + Math.min(100, savings.percent)) / 4).toFixed(2)) : null;
  return { status, score, dataset_size, minimum_dataset, task_success_baseline: baseline?.task_success ?? null, task_success_mcg: mcg?.task_success ?? null, context_recall, evidence_grounding, hallucination_rate, real_token_saving: savings.percent, quality_preserving_saving: savings.qualified ? savings.percent : null, last_validation, source: 'state/evals/runs', measurement_type: savings.measurement_type, timestamp: now() };
}

export async function saveEvaluation(root, run) {
  const dir = join(root, 'state', 'evals', 'runs'); await mkdir(dir, { recursive: true, mode: 0o700 }); const id = run.run_id || `eval-${Date.now()}`; const record = { ...run, run_id: id, timestamp: run.timestamp || now() };
  await writeFile(join(dir, `${id}.json`), `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 }); return record;
}

export async function latestEvaluation(root) {
  const dir = join(root, 'state', 'evals', 'runs');
  try {
    const files = (await readdir(dir)).filter(name => name.endsWith('.json'));
    if (!files.length) return null;
    const records = await Promise.all(files.map(async name => { try { return JSON.parse(await readFile(join(dir, name), 'utf8')); } catch { return null; } }));
    return records.filter(Boolean).sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')))[0] || null;
  } catch { return null; }
}
