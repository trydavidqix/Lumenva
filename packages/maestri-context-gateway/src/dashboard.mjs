import { createServer } from 'node:http';
import { watch } from 'node:fs';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT } from './core.mjs';
import { loadWireConfig, wireRequest } from './wire.mjs';
import { aggregateTelemetry, alertHistory, ceoInbox, coverage, discoverResources, evaluateAlerts, evaluateAnomalies, telemetryEvents } from './telemetry.mjs';
import { aggregatePairedEvaluations, evaluationRuns, latestEvaluation, trustScore } from './evals.mjs';
import { listTraces, loadTrace } from './traces.mjs';
import { getEventBus } from './events/bus.mjs';
import { efficiencyScore, regressionWatch } from './scores.mjs';
import { getHistoryStore, HISTORY_TYPES } from './history/store.mjs';
import { MEMORY_LAYERS, MEMORY_NAMESPACES, memoryEvents, retrievalHistory } from './context/memory.mjs';

const HOST = '127.0.0.1';
const PORT = 7435;
const safeNumber = value => Number.isFinite(value) ? value : 0;
const labels = { DONE: 'CONCLUÍDA', RUNNING: 'EM EXECUÇÃO', DISPATCHED: 'ENVIADA', BLOCKED: 'BLOQUEADA', FAILED: 'FALHOU', CANCELLED: 'CANCELADA', INCOMPLETE: 'INCOMPLETA' };

async function readJson(path) { try { return JSON.parse(await readFile(path, 'utf8')); } catch { return null; } }
async function size(path) { try { return (await stat(path)).size; } catch { return null; } }
function taskStatus(state) { if (state.external_state === 'DONE') return 'DONE'; if (state.external_state === 'BLOCKED_OWNER' || state.internal_state === 'BLOCKED') return 'BLOCKED'; if (['WORKING', 'TESTING', 'BUILDING', 'CI_RUNNING', 'RETRYING'].includes(state.internal_state)) return 'RUNNING'; if (state.internal_state === 'DISPATCHED') return 'DISPATCHED'; return state.internal_state === 'CANCELLED' ? 'CANCELLED' : 'INCOMPLETE'; }
function metric(original, delivered) {
  if (!Number.isFinite(delivered)) return { original_chars: original || null, delivered_chars: null, tokens_saved: null, reduction_percent: null, measurable: false, measurement_type: 'unavailable', source: 'task result absent', timestamp: new Date().toISOString() };
  const baseline = safeNumber(original); const saved = Math.max(0, baseline - delivered); const reduction = baseline > 0 ? Number((saved / baseline * 100).toFixed(2)) : 0;
  return { original_chars: baseline, delivered_chars: delivered, tokens_saved: Math.ceil(saved / 4), reduction_percent: reduction, measurable: true, measurement_type: 'estimated', source: 'task evidence bytes / 4', timestamp: new Date().toISOString() };
}

export async function taskStats(root = ROOT) {
  let ids = []; try { ids = await readdir(join(root, 'tasks')); } catch { return []; }
  const rows = [];
  for (const id of ids) {
    const state = await readJson(join(root, 'tasks', id, 'state.json')); if (!state) continue;
    const events = await size(join(root, 'tasks', id, 'events.jsonl')); const manifest = await size(join(root, 'tasks', id, 'manifest.json')); const delivered = await size(join(root, 'tasks', id, 'result.json'));
    const source = state.source || {}; const status = taskStatus(state);
    rows.push({ task_id: id, executor: state.executor || 'Não identificado', agent: state.agent || source.host_agent || 'Não identificado', runtime: state.runtime || state.ide || 'Não identificado', plugin: source.plugin_name || source.plugin_id || 'Legacy / Não identificado', status, detail_status: state.external_state || state.internal_state || 'Não identificado', active: ['RUNNING', 'DISPATCHED'].includes(status), created_at: state.created_at || null, completed_at: status === 'DONE' ? state.updated_at || null : null, ...metric(safeNumber(events) + safeNumber(manifest), delivered) });
  }
  return rows.sort((left, right) => String(right.created_at || '').localeCompare(String(left.created_at || '')));
}

export function contextMetricsFromEvents(events = []) {
  const compiles = events.filter(event => event.operation === 'context.compile' && Number.isFinite(event.input_chars) && Number.isFinite(event.output_chars));
  const original_chars = compiles.reduce((sum, event) => sum + event.input_chars, 0);
  const delivered_chars = compiles.reduce((sum, event) => sum + event.output_chars, 0);
  const saved_chars = Math.max(0, original_chars - delivered_chars);
  const compression_ratio = original_chars > 0 ? Number((saved_chars / original_chars * 100).toFixed(2)) : null;

  const eligibleTaskIds = new Set(events.filter(event => event.task_id).map(event => event.task_id));
  const coveredTaskIds = new Set(compiles.filter(event => event.task_id).map(event => event.task_id));
  const mcg_coverage = eligibleTaskIds.size ? Number((coveredTaskIds.size / eligibleTaskIds.size * 100).toFixed(2)) : null;

  return {
    compiles,
    compression_ratio,
    mcg_coverage,
    eligible_tasks: eligibleTaskIds.size,
    covered_tasks: coveredTaskIds.size,
    estimated_context_savings: {
      original_chars,
      delivered_chars,
      saved_chars,
      estimated_tokens_original: original_chars ? Math.ceil(original_chars / 4) : null,
      estimated_tokens_delivered: original_chars ? Math.ceil(delivered_chars / 4) : null,
      estimated_tokens_avoided: original_chars ? Math.ceil(saved_chars / 4) : null,
      measurement_type: compiles.length ? 'estimated' : 'unavailable',
      source: 'context.compile observed chars; token estimate chars/4',
      timestamp: new Date().toISOString()
    }
  };
}

