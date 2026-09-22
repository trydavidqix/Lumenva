import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { join } from 'node:path';

const sha = value => createHash('sha256').update(value).digest('hex');

export async function saveArtifact(root, input = {}) {
  const content = input.content == null ? null : String(input.content); const artifact_id = input.artifact_id || `artifact-${randomUUID()}`;
  const row = { artifact_id, task_id: input.task_id || null, trace_id: input.trace_id || null, type: input.type || 'evidence-bundle', path: input.path || null, hash: input.hash || (content == null ? null : sha(content)), created_at: input.created_at || new Date().toISOString(), source: input.source || 'mcg.evidence' };
  await mkdir(join(root, 'state', 'artifacts'), { recursive: true, mode: 0o700 }); await writeFile(join(root, 'state', 'artifacts', `${artifact_id}.json`), `${JSON.stringify({ ...row, content: content == null ? undefined : content }, null, 2)}\n`, { mode: 0o600 }); return row;
}

export async function linkEvidence(root, claim, evidence = []) {
  await mkdir(join(root, 'state', 'evidence'), { recursive: true, mode: 0o700 }); const row = { claim, evidence, timestamp: new Date().toISOString(), source: 'state/artifacts' }; await appendFile(join(root, 'state', 'evidence', 'graph.jsonl'), `${JSON.stringify(row)}\n`, { mode: 0o600 }); return row;
}

export function progressFromCriteria(criteria = []) {
  const total = criteria.length; const passed = criteria.filter(item => String(item.status || '').toUpperCase() === 'PASS').length; const blocked = criteria.filter(item => ['BLOCKED', 'FAIL'].includes(String(item.status || '').toUpperCase())).length;
  return { criteria_total: total, criteria_passed: passed, criteria_blocked: blocked, progress_percent: total ? Number((passed / total * 100).toFixed(2)) : 0, confidence: total ? Number((passed / total * 100).toFixed(2)) : null, evidence_coverage: total ? Number(criteria.filter(item => item.evidence).length / total * 100).toFixed(2) : null, unresolved: criteria.filter(item => !['PASS'].includes(String(item.status || '').toUpperCase())).map(item => item.id || item.name || 'unresolved'), source: 'acceptance criteria + evidence', measurement_type: total ? 'exact' : 'unavailable', timestamp: new Date().toISOString() };
}

export async function loadArtifact(root, artifact_id) { try { return JSON.parse(await readFile(join(root, 'state', 'artifacts', `${artifact_id}.json`), 'utf8')); } catch { return null; } }
