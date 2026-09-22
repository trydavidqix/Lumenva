import assert from 'node:assert/strict';
import { test } from 'node:test';
import { request } from 'node:http';
import { createServer } from 'node:http';
import { createCoreExecutionFeed, createDashboardServer } from '../src/dashboard.mjs';
import { recordTelemetry } from '../src/telemetry.mjs';

function get(port, path) {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, method: 'GET' }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject); req.end();
  });
}

test('dashboard serves read-only local endpoints', async t => {
  const server = await createDashboardServer({ root: process.cwd(), port: 0 });
  t.after(() => server.close());
  const port = server.address().port;
  const home = await get(port, '/');
  const stats = await get(port, '/api/stats');
  const tasks = await get(port, '/api/tasks');
  const health = await get(port, '/api/health');
  assert.equal(home.status, 200);
  assert.match(home.body, /TOKENS CONTEXTO EVITADOS/);
  assert.equal(stats.status, 200);
  assert.equal(tasks.status, 200);
  assert.equal(health.status, 200);
  assert.equal(JSON.parse(stats.body).tasks_processed >= 0, true);
  assert.equal(typeof JSON.parse(stats.body).observed_tokens.measurement_type, 'string');
  assert.equal(JSON.parse(tasks.body).tasks instanceof Array, true);
  assert.equal(JSON.parse(health.body).dashboard.host, '127.0.0.1');
  assert.equal(`${stats.body}${tasks.body}${health.body}`.includes('securityKeyHex'), false);
  assert.equal(`${stats.body}${tasks.body}${health.body}`.includes('b16c59355e'), false);
  assert.equal((await get(port, '/api/write')).status, 404);
  assert.equal((await get(port, '/missing')).status, 404);
});

test('dashboard exposes keyboard-accessible view navigation', async t => {
  const server = await createDashboardServer({ root: process.cwd(), port: 0 });
  t.after(() => server.close());
  const home = await get(server.address().port, '/');
  assert.match(home.body, /aria-label="Dashboard views"/);
  for (const label of ['Overview', 'History', 'Traces', 'Tasks', 'Agents', 'Tools', 'Plugins', 'MCPs', 'Graph', 'Cache', 'Memory', 'Validation', 'Alerts']) {
    assert.match(home.body, new RegExp(`data-view="${label}"`));
  }
  assert.match(home.body, /role="tablist"/);
  assert.match(home.body, /role="tabpanel"/);
});

test('dashboard exposes real telemetry resources from its configured root', async t => {
  const root = await import('node:fs/promises').then(async fs => fs.mkdtemp((await import('node:path')).join((await import('node:os')).tmpdir(), 'mcg-dashboard-')));
  t.after(async () => (await import('node:fs/promises')).rm(root, { recursive: true, force: true }));
  await recordTelemetry(root, { agent: 'Codex CTO', runtime: 'Codex CLI', ide: 'Codex CLI', tool: 'functions.exec', plugin: 'caveman', mcp: 'maestri-wire', input_tokens: 12, output_tokens: 3, total_tokens: 15, measurement_type: 'exact', source: 'codex.cli.usage' });
  const server = await createDashboardServer({ root, port: 0 });
  t.after(() => server.close());
  const port = server.address().port;
  for (const [path, key, name] of [['/api/agents', 'agents', 'Codex CTO'], ['/api/tools', 'tools', 'functions.exec'], ['/api/plugins', 'plugins', 'caveman'], ['/api/mcps', 'mcps', 'maestri-wire'], ['/api/runtimes', 'runtimes', 'Codex CLI']]) {
    const body = JSON.parse((await get(port, path)).body);
    assert.ok(Array.isArray(body[key]));
    assert.equal(JSON.stringify(body[key]).includes(name), true);
  }
});