function taskTokenSummary(tasks, compiles) {
  const completed = tasks.filter(task => task.status === 'DONE');
  const active = tasks.filter(task => task.active);
  const original = compiles.reduce((sum, event) => sum + (Number.isFinite(event.input_chars) ? event.input_chars : 0), 0);
  const delivered = compiles.reduce((sum, event) => sum + (Number.isFinite(event.output_chars) ? event.output_chars : 0), 0);
  const saved = Math.max(0, original - delivered);
  const total = {
    executor: 'total',
    tasks_processed: completed.length,
    tasks_active: active.length,
    original_chars: original || null,
    delivered_chars: compiles.length ? delivered : null,
    saved_chars: compiles.length ? saved : null,
    reduction_percent: original > 0 ? Number((saved / original * 100).toFixed(2)) : null,
    estimated_tokens_original: original ? Math.ceil(original / 4) : null,
    estimated_tokens_delivered: compiles.length ? Math.ceil(delivered / 4) : null,
    estimated_tokens_saved: compiles.length ? Math.ceil(saved / 4) : null,
    measurement_type: compiles.length ? 'estimated' : 'unavailable',
    source: 'context.compile observed chars; token estimate chars/4',
    timestamp: new Date().toISOString()
  };

  const by_executor = {};
  for (const event of compiles) {
    const key = event.executor || 'Não identificado';
    by_executor[key] ||= {
      executor: key,
      tasks_processed: 0,
      tasks_active: tasks.filter(task => task.executor === key && task.active).length,
      original_chars: 0,
      delivered_chars: 0,
      saved_chars: 0,
      estimated_tokens_original: 0,
      estimated_tokens_delivered: 0,
      estimated_tokens_saved: 0,
      reduction_percent: null,
      measurement_type: 'estimated',
      source: 'context.compile observed chars; token estimate chars/4',
      timestamp: total.timestamp,
      task_ids: new Set()
    };
    const item = by_executor[key];
    item.original_chars += event.input_chars;
    item.delivered_chars += event.output_chars;
    item.task_ids.add(event.task_id || `compile-${item.task_ids.size}`);
  }
  for (const item of Object.values(by_executor)) {
    item.tasks_processed = item.task_ids.size;
    item.saved_chars = Math.max(0, item.original_chars - item.delivered_chars);
    item.estimated_tokens_original = Math.ceil(item.original_chars / 4);
    item.estimated_tokens_delivered = Math.ceil(item.delivered_chars / 4);
    item.estimated_tokens_saved = Math.ceil(item.saved_chars / 4);
    item.reduction_percent = item.original_chars ? Number((item.saved_chars / item.original_chars * 100).toFixed(2)) : null;
    delete item.task_ids;
  }
  return { ...total, by_executor };
}

async function wireHealth(root, wireProbe) {
  if (wireProbe) return wireProbe();
  try {
    const config = await loadWireConfig(root); const [info, workspaces] = await Promise.all([wireRequest(config, '/api/info'), wireRequest(config, '/api/workspaces')]); const workspace = workspaces.workspaces?.find(item => item.name === 'Lumenva') || workspaces.workspaces?.[0];
    return { online: Boolean(info), workspace: workspace?.name || 'Lumenva' };
  } catch { return { online: false, workspace: 'Lumenva' }; }
}

export async function health(root = ROOT, wireProbe) {
  let daemon = false; try { process.kill(Number((await readFile(join(root, 'state', 'daemon.pid'), 'utf8')).trim()), 0); daemon = true; } catch {}
  const wire = await wireHealth(root, wireProbe); return { dashboard: { host: HOST, port: PORT }, daemon: daemon ? 'ONLINE' : 'OFFLINE', wire: wire.online ? 'ONLINE' : 'OFFLINE', workspace: wire.workspace || 'Lumenva', workspace_online: wire.online, source: 'daemon.pid + Maestri Wire', measurement_type: 'exact', timestamp: new Date().toISOString() };
}

