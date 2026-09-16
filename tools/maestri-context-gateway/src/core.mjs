import { mkdir, readFile, rename, writeFile, appendFile, readdir, rm } from 'node:fs/promises';
import { existsSync, watch } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';

export const ROOT = process.env.MCG_ROOT || join(homedir(), '.lumenva', 'maestri-context-gateway');
export const TASKS = join(ROOT, 'tasks');
export const INBOX = join(ROOT, 'events', 'inbox');
export const TERMINAL = new Set(['DONE', 'BLOCKED_OWNER']);
const INTERNAL = new Set(['CREATED', 'DISPATCHED', 'WORKING', 'TESTING', 'BUILDING', 'CI_RUNNING', 'RETRYING', 'APPROVAL_REQUIRED', 'BLOCKED', 'SECURITY_RISK', 'FAILED_FINAL', 'DONE', 'CANCELLED']);
const SECRET_KEY = /pass(word)?|token|secret|private[_-]?key|api[_-]?key|authorization|cookie/i;

function redact(value, key = '') {
  if (SECRET_KEY.test(key)) return '[REDACTED]';
  if (Array.isArray(value)) return value.map(item => redact(item));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, redact(item, name)]));
  return value;
}

export async function ensureLayout(root = ROOT) {
  for (const path of [root, join(root, 'config'), join(root, 'state'), join(root, 'tasks'), join(root, 'events', 'inbox'), join(root, 'logs')]) await mkdir(path, { recursive: true, mode: 0o700 });
}

async function atomicJson(path, value) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const tmp = `${path}.${process.pid}.tmp`;
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(tmp, path);
}

export function taskDir(id, root = ROOT) { assertTaskId(id); return join(root, 'tasks', id); }
export function statePath(id, root = ROOT) { return join(taskDir(id, root), 'state.json'); }
export function evidencePath(id, root = ROOT) { return join(taskDir(id, root), 'evidence'); }

export async function saveState(state, root = ROOT) {
  await atomicJson(statePath(state.task_id, root), state);
}

export async function loadState(id, root = ROOT) {
  assertTaskId(id);
  return JSON.parse(await readFile(statePath(id, root), 'utf8'));
}

export function assertTaskId(id) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9._-]+$/.test(id) || id === '.' || id === '..') throw new Error('invalid task_id');
}

export function compactResult(state) {
  const external = state.external_state === 'BLOCKED_OWNER' ? 'BLOCKED_OWNER' : state.internal_state === 'DONE' ? 'DONE' : null;
  if (!external) return { task_id: state.task_id, state: state.internal_state };
  const result = {
    STATUS: external,
    TASK: state.task_id,
    RESULT: state.result || (external === 'DONE' ? 'Task completed.' : ''),
    VALIDATION: state.validation || '',
    COMMIT: state.commit || 'NONE',
    EVIDENCE: state.evidence_reference || `${state.task_id}/manifest.json`,
  };
  if (external === 'BLOCKED_OWNER') { result.BLOCKER = state.blocker || ''; result.OWNER_NEEDED = state.owner_needed || ''; }
  return result;
}

export async function dispatch(input, root = ROOT) {
  await ensureLayout(root);
  const id = input.task_id || `MCG-${Date.now()}-${randomUUID().slice(0, 8)}`;
  if (!/^[A-Za-z0-9._-]+$/.test(id)) throw new Error('invalid task_id');
  const now = new Date().toISOString();
  const state = { task_id: id, project: input.project || process.cwd(), executor: input.executor || 'codex', session: input.session || null, created_at: now, updated_at: now, internal_state: 'DISPATCHED', external_state: null, last_event_id: null, last_sequence: null, result_reference: null, evidence_reference: `${id}/manifest.json`, objective: input.objective || null, constraints: input.constraints || [], acceptance: input.acceptance || [] };
  await mkdir(join(root, 'tasks', id, 'evidence'), { recursive: true, mode: 0o700 });
  await atomicJson(join(root, 'tasks', id, 'state.json'), state);
  await atomicJson(join(root, 'tasks', id, 'manifest.json'), { task_id: id, status: 'DISPATCHED', result: 'result.json', validation: 'validation.json', changes: 'changes.json', evidence: { events: 'events.jsonl', directory: 'evidence/' } });
  return state;
}

