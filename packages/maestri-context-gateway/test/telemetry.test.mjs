import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { recordTelemetry, evaluateAlerts, aggregateTelemetry, ceoInbox, telemetryEvents } from '../src/telemetry.mjs';

const root = await mkdtemp(join(tmpdir(), 'mcg-telemetry-'));
try {
  await mkdir(join(root, 'config'), { recursive: true });
  await writeFile(join(root, 'config', 'usage-budgets.json'), JSON.stringify({ global: { token_budget: 100, warning_percent: 50, critical_percent: 80 }, executors: {}, agents: {}, plugins: {}, mcps: {}, ides: {} }));
  const recorded = await recordTelemetry(root, { executor: 'codex', agent: 'Codex CTO', runtime: 'Codex CLI', tool: 'codex-cli', plugin: 'caveman', mcp: 'local-mcp', input_tokens: 55, cached_input_tokens: 10, output_tokens: 8, reasoning_tokens: 7, total_tokens: 70, measurement_type: 'exact', source: 'provider.usage' });
  assert.equal(recorded.total_tokens, 70);
  assert.equal(recorded.cached_input_tokens, 10);
  assert.equal(recorded.reasoning_tokens, 7);
  assert.equal(recorded.measurement_type, 'exact');
  const precedence = await recordTelemetry(root, { input_tokens: 2, total_tokens: 2, measurement_type: 'estimated', source: 'provider.usage' });
  assert.equal(precedence.measurement_type, 'exact');
  assert.ok(recorded.timestamp);
  const groups = aggregateTelemetry([{ tool: 'codex-cli', timestamp: new Date().toISOString(), input_tokens: 55, total_tokens: 70, measurement_type: 'exact', source: 'provider.usage' }]);
  assert.equal(groups.tools[0].tokens, 70);
  assert.equal(groups.tools[0].measurement_type, 'exact');
  assert.equal((await evaluateAlerts(root, { tokens: 55 })).length, 1);
  assert.equal((await evaluateAlerts(root, { tokens: 49 })).length, 0);
  assert.equal((await evaluateAlerts(root, { tokens: 55 })).length, 1);
  assert.equal((await evaluateAlerts(root, { tokens: 85 })).length, 1);
  assert.equal((await evaluateAlerts(root, { tokens: 20 })).length, 0);
  const inbox = await ceoInbox(root); assert.equal(inbox[0].delivery_status, 'queued');
  const event = (await readFile(join(root, 'state', 'telemetry', 'events.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse).at(-1); assert.equal(event.source, 'provider.usage'); assert.equal(event.measurement_type, 'exact');
  assert.equal((await telemetryEvents(root))[0].total_tokens, 70);
} finally { await rm(root, { recursive: true, force: true }); }
console.log('telemetry tests: 1 passed');
