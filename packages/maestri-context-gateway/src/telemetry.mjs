import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { assertContract, validateContract } from './contracts.mjs';
import { recordHistory } from './history/store.mjs';

const exec = promisify(execFile);
const DAY = 86_400_000;
const TYPES = new Set(['exact', 'estimated', 'unavailable']);
const rank = { unavailable: 0, estimated: 1, exact: 2 };
const string = value => typeof value === 'string' && value.length > 0 && value.length <= 200 ? value : null;
const number = value => Number.isFinite(value) && value >= 0 ? value : null;

export const unavailable = (source = 'not-observable') => ({ value: null, measurement_type: 'unavailable', source, timestamp: new Date().toISOString() });

async function ensure(root) {
  for (const path of ['state/telemetry', 'state/alerts', 'state/dashboard', 'state/evals']) await mkdir(join(root, path), { recursive: true, mode: 0o700 });
}

async function lines(path) {
  try { return (await readFile(path, 'utf8')).split('\n').filter(Boolean).flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } }); }
  catch { return []; }
}

function eventType(event) {
  if (number(event.input_tokens) != null || number(event.output_tokens) != null || number(event.total_tokens) != null) return 'exact';
  if (event.measurement_type === 'exact') return 'exact';
  if (event.measurement_type === 'estimated') return 'estimated';
  if (event.measurement_type === 'unavailable') return 'unavailable';
  if (number(event.estimated_tokens) != null || number(event.input_chars) != null || number(event.output_chars) != null) return 'estimated';
  return 'unavailable';
}

function estimatedTokens(event) {
  if (number(event.estimated_tokens) != null) return number(event.estimated_tokens);
  const chars = (number(event.input_chars) || 0) + (number(event.output_chars) || 0);
  return chars > 0 ? Math.ceil(chars / 4) : null;
}

export async function recordTelemetry(root, event = {}) {
  await ensure(root);
  const measurement_type = eventType(event);
  const row = {
    timestamp: string(event.timestamp) || new Date().toISOString(), workspace: string(event.workspace) || 'Lumenva', task_id: string(event.task_id),
    agent: string(event.agent), executor: string(event.executor), runtime: string(event.runtime), ide: string(event.ide),
    tool: string(event.tool) || string(event.tool_name), plugin: string(event.plugin) || string(event.plugin_id) || string(event.plugin_name),
    skill: string(event.skill) || string(event.skill_name), mcp: string(event.mcp) || string(event.mcp_name), model: string(event.model), operation: string(event.operation) || 'unknown',
    input_chars: number(event.input_chars), output_chars: number(event.output_chars), input_tokens: number(event.input_tokens), cached_input_tokens: number(event.cached_input_tokens),
    output_tokens: number(event.output_tokens), reasoning_tokens: number(event.reasoning_tokens), total_tokens: number(event.total_tokens),
    estimated_tokens: measurement_type === 'estimated' ? estimatedTokens(event) : number(event.estimated_tokens), latency_ms: number(event.latency_ms), measurement_type, source: string(event.source) || 'mcg'
  };
  const contract = validateContract('telemetry', row);
  if (!contract.valid) throw new Error(`telemetry contract invalid: ${contract.errors.join(', ')}`);
  await appendFile(join(root, 'state', 'telemetry', 'events.jsonl'), `${JSON.stringify(row)}\n`, { mode: 0o600 });
  await recordHistory(root, 'telemetry', row);
  if (row.input_tokens != null || row.output_tokens != null || row.total_tokens != null || row.estimated_tokens != null) await recordHistory(root, 'usage', row);
  return row;
}

export async function telemetryEvents(root, { includeExpired = false } = {}) {
  const all = await lines(join(root, 'state', 'telemetry', 'events.jsonl'));
  if (includeExpired) return all;
  const cutoff = Date.now() - 7 * DAY;
  return all.filter(event => { const timestamp = Date.parse(event.timestamp); return Number.isFinite(timestamp) && timestamp >= cutoff; });
}