test('dashboard hides paths and unavailable placeholders', async t => {
  const server = await createDashboardServer({ root: process.cwd(), port: 0 });
  t.after(() => server.close());
  const home = await get(server.address().port, '/');
  assert.match(home.body, /#09090B/i);
  assert.equal(home.body.includes('Gateway path'), false);
  assert.equal(home.body.includes('Métrica indisponível'), false);
  assert.equal(home.body.includes('Unknown'), false);
  assert.match(home.body, /MCG TRUST SCORE/);
  const trust = await get(server.address().port, '/api/trust');
  assert.equal(trust.status, 200);
  assert.equal(typeof JSON.parse(trust.body).status, 'string');
});

test('dashboard binds loopback only', async t => {
  const server = await createDashboardServer({ root: process.cwd(), port: 0 });
  t.after(() => server.close());
  assert.equal(server.address().address, '127.0.0.1');
});

test('pending task has no fake economy', async t => {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const os = await import('node:os');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mcg-dashboard-pending-'));
  await fs.mkdir(path.join(root, 'tasks', 'pending'), { recursive: true });
  await fs.writeFile(path.join(root, 'tasks', 'pending', 'state.json'), JSON.stringify({
    task_id: 'pending',
    executor: 'codex',
    internal_state: 'DISPATCHED',
    external_state: null,
    created_at: new Date().toISOString()
  }));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await fs.rm(root, { recursive: true, force: true }); });
  const server = await createDashboardServer({ root, port: 0 });
  const response = await get(server.address().port, '/api/tasks');
  const pending = JSON.parse(response.body).tasks.find(task => task.status === 'DISPATCHED');
  assert.ok(pending);
  assert.equal(pending.delivered_chars, null);
  assert.equal(pending.tokens_saved, null);
  assert.equal(pending.reduction_percent, null);
});

test('events endpoint is an SSE stream', async t => {
  const server = await createDashboardServer({ root: process.cwd(), port: 0 });
  t.after(() => server.close());
  const response = await new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port: server.address().port, path: '/api/events', method: 'GET' }, res => {
      let body = '';
      res.on('data', chunk => { body += chunk.toString(); if (body.includes('event: update')) { resolve({ status: res.statusCode, contentType: res.headers['content-type'], chunk: body }); req.destroy(); } });
    });
    req.on('error', error => { if (error.code !== 'ECONNRESET') reject(error); }); req.end();
  });
  assert.equal(response.status, 200);
  assert.match(response.contentType, /^text\/event-stream/);
  assert.match(response.chunk, /event: update/);
});

test('health uses wire workspace when the probe is available and hides secrets', async t => {
  const server = await createDashboardServer({ root: process.cwd(), port: 0, wireProbe: async () => ({ online: true, workspace: 'Lumenva' }) });
  t.after(() => server.close());
  const response = await get(server.address().port, '/api/health');
  const body = JSON.parse(response.body);
  assert.equal(body.workspace, 'Lumenva');
  assert.equal(body.wire, 'ONLINE');
  assert.equal(JSON.stringify(body).includes('token'), false);
  assert.equal(JSON.stringify(body).includes('securityKey'), false);
});

test('dashboard exposes resource groups, CEO alerts and persisted summary', async t => {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const os = await import('node:os');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mcg-dashboard-summary-'));
  const server = await createDashboardServer({ root, port: 0, wireProbe: async () => ({ online: true, workspace: 'Lumenva', agents: [] }) });
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await fs.rm(root, { recursive: true, force: true }); });
  const statsResponse = await get(server.address().port, '/api/stats');
  const stats = JSON.parse(statsResponse.body);
  assert.ok(Array.isArray(stats.by_plugin));
  assert.ok(Array.isArray(stats.by_tool));
  assert.ok(Array.isArray(stats.by_mcp));
  assert.ok(Array.isArray(stats.by_ide));
  assert.ok(Array.isArray(stats.alerts));
  assert.ok(Array.isArray(stats.agents));
  assert.equal(await fs.access(path.join(root, 'state', 'dashboard', 'snapshot.json')).then(() => true), true);
});


