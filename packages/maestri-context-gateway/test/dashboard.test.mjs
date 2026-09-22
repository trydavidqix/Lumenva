import assert from 'node:assert/strict';
import { test } from 'node:test';
import { request } from 'node:http';
import { createDashboardServer } from '../src/dashboard.mjs';
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