function metricTokens(event) { return number(event.total_tokens) != null ? event.total_tokens : event.measurement_type === 'estimated' ? number(event.estimated_tokens) : null; }
function strongest(events) { return events.reduce((best, event) => rank[event.measurement_type] > rank[best] ? event.measurement_type : best, 'unavailable'); }

function aggregate(events, field) {
  const groups = new Map();
  for (const event of events) {
    const key = event[field]; if (!key) continue;
    const group = groups.get(key) || { [field]: key, calls: 0, context_in: 0, context_out: 0, tokens: 0, token_observed: false, latency: [], sources: new Set(), timestamps: [] };
    group.calls += 1; group.context_in += event.input_chars || 0; group.context_out += event.output_chars || 0;
    const tokens = metricTokens(event); if (tokens != null) { group.tokens += tokens; group.token_observed = true; }
    if (event.latency_ms != null) group.latency.push(event.latency_ms); group.sources.add(event.source); group.timestamps.push(event.timestamp); groups.set(key, group);
  }
  return [...groups.values()].map(group => {
    const related = events.filter(event => event[field] === group[field]); const timestamp = group.timestamps.sort().at(-1);
    return { [field]: group[field], calls: group.calls, context_in: group.context_in || null, context_out: group.context_out || null,
      tokens: group.token_observed ? group.tokens : null, token_impact: group.token_observed ? group.tokens : null,
      latency_ms: group.latency.length ? Math.round(group.latency.reduce((sum, value) => sum + value, 0) / group.latency.length) : null,
      measurement_type: strongest(related), source: [...group.sources].sort().join(', '), timestamp, last_call: timestamp, last_used: timestamp };
  }).sort((left, right) => (right.tokens || 0) - (left.tokens || 0) || right.calls - left.calls);
}

export function aggregateTelemetry(events) {
  return { tools: aggregate(events, 'tool'), plugins: aggregate(events, 'plugin'), mcps: aggregate(events, 'mcp'), runtimes: aggregate(events, 'runtime'), ides: aggregate(events, 'ide'), agents: aggregate(events, 'agent'), skills: aggregate(events, 'skill') };
}

export async function loadBudgets(root) {
  const fallback = { global: { token_budget: null, warning_percent: 50, critical_percent: 80 }, executors: {}, agents: {}, plugins: {}, mcps: {}, ides: {}, runtimes: {}, tools: {} };
  try { const loaded = JSON.parse(await readFile(join(root, 'config', 'usage-budgets.json'), 'utf8')); return { ...fallback, ...loaded, global: { ...fallback.global, ...loaded.global } }; }
  catch { return fallback; }
}

async function appendOnce(path, record, same) {
  if ((await lines(path)).some(same)) return false;
  await appendFile(path, `${JSON.stringify(record)}\n`, { mode: 0o600 }); return true;
}

export async function evaluateAlerts(root, usage = {}) {
  await ensure(root); const budgets = await loadBudgets(root); const now = new Date().toISOString(); const results = [];
  const check = (scope, key, used, budget, thresholds = budgets.global) => {
    if (!Number.isFinite(budget) || budget <= 0 || !Number.isFinite(used)) return;
    const percent = Number((used / budget * 100).toFixed(2)); const severity = percent >= thresholds.critical_percent ? 'CRITICAL' : percent >= thresholds.warning_percent ? 'WARNING' : 'NORMAL';
    if (severity !== 'NORMAL') results.push({ alert_id: randomUUID(), severity, level: severity, scope, key, percent, used_tokens: used, token_budget: budget, message: `${scope} ${key} atingiu ${percent}% do orçamento`, source: 'config/usage-budgets.json', measurement_type: 'estimated', timestamp: now, created_at: now, delivery_status: 'queued' });
  };
  check('global', 'global', usage.tokens, budgets.global.token_budget);
  const groups = { executor: usage.executors, agent: usage.agents, plugin: usage.plugins, mcp: usage.mcps, ide: usage.ides, runtime: usage.runtimes, tool: usage.tools };
  for (const [scope, values] of Object.entries(groups)) for (const [key, value] of Object.entries(values || {})) { const config = budgets[`${scope}s`]?.[key]; check(scope, key, value?.tokens, config?.token_budget, { ...budgets.global, ...config }); }
  for (const alert of results) {
    assertContract('alert', alert);
    const created = await appendOnce(join(root, 'state', 'alerts', 'alerts.jsonl'), alert, item => item.scope === alert.scope && item.key === alert.key && item.severity === alert.severity && item.active !== false);
    if (created) { await appendFile(join(root, 'state', 'alerts', 'ceo-inbox.jsonl'), `${JSON.stringify({ alert_id: alert.alert_id, severity: alert.severity, scope: alert.scope, message: alert.message, created_at: alert.created_at, timestamp: alert.timestamp, source: alert.source, measurement_type: alert.measurement_type, delivery_status: 'queued' })}\n`, { mode: 0o600 }); await recordHistory(root, 'alerts', alert); }
  }
  return results;
}