test('dashboard exposes every M0.12 view without fake zero observations', async t => {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const os = await import('node:os');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mcg-dashboard-views-'));
  const server = await createDashboardServer({ root, port: 0, wireProbe: async () => ({ online: false, workspace: 'Lumenva' }) });
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await fs.rm(root, { recursive: true, force: true }); });
  const response = await get(server.address().port, '/api/views');
  assert.equal(response.status, 200);
  const views = JSON.parse(response.body).views;
  assert.deepEqual(Object.keys(views), ['Overview','History','Traces','Tasks','Agents','Tools','Plugins','MCPs','Graph','Executions','Cache','Memory','Validation','Alerts']);
  assert.equal(views.Cache.status, 'UNAVAILABLE');
  assert.equal(views.Cache.samples, null);
  assert.equal(views.Memory.records, null);
  assert.equal(views.Validation.paired_runs, null);
  assert.equal(views.Validation.status, 'UNVALIDATED');
  assert.equal(response.body.includes('NaN'), false);
  for (const endpoint of ['/api/history','/api/cache','/api/memory','/api/validation']) {
    const item = await get(server.address().port, endpoint);
    assert.equal(item.status, 200);
    assert.equal(item.body.includes('NaN'), false);
  }
});

test('dashboard exposes read-only graph view and source drill-down', async t => {
  const server = await createDashboardServer({
    root: process.cwd(),
    port: 0,
    graphView: async () => ({
      readOnly: true,
      namespace: 'project:lumenva',
      query: 'context',
      nodes: [{ id: 'fact:1', kind: 'fact', label: 'Fact', sourceId: 'note-1' }],
      edges: [{ id: 'edge:1', source: 'fact:1', target: 'source:note-1', sourceId: 'note-1', confidence: 0.9, validFrom: '2026-01-01', validUntil: null }]
    })
  });
  t.after(() => server.close());
  const graph = await get(server.address().port, '/api/graph');
  assert.equal(graph.status, 200);
  assert.equal(JSON.parse(graph.body).readOnly, true);
  assert.match((await get(server.address().port, '/')).body, /data-view="Graph"/);
  assert.match((await get(server.address().port, '/')).body, /Graph/);
});

test('dashboard exposes persisted execution evidence as a read-only view', async t => {
  const execution = {
    id: 'execution:task-1:codex',
    taskId: 'task-1',
    traceId: 'trace-1',
    provider: 'codex',
    status: 'success',
    result: { task_id: 'task-1', status: 'success', summary: 'probe', files_changed: [], commands: ['git status --short'], tests: [{ passed: true, report: 'clean' }], evidence: ['evidence:probe'] }
  };
  const server = await createDashboardServer({ root: process.cwd(), port: 0, executionFeed: async () => [execution] });
  t.after(() => server.close());
  const port = server.address().port;
  const executions = await get(port, '/api/executions');
  assert.equal(executions.status, 200);
  assert.deepEqual(JSON.parse(executions.body).executions, [execution]);
  const views = JSON.parse((await get(port, '/api/views')).body).views;
  assert.equal(views.Executions.status, 'OBSERVED');
  assert.equal(views.Executions.count, 1);
  assert.match((await get(port, '/')).body, /data-view="Executions"/);
});

test('core execution feed reads only the loopback Core API', async t => {
  const core = createServer((req, res) => {
    assert.equal(req.url, '/executions');
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ executions: [{ id: 'execution-1', provider: 'codex' }] }));
  });
  await new Promise(resolve => core.listen(0, '127.0.0.1', resolve));
  t.after(() => core.close());
  const feed = createCoreExecutionFeed(`http://127.0.0.1:${core.address().port}`);
  assert.deepEqual(await feed(), [{ id: 'execution-1', provider: 'codex' }]);
});

test('dashboard periods stay unavailable when no context compile was observed', async t => {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const os = await import('node:os');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mcg-dashboard-periods-'));
  const server = await createDashboardServer({ root, port: 0, wireProbe: async () => ({ online: false, workspace: 'Lumenva' }) });
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await fs.rm(root, { recursive: true, force: true }); });
  const stats = JSON.parse((await get(server.address().port, '/api/stats')).body);
  assert.equal(stats.periods.today, null);
  assert.equal(stats.periods.seven_days, null);
  assert.equal(stats.periods.all_time, null);
});
