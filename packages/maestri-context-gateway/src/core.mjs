import { mkdir, readFile, rename, writeFile, appendFile, readdir, rm, stat } from 'node:fs/promises';
import { existsSync, watch } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { recordTelemetry } from './telemetry.mjs';
import { createTrace, startSpan, finishSpan } from './traces.mjs';
import { getEventBus } from './events/bus.mjs';
import { compileContext } from './context/compiler.mjs';
import { cacheContext } from './context/cache.mjs';
import { recordHistory } from './history/store.mjs';
import { assertContract } from './contracts.mjs';

export const ROOT = process.env.MCG_ROOT || join(homedir(), '.lumenva', 'maestri-context-gateway');
export const TASKS = join(ROOT, 'tasks');
export const INBOX = join(ROOT, 'events', 'inbox');
export const TERMINAL = new Set(['DONE', 'BLOCKED_OWNER']);
const INTERNAL = new Set(['CREATED', 'DISPATCHED', 'WORKING', 'TESTING', 'BUILDING', 'CI_RUNNING', 'RETRYING', 'APPROVAL_REQUIRED', 'BLOCKED', 'SECURITY_RISK', 'FAILED_FINAL', 'DONE', 'CANCELLED']);
const SECRET_KEY = /pass(word)?|token|secret|private[_-]?key|api[_-]?key|authorization|cookie/i;

function redact(value, key = '') {
  if (/^(input_tokens|cached_input_tokens|output_tokens|reasoning_tokens|total_tokens)$/i.test(key) && Number.isFinite(value)) return value;
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
  assertTaskContract(state);
  await atomicJson(statePath(state.task_id, root), state);
}

function assertTaskContract(state) {
  assertContract('task', { ...state, status: state.external_state || state.internal_state, timestamp: state.updated_at || state.created_at, source: 'mcg.task-state', measurement_type: 'exact' });
}

export async function loadState(id, root = ROOT) {
  assertTaskId(id);
  return JSON.parse(await readFile(statePath(id, root), 'utf8'));
}

export function assertTaskId(id) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9._-]+$/.test(id) || id === '.' || id === '..') throw new Error('invalid task_id');
}


const COMPACT_RESULT_LIMIT = 6000;
const COMPACT_VALIDATION_LIMIT = 3000;

function compactText(value, limit) {
  if (value == null) return '';
  const text = typeof value === 'string'
    ? value
    : JSON.stringify(value);

  if (text.length <= limit) return text;

  return `${text.slice(0, limit)}
[MCG TRUNCATED: ${text.length - limit} chars omitted. Use mcg evidence/result references for details.]`;
}