export async function alertHistory(root) { return lines(join(root, 'state', 'alerts', 'alerts.jsonl')); }
export async function ceoInbox(root) { return lines(join(root, 'state', 'alerts', 'ceo-inbox.jsonl')); }

export async function evaluateAnomalies(root, events = [], tasks = []) {
  await ensure(root); let rules = {};
  try { rules = JSON.parse(await readFile(join(root, 'config', 'anomaly-rules.json'), 'utf8')); } catch { return []; }
  const now = new Date().toISOString(); const candidates = [];
  const add = (type, scope, entity, value, baseline, threshold, message) => candidates.push({ alert_id: randomUUID(), type, severity: 'WARNING', scope, entity, value, baseline, threshold, trace_id: null, task_id: null, created_at: now, timestamp: now, delivery_status: 'queued', message, source: 'config/anomaly-rules.json', measurement_type: 'estimated' });
  const numeric = events.map(item => item.total_tokens).filter(Number.isFinite);
  if (rules.token_spike?.enabled && numeric.length >= (rules.token_spike.minimum_events || 3)) { const baseline = numeric.slice(0, -1).reduce((sum, value) => sum + value, 0) / (numeric.length - 1); const latest = numeric.at(-1); if (latest > baseline * (rules.token_spike.multiplier || 2)) add('TOKEN_SPIKE', 'global', 'global', latest, baseline, rules.token_spike.multiplier, `TOKEN_SPIKE: ${latest} tokens vs baseline ${Math.round(baseline)}`); }
  const recent = events.slice(-100);
  const retries = recent.filter(item => /retry/i.test(item.operation || '')).length; if (rules.retry_storm?.enabled && retries >= (rules.retry_storm.calls || 3)) add('RETRY_STORM', 'global', 'global', retries, 0, rules.retry_storm.calls, `RETRY_STORM: ${retries} retries observados`);
  for (const [tool, count] of Object.entries(Object.fromEntries([...new Set(recent.map(item => item.tool).filter(Boolean))].map(tool => [tool, recent.filter(item => item.tool === tool).length])))) if (rules.tool_loop?.enabled && count >= (rules.tool_loop.calls || 4)) add('TOOL_LOOP', 'tool', tool, count, 0, rules.tool_loop.calls, `TOOL_LOOP: ${tool} chamado ${count} vezes`);
  const compiles = recent.filter(item => item.operation === 'context.compile').length; if (rules.context_churn?.enabled && compiles >= (rules.context_churn.calls || 5)) add('CONTEXT_CHURN', 'global', 'context', compiles, 0, rules.context_churn.calls, `CONTEXT_CHURN: ${compiles} compilações recentes`);
  const stuck = tasks.filter(task => task.active && task.created_at && Date.now() - Date.parse(task.created_at) > (rules.agent_stuck?.age_minutes || 30) * 60_000); if (rules.agent_stuck?.enabled && stuck.length) add('AGENT_STUCK', 'agent', stuck[0].agent || 'Não identificado', stuck.length, 0, rules.agent_stuck.age_minutes, `AGENT_STUCK: ${stuck.length} task(s) ativa(s) acima do limite`);
  for (const alert of candidates) { assertContract('alert', alert); const inserted = await appendOnce(join(root, 'state', 'alerts', 'alerts.jsonl'), alert, item => item.type === alert.type && item.scope === alert.scope && item.entity === alert.entity && item.active !== false); if (inserted) { await appendFile(join(root, 'state', 'alerts', 'ceo-inbox.jsonl'), `${JSON.stringify(alert)}\n`, { mode: 0o600 }); await recordHistory(root, 'alerts', alert); } }
  return candidates;
}