export async function ingest(event, root = ROOT) {
  assertTaskId(event.task_id);
  if (!event.task_id || !event.event_id || !event.state) throw new Error('event requires task_id, event_id and state');
  if (!INTERNAL.has(event.state)) throw new Error(`invalid internal state: ${event.state}`);
  const encoded = JSON.stringify(event);
  if (Buffer.byteLength(encoded, 'utf8') > 1024 * 1024) throw new Error('event exceeds 1 MiB limit');
  const state = JSON.parse(await readFile(join(root, 'tasks', event.task_id, 'state.json'), 'utf8'));
  if (state.last_event_id === event.event_id || (event.sequence != null && state.last_sequence != null && event.sequence <= state.last_sequence)) return { deduped: true, state };
  const safeEvent = redact(event);
  const externalState = safeEvent.external_state || (safeEvent.state === 'DONE' ? 'DONE' : safeEvent.state === 'BLOCKED' ? 'BLOCKED_OWNER' : null);
  const updated = { ...state, internal_state: safeEvent.state, external_state: externalState, last_event_id: safeEvent.event_id, last_sequence: safeEvent.sequence ?? state.last_sequence, updated_at: new Date().toISOString(), result: safeEvent.result ?? state.result, validation: safeEvent.validation ?? state.validation, commit: safeEvent.commit ?? state.commit, blocker: safeEvent.blocker ?? state.blocker, owner_needed: safeEvent.owner_needed ?? state.owner_needed, result_reference: externalState === 'DONE' || externalState === 'BLOCKED_OWNER' ? `${event.task_id}/result.json` : state.result_reference };
  await saveState(updated, root);
  await appendFile(join(root, 'tasks', event.task_id, 'events.jsonl'), `${JSON.stringify(safeEvent)}\n`, { mode: 0o600 });
  if (updated.external_state === 'DONE' || updated.external_state === 'BLOCKED_OWNER') {
    await atomicJson(join(root, 'tasks', event.task_id, 'result.json'), compactResult(updated));
    await atomicJson(join(root, 'tasks', event.task_id, 'validation.json'), { validation: updated.validation || null, recorded_at: updated.updated_at });
    await atomicJson(join(root, 'tasks', event.task_id, 'manifest.json'), { task_id: event.task_id, status: updated.external_state, result: 'result.json', validation: 'validation.json', changes: 'changes.json', evidence: { events: 'events.jsonl', directory: 'evidence/' } });
  }
  if (event.evidence) await atomicJson(join(root, 'tasks', event.task_id, 'evidence', `${event.event_id}.json`), redact(event.evidence));
  return { deduped: false, state: updated };
}

export async function waitForTerminal(id, root = ROOT, timeoutMs = 0) {
  const path = join(root, 'tasks', id, 'state.json');
  const read = async () => JSON.parse(await readFile(path, 'utf8'));
  let state = await read();
  if (TERMINAL.has(state.external_state)) return compactResult(state);
  return new Promise((resolvePromise, reject) => {
    let timer;
    const watcher = watch(path, async () => {
      try { state = await read(); if (TERMINAL.has(state.external_state)) { watcher.close(); if (timer) clearTimeout(timer); resolvePromise(compactResult(state)); } } catch (error) { watcher.close(); reject(error); }
    });
    watcher.on('error', reject);
    if (timeoutMs > 0) timer = setTimeout(() => { watcher.close(); reject(new Error('wait timeout')); }, timeoutMs);
  });
}

export async function sliceEvidence(id, type = 'manifest', lines = 80, root = ROOT) {
  assertTaskId(id);
  const base = join(root, 'tasks', id);
  const names = type === 'validation' ? ['validation.json'] : type === 'ci' ? ['evidence', 'ci.log'] : type === 'tests' ? ['evidence', 'tests.log'] : ['manifest.json'];
  const path = join(base, ...names);
  const text = await readFile(path, 'utf8');
  return text.split('\n').slice(0, Math.max(1, Math.min(lines, 200))).join('\n');
}

export async function listTasks(root = ROOT) {
  await ensureLayout(root);
  const ids = await readdir(join(root, 'tasks'));
  return Promise.all(ids.map(async id => { try { return await JSON.parse(await readFile(join(root, 'tasks', id, 'state.json'), 'utf8')); } catch { return null; } })).then(items => items.filter(Boolean));
}

export async function removeTask(id, root = ROOT) {
  const target = resolve(root, 'tasks', id);
  if (relative(resolve(root, 'tasks'), target).startsWith('..')) throw new Error('invalid task path');
  await rm(target, { recursive: true, force: true });
}