export function compactResult(state) {
  const external = state.external_state === 'BLOCKED_OWNER' ? 'BLOCKED_OWNER' : state.internal_state === 'DONE' ? 'DONE' : null;
  if (!external) return { task_id: state.task_id, state: state.internal_state };
  const result = {
    STATUS: external,
    TASK: state.task_id,
    RESULT: compactText(
      state.result || (external === 'DONE' ? 'Task completed.' : ''),
      COMPACT_RESULT_LIMIT
    ),
    VALIDATION: compactText(
      state.validation || '',
      COMPACT_VALIDATION_LIMIT
    ),
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
  const source = input.source && typeof input.source === 'object' ? redact(input.source) : {};
  const trace = await createTrace(root, { task_id: id, session_id: input.session_id || input.session, source: 'mcg.dispatch' });
  const dispatchSpan = await startSpan(root, trace, { task_id: id, workspace: input.workspace || null, agent_name: input.agent || source.host_agent || null, executor: input.executor || 'codex', runtime: input.runtime || null, ide: input.ide || null, operation_type: 'mcg.dispatch', source: 'mcg.dispatch' });
  const state = { task_id: id, trace_id: trace.trace_id, session_id: trace.session_id, project: input.project || process.cwd(), executor: input.executor || 'codex', agent: input.agent || source.host_agent || null, runtime: input.runtime || null, ide: input.ide || null, source, session: input.session || null, created_at: now, updated_at: now, internal_state: 'DISPATCHED', external_state: null, last_event_id: null, last_sequence: null, result_reference: null, evidence_reference: `${id}/manifest.json`, objective: input.objective || null, constraints: input.constraints || [], acceptance: input.acceptance || [] };
  assertTaskContract(state);
  await mkdir(join(root, 'tasks', id, 'evidence'), { recursive: true, mode: 0o700 });
  const contextFragments = input.context_fragments || [
    { id: `${id}:objective`, category: 'must_keep', priority: 100, content: input.objective || '' },
    ...(input.constraints || []).map((content, index) => ({ id: `${id}:constraint:${index}`, category: 'constraints', content })),
    ...(input.acceptance || []).map((content, index) => ({ id: `${id}:acceptance:${index}`, category: 'acceptance_criteria', content }))
  ];
  const compiledContext = compileContext({ fragments: contextFragments, budget_chars: input.context_budget_chars || Infinity });
  const cache = await cacheContext(root, compiledContext.fragments);
  compiledContext.cache_hits = cache.cache_hits; compiledContext.cache_misses = cache.cache_misses; compiledContext.cache_hit_rate = cache.cache_hit_rate;
  state.context_version = compiledContext.context_version;
  await atomicJson(join(root, 'tasks', id, 'evidence', 'context.json'), compiledContext);
  await atomicJson(join(root, 'tasks', id, 'state.json'), state);
  await atomicJson(join(root, 'tasks', id, 'manifest.json'), { task_id: id, status: 'DISPATCHED', result: 'result.json', validation: 'validation.json', changes: 'changes.json', evidence: { events: 'events.jsonl', directory: 'evidence/' } });
  await recordTelemetry(root, { task_id: id, workspace: input.workspace || null, executor: input.executor || 'codex', agent: state.agent, runtime: state.runtime, ide: state.ide, tool: input.tool || null, plugin: source.plugin_id || source.plugin_name || null, skill: source.skill_name || null, mcp: input.mcp || null, operation: 'dispatch', measurement_type: 'unavailable', source: 'mcg.dispatch' });
  await recordTelemetry(root, { task_id: id, workspace: input.workspace || null, executor: input.executor || 'codex', agent: state.agent, runtime: state.runtime, ide: state.ide, operation: 'context.compile', input_chars: compiledContext.full_context_chars, output_chars: compiledContext.delta_chars, estimated_tokens: Math.ceil(compiledContext.delta_chars / 4), measurement_type: 'estimated', source: 'context.compiler' });
  await getEventBus(root).publish('context.compiled', { task_id: id, trace_id: trace.trace_id, context_version: compiledContext.context_version, full_context_chars: compiledContext.full_context_chars, delta_chars: compiledContext.delta_chars, cache_hits: compiledContext.cache_hits, cache_misses: compiledContext.cache_misses }, { source: 'context.compiler', trace_id: trace.trace_id, task_id: id });
  await finishSpan(root, trace, dispatchSpan.span_id, { status: 'completed', duration_ms: Date.now() - Date.parse(dispatchSpan.started_at), source: 'mcg.dispatch' });
  await getEventBus(root).publish('task.dispatched', { task_id: id, trace_id: trace.trace_id, status: state.internal_state }, { source: 'mcg.dispatch', trace_id: trace.trace_id, task_id: id });
  await recordHistory(root, 'tasks', { ...state, status: state.internal_state, source: 'mcg.dispatch', measurement_type: 'exact', provenance: { trace_id: trace.trace_id } });
  return state;
}

export async function ingest(event, root = ROOT) {
  assertTaskId(event.task_id);
  if (!event.task_id || !event.event_id || !event.state) throw new Error('event requires task_id, event_id and state');
  assertContract('event', { ...event, timestamp: event.timestamp || new Date().toISOString(), source: typeof event.source === 'string' && event.source ? event.source : 'mcg.ingest', measurement_type: event.measurement_type || 'unavailable' });
  if (!INTERNAL.has(event.state)) throw new Error(`invalid internal state: ${event.state}`);
  const encoded = JSON.stringify(event);
  if (Buffer.byteLength(encoded, 'utf8') > 1024 * 1024) throw new Error('event exceeds 1 MiB limit');
  const state = JSON.parse(await readFile(join(root, 'tasks', event.task_id, 'state.json'), 'utf8'));
  const trace = { trace_id: state.trace_id || (await createTrace(root, { task_id: event.task_id, session_id: state.session_id, source: 'mcg.ingest' })).trace_id, session_id: state.session_id || null, task_id: event.task_id };
  const toolName = typeof event.tool === 'string' ? event.tool : event.tool?.tool_name || event.tool?.type || null;
  const ingestSpan = await startSpan(root, trace, { task_id: event.task_id, parent_span_id: event.parent_span_id, agent_name: event.agent, executor: state.executor, runtime: event.runtime || state.runtime, ide: event.ide || state.ide, model: event.model || event.usage?.model, operation_type: toolName ? 'tool.call' : 'task.ingest', tool_name: toolName, mcp_name: event.mcp, input_tokens: event.usage?.input_tokens, cached_input_tokens: event.usage?.cached_input_tokens, output_tokens: event.usage?.output_tokens, reasoning_tokens: event.usage?.reasoning_tokens || event.usage?.reasoning_output_tokens, total_tokens: event.usage?.total_tokens, measurement_type: event.usage ? 'exact' : 'unavailable', source: event.source || 'mcg.ingest' });
  const epochChanged = event.epoch != null && state.last_epoch != null && event.epoch !== state.last_epoch;
  if (epochChanged && event.snapshot !== true) return { deduped: false, resync_required: true, state };
  if (state.last_event_id === event.event_id || (!epochChanged && event.sequence != null && state.last_sequence != null && event.sequence <= state.last_sequence)) return { deduped: true, state };
  const safeEvent = redact(event);
  const externalState = safeEvent.external_state || (safeEvent.state === 'DONE' ? 'DONE' : safeEvent.state === 'BLOCKED' ? 'BLOCKED_OWNER' : null);
  const updated = { ...state, trace_id: trace.trace_id, session_id: trace.session_id || state.session_id, internal_state: safeEvent.state, external_state: externalState, agent: safeEvent.agent ?? state.agent, runtime: safeEvent.runtime ?? state.runtime, ide: safeEvent.ide ?? state.ide, source: safeEvent.source && typeof safeEvent.source === 'object' ? { ...state.source, ...safeEvent.source } : state.source, last_event_id: safeEvent.event_id, last_epoch: safeEvent.epoch ?? state.last_epoch, last_sequence: epochChanged ? safeEvent.sequence ?? null : safeEvent.sequence ?? state.last_sequence, updated_at: new Date().toISOString(), result: safeEvent.result ?? state.result, validation: safeEvent.validation ?? state.validation, commit: safeEvent.commit ?? state.commit, blocker: safeEvent.blocker ?? state.blocker, owner_needed: safeEvent.owner_needed ?? state.owner_needed, result_reference: externalState === 'DONE' || externalState === 'BLOCKED_OWNER' ? `${event.task_id}/result.json` : state.result_reference };
  await saveState(updated, root);
  const usage = safeEvent.usage && typeof safeEvent.usage === 'object' ? safeEvent.usage : {};
  const exactUsage = ['input_tokens', 'cached_input_tokens', 'output_tokens', 'reasoning_tokens', 'total_tokens'].some(key => Number.isFinite(usage[key]));
  await recordTelemetry(root, { task_id: event.task_id, executor: state.executor, agent: updated.agent, runtime: updated.runtime, ide: updated.ide, tool: toolName, plugin: updated.source?.plugin_id || updated.source?.plugin_name || null, skill: updated.source?.skill_name || null, mcp: event.mcp || null, model: usage.model || event.model || null, operation: 'ingest', input_chars: usage.input_chars ?? (typeof event.result === 'string' ? event.result.length : null), output_chars: usage.output_chars ?? null, input_tokens: usage.input_tokens, cached_input_tokens: usage.cached_input_tokens, output_tokens: usage.output_tokens, reasoning_tokens: usage.reasoning_tokens, total_tokens: usage.total_tokens, latency_ms: usage.latency_ms, measurement_type: exactUsage ? 'exact' : 'estimated', estimated_tokens: exactUsage ? null : (typeof event.result === 'string' ? Math.ceil(event.result.length / 4) : null), source: usage.source || (exactUsage ? 'executor.usage' : 'mcg.ingest') });
  await appendFile(join(root, 'tasks', event.task_id, 'events.jsonl'), `${JSON.stringify(safeEvent)}\n`, { mode: 0o600 });
  if (updated.external_state === 'DONE' || updated.external_state === 'BLOCKED_OWNER') {
    await atomicJson(join(root, 'tasks', event.task_id, 'result.json'), compactResult(updated));
    await atomicJson(join(root, 'tasks', event.task_id, 'validation.json'), { validation: updated.validation || null, recorded_at: updated.updated_at });
    await atomicJson(join(root, 'tasks', event.task_id, 'manifest.json'), { task_id: event.task_id, status: updated.external_state, result: 'result.json', validation: 'validation.json', changes: 'changes.json', evidence: { events: 'events.jsonl', directory: 'evidence/' } });
  }
  if (event.evidence) await atomicJson(join(root, 'tasks', event.task_id, 'evidence', `${event.event_id}.json`), redact(event.evidence));
  await finishSpan(root, trace, ingestSpan.span_id, { status: externalState === 'BLOCKED_OWNER' ? 'blocked' : safeEvent.state === 'FAILED_FINAL' ? 'failed' : 'completed', duration_ms: 0, output_tokens: usage.output_tokens, source: event.source || 'mcg.ingest' });
  await getEventBus(root).publish('task.event', { task_id: event.task_id, trace_id: trace.trace_id, state: safeEvent.state, external_state: externalState }, { source: event.source || 'mcg.ingest', trace_id: trace.trace_id, task_id: event.task_id });
  await recordHistory(root, 'tasks', { ...updated, status: updated.external_state || updated.internal_state, source: event.source || 'mcg.ingest', measurement_type: 'exact', provenance: { event_id: event.event_id, trace_id: trace.trace_id } });
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

function estimateTokens(chars) { return Math.ceil(chars / 4); }

function emptyStats(executor = 'unknown') {
  return { executor, tasks_processed: 0, original_chars: 0, delivered_chars: 0, saved_chars: 0, reduction_percent: 0, estimated_tokens_original: 0, estimated_tokens_delivered: 0, estimated_tokens_saved: 0 };
}

function addStats(target, originalChars, deliveredChars) {
  target.tasks_processed += 1;
  target.original_chars += originalChars;
  target.delivered_chars += deliveredChars;
}

function finishStats(value) {
  value.saved_chars = value.original_chars - value.delivered_chars;
  value.reduction_percent = value.original_chars ? Number(((value.saved_chars / value.original_chars) * 100).toFixed(2)) : 0;
  value.estimated_tokens_original = estimateTokens(value.original_chars);
  value.estimated_tokens_delivered = estimateTokens(value.delivered_chars);
  value.estimated_tokens_saved = estimateTokens(value.saved_chars);
  return value;
}

export async function stats(root = ROOT, { tokens = true } = {}) {
  const totals = emptyStats('total');
  const executors = Object.fromEntries(['codex', 'antigravity', 'unknown'].map(name => [name, emptyStats(name)]));
  const warnings = [];
  let ids = [];
  try { ids = await readdir(join(root, 'tasks')); } catch (error) { warnings.push(`tasks directory unavailable: ${error.message}`); }
  for (const id of ids) {
    const dir = join(root, 'tasks', id);
    let state;
    try { state = JSON.parse(await readFile(join(dir, 'state.json'), 'utf8')); } catch { warnings.push(`${id}: state.json ausente ou JSON inválido`); continue; }
    const executor = executors[state.executor] ? state.executor : 'unknown';
    let original = 0;
    try {
      const events = await readFile(join(dir, 'events.jsonl'));
      original = Buffer.byteLength(events);
    } catch { warnings.push(`${id}: events.jsonl ausente`); }
    try { original += (await stat(join(dir, 'manifest.json'))).size; }
    catch { warnings.push(`${id}: manifest.json ausente`); }
    let delivered = 0;
    try { delivered = (await stat(join(dir, 'result.json'))).size; } catch { warnings.push(`${id}: result.json ausente`); continue; }
    if (!original && !delivered) continue;
    addStats(totals, original, delivered);
    addStats(executors[executor], original, delivered);
  }
  finishStats(totals);
  for (const value of Object.values(executors)) finishStats(value);
  const result = { ...totals, by_executor: executors, by_tool: Object.values(executors).filter(value => value.tasks_processed).map(value => ({ tool: value.executor, tasks_processed: value.tasks_processed, estimated_tokens_saved: estimateTokens(value.saved_chars) })), by_mcp: [], by_ide: [], agents: [], alerts: [{ severity: 'normal', scope: 'global', message: 'Limites de consumo não configuradas' }], warnings };
  if (tokens) result.tokenizer = 'ESTIMATIVA: chars/4 (sem tokenizer exato)';
  else for (const value of [result, ...Object.values(executors)]) for (const key of ['estimated_tokens_original', 'estimated_tokens_delivered', 'estimated_tokens_saved']) delete value[key];
  return result;
}

export async function removeTask(id, root = ROOT) {
  const target = resolve(root, 'tasks', id);
  if (relative(resolve(root, 'tasks'), target).startsWith('..')) throw new Error('invalid task path');
  await rm(target, { recursive: true, force: true });
}