export async function dashboardStats(root = ROOT) {
  const [tasks, events, resources, evaluation, aggregate] = await Promise.all([
    taskStats(root),
    telemetryEvents(root),
    discoverResources(root),
    latestEvaluation(root),
    aggregatePairedEvaluations(root)
  ]);
  const validation = aggregate?.dataset_size > 0
    ? { ...aggregate, trust: trustScore({ ...aggregate, last_validation: aggregate.timestamp }) }
    : evaluation;
  const contextMetrics = contextMetricsFromEvents(events);
  const summary = taskTokenSummary(tasks, contextMetrics.compiles);
  const groups = aggregateTelemetry(events);
  const tokenUsage = events.reduce((sum, event) => sum + (event.total_tokens || event.estimated_tokens || 0), 0);
  const providerEvents = events.filter(event => event.measurement_type === 'exact' && Number.isFinite(event.total_tokens));
  const observed_tokens = {
    input_tokens: providerEvents.length ? providerEvents.reduce((sum, event) => sum + (event.input_tokens || 0), 0) : null,
    output_tokens: providerEvents.length ? providerEvents.reduce((sum, event) => sum + (event.output_tokens || 0), 0) : null,
    reasoning_tokens: providerEvents.length ? providerEvents.reduce((sum, event) => sum + (event.reasoning_tokens || 0), 0) : null,
    total_tokens: providerEvents.length ? providerEvents.reduce((sum, event) => sum + event.total_tokens, 0) : null,
    measurement_type: providerEvents.length ? 'exact' : 'unavailable',
    source: providerEvents.length ? [...new Set(providerEvents.map(event => event.source))].join(', ') : 'provider usage absent',
    timestamp: new Date().toISOString()
  };

  await evaluateAlerts(root, {
    tokens: tokenUsage,
    executors: Object.fromEntries(groups.agents.map(item => [item.agent, { tokens: item.tokens || 0 }])),
    agents: Object.fromEntries(groups.agents.map(item => [item.agent, { tokens: item.tokens || 0 }])),
    plugins: Object.fromEntries(groups.plugins.map(item => [item.plugin, { tokens: item.tokens || 0 }])),
    mcps: Object.fromEntries(groups.mcps.map(item => [item.mcp, { tokens: item.tokens || 0 }])),
    ides: Object.fromEntries(groups.ides.map(item => [item.ide, { tokens: item.tokens || 0 }])),
    runtimes: Object.fromEntries(groups.runtimes.map(item => [item.runtime, { tokens: item.tokens || 0 }])),
    tools: Object.fromEntries(groups.tools.map(item => [item.tool, { tokens: item.tokens || 0 }]))
  });
  await evaluateAnomalies(root, events, tasks);

  const now = Date.now();
  const contextTokensWithin = days => contextMetrics.compiles
    .filter(event => event.timestamp && now - Date.parse(event.timestamp) <= days * 86_400_000)
    .reduce((sum, event) => sum + Math.ceil(Math.max(0, event.input_chars - event.output_chars) / 4), 0);

  const trust = validation?.trust || trustScore({
    baseline: {},
    mcg: {},
    context_recall: null,
    evidence_grounding: null,
    hallucination_rate: null
  });

  const workflow_token_savings = validation?.baseline?.total_tokens != null
    && validation?.mcg?.total_tokens != null
    && validation.baseline.total_tokens > 0
    ? Number(((validation.baseline.total_tokens - validation.mcg.total_tokens) / validation.baseline.total_tokens * 100).toFixed(2))
    : null;

  const workflowMeasurement = workflow_token_savings == null
    ? 'unavailable'
    : validation?.baseline?.measurement_type === 'exact' && validation?.mcg?.measurement_type === 'exact'
      ? 'exact'
      : 'estimated';

  const efficiency = validation?.baseline && validation?.mcg
    ? efficiencyScore({
        real_token_saving: workflow_token_savings,
        task_success: validation.mcg.task_success ? 100 : 0,
        context_retention: validation.mcg.context_recall,
        evidence_grounding: validation.mcg.evidence_grounding,
        hallucination_rate: validation.mcg.hallucination_rate,
        dataset_size: validation.trust?.dataset_size ?? 0
      })
    : efficiencyScore({});

  const regression = validation?.baseline && validation?.mcg
    ? regressionWatch(validation.baseline, validation.mcg, { dataset_size: validation.trust?.dataset_size ?? 0 })
    : { status: 'UNVALIDATED', regressions: [], source: 'baseline vs MCG', measurement_type: 'unavailable', timestamp: new Date().toISOString() };

  const result = {
    ...summary,
    observed_tokens,
    tasks,
    periods: {
      today: contextMetrics.compiles.length ? contextTokensWithin(1) : null,
      seven_days: contextMetrics.compiles.length ? contextTokensWithin(7) : null,
      all_time: contextMetrics.estimated_context_savings.estimated_tokens_avoided
    },
    by_tool: resources.tools,
    by_plugin: resources.plugins,
    by_mcp: resources.mcps,
    by_ide: resources.ides,
    agents: resources.agents,
    runtimes: resources.runtimes,
    metrics: {
      compression_ratio: contextMetrics.compression_ratio,
      mcg_coverage: contextMetrics.mcg_coverage,
      coverage_basis: {
        eligible_tasks: contextMetrics.eligible_tasks,
        covered_tasks: contextMetrics.covered_tasks
      },
      estimated_context_savings: contextMetrics.estimated_context_savings,
      real_workflow_token_savings: workflow_token_savings,
      workflow_token_savings,
      workflow_token_savings_percent: workflow_token_savings,
      source: 'context.compile task coverage + paired evaluation',
      measurement_type: workflowMeasurement,
      timestamp: new Date().toISOString()
    },
    efficiency,
    regression,
    coverage: coverage(events, resources),
    trust,
    telemetry: {
      event_count: events.length,
      source: 'state/telemetry/events.jsonl',
      measurement_type: events.length ? events.reduce((best, event) => event.measurement_type === 'exact' ? 'exact' : best, 'estimated') : 'unavailable',
      timestamp: new Date().toISOString()
    },
    alerts: await alertHistory(root),
    ceo_inbox: await ceoInbox(root),
    warnings: tasks.filter(task => !task.measurable && task.active).map(task => `${task.task_id}: resultado final ausente`)
  };

  await mkdir(join(root, 'state', 'dashboard'), { recursive: true, mode: 0o700 });
  await writeFile(join(root, 'state', 'dashboard', 'snapshot.json'), `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
  return result;
}


async function cacheView(root) {
  const rows = await getHistoryStore(root).query('cache_metrics', { period: 'ALL_TIME', limit: 5000 });
  const latest = rows.at(-1)?.data || null;
  const observed = rows.length > 0;
  return {
    status: observed ? 'OBSERVED' : 'UNAVAILABLE',
    samples: observed ? rows.length : null,
    latest: latest ? {
      cache_hits: Number.isFinite(latest.cache_hits) ? latest.cache_hits : null,
      cache_misses: Number.isFinite(latest.cache_misses) ? latest.cache_misses : null,
      cache_hit_rate: Number.isFinite(latest.cache_hit_rate) ? latest.cache_hit_rate : null,
      tokens_avoided_estimated: Number.isFinite(latest.tokens_avoided_estimated) ? latest.tokens_avoided_estimated : null,
      context_reused: typeof latest.context_reused === 'boolean' ? latest.context_reused : null
    } : null,
    measurement_type: latest?.measurement_type || 'unavailable',
    source: 'HistoryStore cache_metrics',
    timestamp: new Date().toISOString()
  };
}

async function historyView(root) {
  const store = getHistoryStore(root);
  const available = new Set(await store.listAvailableTypes());
  const types = {};
  for (const type of HISTORY_TYPES) {
    if (!available.has(type)) {
      types[type] = { status: 'UNAVAILABLE', records: null, measurement_type: 'unavailable', source: `state/history/raw/${type}.jsonl` };
      continue;
    }
    const rows = await store.query(type, { period: 'ALL_TIME', limit: 5000 });
    types[type] = { status: 'OBSERVED', records: rows.length, measurement_type: rows.every(row => row.measurement_type === 'exact') ? 'exact' : 'estimated', source: `state/history/raw/${type}.jsonl` };
  }
  const measurements = Object.values(types).map(type => type.measurement_type);
  const measurement_type = measurements.includes('unavailable')
    ? 'unavailable'
    : measurements.includes('estimated') ? 'estimated' : 'exact';
  return { types, source: 'HistoryStore', measurement_type, timestamp: new Date().toISOString() };
}

async function memoryView(root) {
  const [events, retrievals] = await Promise.all([memoryEvents(root), retrievalHistory(root)]);
  const latest = new Map();
  for (const event of events) if (event.memory?.id) latest.set(event.memory.id, event.memory);
  const records = [...latest.values()];
  const count = filter => records.filter(filter).length;
  return {
    status: events.length ? 'OBSERVED' : 'UNAVAILABLE',
    records: events.length ? records.length : null,
    event_count: events.length || null,
    retrieval_count: retrievals.length || null,
    layers: Object.fromEntries(MEMORY_LAYERS.map(layer => [layer, events.length ? count(item => item.layer === layer) : null])),
    namespaces: Object.fromEntries(MEMORY_NAMESPACES.map(namespace => [namespace, events.length ? count(item => item.namespace?.startsWith(namespace)) : null])),
    statuses: events.length ? Object.fromEntries([...new Set(records.map(item => item.status))].map(status => [status, count(item => item.status === status)])) : null,
    source: 'state/memory/events.jsonl + retrieval.jsonl',
    measurement_type: events.length ? 'exact' : 'unavailable',
    timestamp: new Date().toISOString()
  };
}

async function validationView(root) {
  const [runs, aggregate] = await Promise.all([evaluationRuns(root), aggregatePairedEvaluations(root)]);
  const trust = trustScore({ ...aggregate, dataset_size: aggregate.dataset_size, last_validation: runs.at(-1)?.timestamp || null });
  return {
    status: trust.status,
    paired_runs: aggregate.dataset_size || null,
    minimum_dataset: trust.minimum_dataset,
    categories: Object.keys(aggregate.categories).length ? aggregate.categories : null,
    trust,
    latest_run_id: runs.at(-1)?.run_id || null,
    source: aggregate.source,
    measurement_type: aggregate.measurement_type,
    timestamp: new Date().toISOString()
  };
}

export async function dashboardViews(root = ROOT, { graphView } = {}) {
  const [stats, history, traces, cache, memory, validation] = await Promise.all([
    dashboardStats(root), historyView(root), listTraces(root), cacheView(root), memoryView(root), validationView(root)
  ]);
  const unavailable = (source) => ({ status: 'UNAVAILABLE', observations: null, measurement_type: 'unavailable', source, timestamp: new Date().toISOString() });
  return {
    Overview: { status: 'OBSERVED', tasks_processed: stats.tasks_processed, tasks_active: stats.tasks_active, metrics: stats.metrics, measurement_type: stats.telemetry.measurement_type, source: stats.telemetry.source, timestamp: new Date().toISOString() },
    History: history,
    Traces: traces.length ? { status: 'OBSERVED', count: traces.length, traces, measurement_type: 'exact', source: 'state/telemetry/traces/*.jsonl', timestamp: new Date().toISOString() } : unavailable('state/telemetry/traces/*.jsonl'),
    Tasks: { status: stats.tasks.length ? 'OBSERVED' : 'UNAVAILABLE', count: stats.tasks.length || null, tasks: stats.tasks.length ? stats.tasks : null, measurement_type: stats.tasks.length ? 'estimated' : 'unavailable', source: 'tasks/*/state.json + evidence', timestamp: new Date().toISOString() },
    Agents: { status: stats.agents.length ? 'OBSERVED' : 'UNAVAILABLE', count: stats.agents.length || null, items: stats.agents.length ? stats.agents : null, measurement_type: stats.agents[0]?.measurement_type || 'unavailable', source: 'local-process + telemetry', timestamp: new Date().toISOString() },
    Tools: { status: stats.by_tool.length ? 'OBSERVED' : 'UNAVAILABLE', count: stats.by_tool.length || null, items: stats.by_tool.length ? stats.by_tool : null, measurement_type: stats.by_tool[0]?.measurement_type || 'unavailable', source: 'state/telemetry/events.jsonl', timestamp: new Date().toISOString() },
    Plugins: { status: stats.by_plugin.length ? 'OBSERVED' : 'UNAVAILABLE', count: stats.by_plugin.length || null, items: stats.by_plugin.length ? stats.by_plugin : null, measurement_type: stats.by_plugin[0]?.measurement_type || 'unavailable', source: 'explicit task metadata + telemetry', timestamp: new Date().toISOString() },
    MCPs: { status: stats.by_mcp.length ? 'OBSERVED' : 'UNAVAILABLE', count: stats.by_mcp.length || null, items: stats.by_mcp.length ? stats.by_mcp : null, measurement_type: stats.by_mcp[0]?.measurement_type || 'unavailable', source: 'state/telemetry/events.jsonl', timestamp: new Date().toISOString() },
    Graph: graphView ? { ...await graphView(), measurement_type: 'exact', source: 'Core GET /graph; read-only', timestamp: new Date().toISOString() } : unavailable('Core GET /graph; graph provider not configured'),
    Cache: cache,
    Memory: memory,
    Validation: validation,
    Alerts: { status: stats.alerts.length || stats.ceo_inbox.length ? 'OBSERVED' : 'UNAVAILABLE', count: stats.alerts.length + stats.ceo_inbox.length || null, items: stats.alerts.length || stats.ceo_inbox.length ? [...stats.alerts, ...stats.ceo_inbox] : null, measurement_type: stats.alerts.length || stats.ceo_inbox.length ? 'estimated' : 'unavailable', source: 'state/alerts/*.jsonl', timestamp: new Date().toISOString() }
  };
}

const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lumenva Context Gateway</title><style>
:root{color-scheme:dark;--bg:#09090B;--head:#0D0D0F;--section:#111113;--card:#161619;--inner:#1C1C20;--hover:#232328;--line:#2B2B31;--strong:#3A3A42;--muted:#787880;--sub:#A1A1AA;--text:#E4E4E7;--white:#FAFAFA;--green:#5EEAD4;--orange:#FBBF24;--red:#FB7185;--blue:#60A5FA}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top right,#18181B 0%,#09090B 42%);color:var(--text);font:14px/1.45 ui-sans-serif,system-ui,sans-serif}main{max-width:1500px;margin:auto;padding:24px}header{display:flex;justify-content:space-between;align-items:end;padding:0 0 22px;border-bottom:1px solid var(--line)}h1,h2,h3,p{margin:0}h1{font-size:24px;letter-spacing:.08em;color:var(--white)}h2{font-size:12px;letter-spacing:.12em;color:var(--sub);text-transform:uppercase;margin-bottom:12px}.sub{margin-top:5px;color:var(--sub)}.live{font-size:12px;color:var(--green)}.grid{display:grid;gap:12px;margin-top:18px}.kpis{grid-template-columns:repeat(6,minmax(120px,1fr))}.trio{grid-template-columns:repeat(3,1fr)}.two{grid-template-columns:repeat(2,minmax(0,1fr))}.card,.panel{border:1px solid var(--line);border-radius:10px;background:linear-gradient(145deg,#1C1C20 0%,#111113 100%)}.card{padding:15px}.panel{padding:18px}.label{color:var(--muted);font-size:11px;letter-spacing:.08em}.value{font-size:25px;font-weight:750;margin-top:5px}.good{color:var(--green)}.important{color:var(--orange)}.muted{color:var(--muted)}.health{display:flex;gap:16px;flex-wrap:wrap;color:var(--sub)}.health b{color:var(--text)}.dot{color:var(--green)}table{width:100%;border-collapse:collapse;font-size:12px;min-width:1060px}th,td{text-align:left;padding:9px;border-bottom:1px solid var(--line)}th{color:var(--muted);font-weight:500}.scroll{overflow:auto}.badge{font-size:10px;border:1px solid currentColor;border-radius:999px;padding:2px 6px;white-space:nowrap}.exact{color:var(--green)}.estimated{color:var(--orange)}.unavailable{color:var(--muted)}.resource{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:9px}.resource .card{background:var(--inner)}.empty{color:var(--muted);padding:4px 0}.bar{height:8px;border-radius:8px;background:var(--line);overflow:hidden;margin-top:8px}.bar i{display:block;height:100%;background:var(--green)}@media(max-width:1000px){main{padding:16px}.kpis,.trio,.two{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.kpis,.trio,.two{grid-template-columns:1fr}header{align-items:start;gap:10px;flex-direction:column}}
</style></head><body><main><header><div><h1>LUMENVA CONTEXT GATEWAY</h1><p class="sub">Workspace: <b>Lumenva</b></p></div><div class="live" id="live">● CONECTANDO</div></header><section class="grid kpis" id="kpis"></section><section class="grid"><div class="panel"><div class="health" id="health"></div></div></section><section class="grid trio" id="periods"></section><section class="grid two"><div class="panel"><h2>Volume de contexto</h2><div id="volume"></div></div><div class="panel"><h2>Contexto evitado por executor (estimado)</h2><div id="executors"></div></div></section><section class="grid two"><div class="panel"><h2>Maiores consumidores</h2><div id="tools"></div></div><div class="panel"><h2>Agentes ativos</h2><div id="agents"></div></div></section><section class="grid"><div class="panel"><h2>Tasks recentes</h2><div class="scroll" id="tasks"></div></div></section><section class="grid"><div class="panel"><h2>Cobertura de telemetria</h2><div class="resource" id="coverage"></div></div></section><section class="grid"><div class="panel"><h2>MCG TRUST SCORE</h2><div id="trust"></div></div></section><section class="grid"><div class="panel"><h2>Alertas globais e CEO</h2><div id="alerts"></div></div></section></main><script>
const $=id=>document.getElementById(id),n=value=>Number.isFinite(value)?value.toLocaleString('pt-BR'):'—',p=value=>Number.isFinite(value)?value.toFixed(2)+'%':'—',e=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])),tag=type=>'<span class="badge '+type+'">'+({exact:'EXATO',estimated:'ESTIMADO',unavailable:'INDISPONÍVEL'}[type]||'INDISPONÍVEL')+'</span>',state={DONE:'CONCLUÍDA',RUNNING:'EM EXECUÇÃO',DISPATCHED:'ENVIADA',BLOCKED:'BLOQUEADA',FAILED:'FALHOU',CANCELLED:'CANCELADA',INCOMPLETE:'INCOMPLETA'};
function cards(target,items){$(target).innerHTML=items.map(item=>'<div class="card"><div class="label">'+item[0]+'</div><div class="value '+(item[2]||'')+'">'+(item[3]==='percent'?p(item[1]):n(item[1]))+'</div></div>').join('')}
function resource(items,key){return items.length?'<div class="resource">'+items.map(item=>'<div class="card"><b>'+e(item[key])+'</b><br><span class="muted">'+n(item.tokens)+' tokens · '+n(item.calls)+' calls</span><br>'+tag(item.measurement_type)+'</div>').join('')+'</div>':'<p class="empty">Sem observação atribuída.</p>'}
function render(data){cards('kpis',[['TAREFAS CONCLUÍDAS',data.tasks_processed],['TAREFAS ATIVAS',data.tasks_active],['TOKENS CONTEXTO ORIGINAL (EST.)',data.estimated_tokens_original],['TOKENS CONTEXTO ENTREGUE (EST.)',data.estimated_tokens_delivered],['TOKENS CONTEXTO EVITADOS (EST.)',data.estimated_tokens_saved,'good'],['COMPRESSÃO %',data.metrics.compression_ratio,'important','percent']]);$('health').innerHTML=[['MCG DAEMON',data.health.daemon],['WIRE',data.health.wire],['WORKSPACE',data.health.workspace],['SSE / AO VIVO',$('live').textContent.includes('AO VIVO')?'ONLINE':'POLLING']].map(item=>'<span><i class="dot">●</i> '+item[0]+': <b>'+e(item[1])+'</b></span>').join('');cards('periods',[['CONTEXTO EVITADO HOJE (EST.)',data.periods.today,'good'],['CONTEXTO EVITADO 7 DIAS (EST.)',data.periods.seven_days,'good'],['CONTEXTO EVITADO ALL TIME (EST.)',data.periods.all_time,'good']]);$('volume').innerHTML=[['Original',data.original_chars,'var(--blue)'],['Entregue',data.delivered_chars,'var(--orange)'],['Economizado',data.saved_chars,'var(--green)']].map(item=>'<p>'+item[0]+' <b>'+n(item[1])+'</b><span class="bar"><i style="width:'+Math.min(100,data.original_chars?item[1]/data.original_chars*100:0)+'%;background:'+item[2]+'"></i></span></p>').join('');$('executors').innerHTML=Object.values(data.by_executor).filter(item=>item.tasks_processed||item.tasks_active).map(item=>'<div class="card"><b>'+e(item.executor)+'</b><br>'+n(item.estimated_tokens_saved)+' economizados · '+p(item.reduction_percent)+'<br>'+tag(item.measurement_type)+'</div>').join('')||'<p class="empty">Sem executor concluído.</p>';$('tools').innerHTML=resource(data.by_tool,'tool');$('agents').innerHTML=data.agents.length?'<div class="resource">'+data.agents.map(agent=>'<div class="card"><b>'+e(agent.name)+'</b><br>'+e(agent.status)+' · '+e(agent.runtime||'runtime não identificado')+'<br>'+tag(agent.measurement_type)+'</div>').join('')+'</div>':'<p class="empty">Sem agente ativo observado.</p>';$('tasks').innerHTML=data.tasks.length?'<table><thead><tr><th>TASK</th><th>EXECUTOR</th><th>AGENT</th><th>RUNTIME</th><th>PLUGIN</th><th>STATUS</th><th>ORIGINAL</th><th>ENTREGUE</th><th>ECONOMIZADOS</th><th>REDUÇÃO</th><th>MEDIÇÃO</th></tr></thead><tbody>'+data.tasks.map(task=>'<tr><td>'+e(task.task_id)+'</td><td>'+e(task.executor)+'</td><td>'+e(task.agent)+'</td><td>'+e(task.runtime)+'</td><td>'+e(task.plugin)+'</td><td>'+e(state[task.status]||task.status)+'</td><td>'+n(task.original_chars)+'</td><td>'+n(task.delivered_chars)+'</td><td>'+n(task.tokens_saved)+'</td><td>'+p(task.reduction_percent)+'</td><td>'+tag(task.measurement_type)+'</td></tr>').join('')+'</tbody></table>':'<p class="empty">Sem tasks.</p>';$('coverage').innerHTML=data.coverage.map(item=>'<div class="card"><b>'+e(item.name)+'</b><br>'+tag(item.measurement_type)+'<br><span class="muted">'+e(item.source)+'</span></div>').join('');$('trust').innerHTML='<div class="resource"><div class="card"><b>'+e(data.trust.status)+'</b><br>Score: '+n(data.trust.score)+'<br>Recall: '+n(data.trust.context_recall)+' · Grounding: '+n(data.trust.evidence_grounding)+'<br>Economia qualificada: '+p(data.trust.quality_preserving_saving)+'</div></div>';const all=[...data.alerts,...data.ceo_inbox];$('alerts').innerHTML=all.length?all.map(alert=>'<p class="card">'+e(alert.severity||alert.level)+' · '+e(alert.message)+' · '+e(alert.delivery_status||'dashboard')+'</p>').join(''):'<p class="empty">Sem alertas ativos.</p>'}
async function load(){const [stats,tasks,health]=await Promise.all(['/api/stats','/api/tasks','/api/health'].map(path=>fetch(path).then(response=>response.json())));render({...stats,tasks:tasks.tasks,health})}let poll;function fallback(){if(poll)return;$('live').textContent='● POLLING · 2s';poll=setInterval(()=>load().catch(()=>{$('live').textContent='● DESCONECTADO'}),2000)}const stream=new EventSource('/api/events');stream.onopen=()=>{$('live').textContent='● AO VIVO';if(poll){clearInterval(poll);poll=null}};stream.addEventListener('update',()=>load().catch(fallback));stream.onerror=()=>{stream.close();fallback()};load().catch(fallback);
</script></body></html>`;

const dashboardNav = '<section class="grid"><div class="panel"><h2>Command Center</h2><nav class="view-tabs" aria-label="Dashboard views" role="tablist">' +
  ['Overview', 'History', 'Traces', 'Tasks', 'Agents', 'Tools', 'Plugins', 'MCPs', 'Graph', 'Cache', 'Memory', 'Validation', 'Alerts']
    .map((view, index) => `<button class="view-tab" type="button" role="tab" data-view="${view}" aria-selected="${index === 0 ? 'true' : 'false'}" aria-controls="view-panel">${view}</button>`)
    .join('') +
  '</nav><div id="view-panel" role="tabpanel" tabindex="0"><p class="empty">Carregando views observadas.</p></div></div></section>';

const dashboardScript = `<script>
const viewData = {};
const viewPanel = document.getElementById('view-panel');
const viewTabs = [...document.querySelectorAll('[data-view]')];
const viewValue = value => value === null || value === undefined ? 'INDISPONÍVEL' : typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
function renderView(name) {
  const view = viewData[name];
  viewTabs.forEach(tab => tab.setAttribute('aria-selected', String(tab.dataset.view === name)));
  if (!view) { viewPanel.innerHTML = '<p class="empty">View indisponível.</p>'; return; }
  if (name === 'Graph' && view.readOnly && Array.isArray(view.nodes) && Array.isArray(view.edges)) {
    const nodes = view.nodes.map(node => '<div class="card"><b>' + e(node.label) + '</b><br><span class="muted">' + e(node.kind) + ' · ' + e(node.id) + '</span></div>').join('');
    const edges = view.edges.map(edge => '<div class="card"><b>' + e(edge.sourceId) + '</b><br><span class="muted">confidence ' + e(edge.confidence) + ' · ' + e(edge.validFrom || 'sem início') + ' → ' + e(edge.validUntil || 'atual') + '</span></div>').join('');
    viewPanel.innerHTML = '<div class="view-meta"><b>Graph</b> ' + tag(view.measurement_type) + '<span class="muted">READ-ONLY · ' + e(view.namespace) + ' · ' + e(view.query) + '</span></div><h3>Entidades</h3><div class="resource">' + (nodes || '<p class="empty">Nenhum nó encontrado.</p>') + '</div><h3>Fontes / relações</h3><div class="resource">' + (edges || '<p class="empty">Nenhuma relação encontrada.</p>') + '</div>';
    return;
  }
  const entries = Object.entries(view).filter(([key]) => !['timestamp', 'source'].includes(key));
  viewPanel.innerHTML = '<div class="view-meta"><b>' + e(name) + '</b> ' + tag(view.measurement_type) + '<span class="muted">' + e(view.status || 'OBSERVED') + '</span></div>' +
    '<pre class="view-json">' + e(JSON.stringify(Object.fromEntries(entries.map(([key, value]) => [key, viewValue(value)])), null, 2)) + '</pre>';
}
async function loadViewRegistry() {
  try {
    const response = await fetch('/api/views');
    if (!response.ok) throw new Error('view registry unavailable');
    Object.assign(viewData, (await response.json()).views || {});
    renderView('Overview');
  } catch {
    viewPanel.innerHTML = '<p class="empty">Não foi possível carregar views. <button id="view-retry" type="button">Tentar novamente</button></p>';
    document.getElementById('view-retry').addEventListener('click', loadViewRegistry);
  }
}
viewTabs.forEach(tab => tab.addEventListener('click', () => renderView(tab.dataset.view)));
loadViewRegistry();
</script>`;

const dashboardHtml = html
  .replace('</header><section class="grid kpis"', `${dashboardNav}</header><section class="grid kpis"`)
  .replace('</script></body></html>', `</script>${dashboardScript}</body></html>`);

function sendJson(res, body) { res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); }

export function createDashboardServer({ root = ROOT, port = PORT, wireProbe, graphView } = {}) {
  const clients = new Set(); let previous = '';
  const snapshot = async () => ({ stats: await dashboardStats(root), health: await health(root, wireProbe) });
  const publish = async () => { const data = await snapshot(); const encoded = JSON.stringify(data); if (encoded === previous) return; previous = encoded; for (const client of clients) client.write(`event: update\ndata: ${encoded}\n\n`); };
  const unsubscribe = getEventBus(root).subscribe(() => { publish().catch(() => {}); });
  let eventWatcher; try { eventWatcher = watch(join(root, 'state', 'events', 'events.jsonl'), () => { publish().catch(() => {}); }); } catch { /* polling remains fallback */ }
  const timer = setInterval(() => { publish().catch(() => {}); }, 2000);
  const server = createServer(async (req, res) => {
    if (req.method !== 'GET') { res.writeHead(405, { Allow: 'GET' }); return res.end('Method Not Allowed'); }
    try {
      if (req.url === '/') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); return res.end(dashboardHtml); }
      if (req.url === '/api/events') { res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', Connection: 'keep-alive', 'Cache-Control': 'no-cache' }); clients.add(res); await publish(); req.on('close', () => clients.delete(res)); return; }
      if (req.url === '/api/stats') return sendJson(res, await dashboardStats(root));
      if (req.url === '/api/views') return sendJson(res, { views: await dashboardViews(root, { graphView }), source: 'dashboard view registry', measurement_type: 'exact', timestamp: new Date().toISOString() });
      if (req.url === '/api/graph') return graphView ? sendJson(res, await graphView()) : sendJson(res, { error: 'GRAPH_UNAVAILABLE', readOnly: true, measurement_type: 'unavailable', source: 'Core GET /graph' });
      if (req.url === '/api/history') return sendJson(res, await historyView(root));
      if (req.url === '/api/cache') return sendJson(res, await cacheView(root));
      if (req.url === '/api/memory') return sendJson(res, await memoryView(root));
      if (req.url === '/api/validation') return sendJson(res, await validationView(root));
      if (req.url === '/api/tasks') return sendJson(res, { tasks: await taskStats(root), source: 'tasks/*/state.json + evidence', measurement_type: 'estimated', timestamp: new Date().toISOString() });
      if (req.url === '/api/health') return sendJson(res, await health(root, wireProbe));
      if (req.url === '/api/trust') return sendJson(res, (await dashboardStats(root)).trust);
      if (req.url === '/api/traces') return sendJson(res, { traces: await listTraces(root), source: 'state/telemetry/traces/*.jsonl', measurement_type: 'exact', timestamp: new Date().toISOString() });
      if (req.url.startsWith('/api/traces/')) {
        const traceId = decodeURIComponent(req.url.slice('/api/traces/'.length));
        if (!/^trace-[A-Za-z0-9-]+$/.test(traceId)) return sendJson(res, { error: 'invalid trace_id', measurement_type: 'unavailable', source: 'dashboard', timestamp: new Date().toISOString() });
        return sendJson(res, await loadTrace(root, traceId));
      }
      const resources = await discoverResources(root);
      if (req.url === '/api/agents') return sendJson(res, { agents: resources.agents, source: 'local-process + telemetry', measurement_type: resources.agents.length ? 'exact' : 'unavailable', timestamp: new Date().toISOString() });
      if (req.url === '/api/tools') return sendJson(res, { tools: resources.tools, source: 'state/telemetry/events.jsonl', measurement_type: resources.tools[0]?.measurement_type || 'unavailable', timestamp: new Date().toISOString() });
      if (req.url === '/api/plugins') return sendJson(res, { plugins: resources.plugins, skills: resources.skills, source: 'explicit task metadata + telemetry', measurement_type: resources.plugins[0]?.measurement_type || 'unavailable', timestamp: new Date().toISOString() });
      if (req.url === '/api/mcps') return sendJson(res, { mcps: resources.mcps, source: 'state/telemetry/events.jsonl', measurement_type: resources.mcps[0]?.measurement_type || 'unavailable', timestamp: new Date().toISOString() });
      if (req.url === '/api/runtimes') return sendJson(res, { runtimes: resources.runtimes, ides: resources.ides, source: 'local-process + telemetry', measurement_type: resources.runtimes[0]?.measurement_type || resources.ides[0]?.measurement_type || 'unavailable', timestamp: new Date().toISOString() });
      if (req.url === '/api/alerts') return sendJson(res, { alerts: await alertHistory(root), source: 'state/alerts/alerts.jsonl', measurement_type: 'estimated', timestamp: new Date().toISOString() });
      if (req.url === '/api/alerts/ceo') return sendJson(res, { alerts: await ceoInbox(root), source: 'state/alerts/ceo-inbox.jsonl', measurement_type: 'estimated', timestamp: new Date().toISOString() });
      res.writeHead(404); res.end('Not Found');
    } catch { sendJson(res, { error: 'falha ao ler dashboard', measurement_type: 'unavailable', source: 'dashboard', timestamp: new Date().toISOString() }); }
  });
  server.on('close', () => { clearInterval(timer); eventWatcher?.close(); unsubscribe(); for (const client of clients) client.end(); clients.clear(); });
  return new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, HOST, () => resolve(server)); });
}