function classifyProcess(name) {
  const lower = name.toLowerCase();
  if (lower.includes('claude')) return { name: 'Claude CEO', role: 'CEO', runtime: 'Claude Code' };
  if (lower.includes('codex')) return { name: 'Codex CTO', role: 'CTO', runtime: 'Codex CLI' };
  if (lower.includes('antigravity') || lower === 'agy') return { name: 'Antigravity CIO', role: 'CIO', runtime: 'Antigravity CLI' };
  if (lower.includes('maestri')) return { name: 'Maestri', role: 'orchestrator', runtime: 'Maestri terminal' };
  return null;
}

export async function discoverLocalProcesses() {
  if (process.platform !== 'win32') return [];
  try {
    const { stdout } = await exec('tasklist.exe', ['/fo', 'csv', '/nh'], { timeout: 3000, windowsHide: true, maxBuffer: 1024 * 1024 });
    const timestamp = new Date().toISOString();
    return stdout.split(/\r?\n/).flatMap(line => {
      const match = line.match(/^"([^"]+)","(\d+)"/); if (!match) return [];
      const type = classifyProcess(match[1]); return type ? [{ ...type, pid: Number(match[2]), workspace: 'Lumenva', status: 'ACTIVE', task_id: null, started_at: null, last_seen: timestamp, duration: null, source: 'local-process', measurement_type: 'exact', timestamp }] : [];
    });
  } catch { return []; }
}

export async function discoverResources(root) {
  const [events, processes] = await Promise.all([telemetryEvents(root), discoverLocalProcesses()]); const groups = aggregateTelemetry(events); const agents = new Map(processes.map(agent => [agent.name, agent]));
  for (const group of groups.agents) if (!agents.has(group.agent)) agents.set(group.agent, { name: group.agent, role: null, runtime: null, pid: null, workspace: null, status: 'WORKING', task_id: null, started_at: null, last_seen: group.timestamp, duration: null, source: group.source, measurement_type: group.measurement_type, timestamp: group.timestamp });
  const runtimes = [...groups.runtimes];
  for (const process of processes) if (!runtimes.some(runtime => runtime.runtime === process.runtime)) runtimes.push({ runtime: process.runtime, sessions: 1, agents: [process.name], tasks: [], last_activity: process.last_seen, measurement_type: 'exact', source: 'local-process', timestamp: process.timestamp, tokens: null });
  return { agents: [...agents.values()], runtimes, tools: groups.tools, plugins: groups.plugins, mcps: groups.mcps, ides: groups.ides, skills: groups.skills };
}

export function coverage(events, resources) {
  const typeFor = predicate => strongest(events.filter(predicate)); const row = (name, measurement_type, source) => ({ name, measurement_type, source, timestamp: new Date().toISOString() });
  return [row('Codex tokens', typeFor(event => event.executor === 'codex' || /codex/i.test(event.runtime || '')), 'state/telemetry/events.jsonl'), row('Agents', resources.agents.length ? 'exact' : 'unavailable', resources.agents[0]?.source || 'local-process + telemetry'), row('Tools', resources.tools.length ? strongest(resources.tools) : 'unavailable', resources.tools[0]?.source || 'state/telemetry/events.jsonl'), row('Plugins', resources.plugins.length ? strongest(resources.plugins) : 'unavailable', resources.plugins[0]?.source || 'explicit task metadata'), row('MCP', resources.mcps.length ? strongest(resources.mcps) : 'unavailable', resources.mcps[0]?.source || 'state/telemetry/events.jsonl'), row('Runtime', resources.runtimes.length ? strongest(resources.runtimes) : 'unavailable', resources.runtimes[0]?.source || 'local-process + telemetry')];
}
