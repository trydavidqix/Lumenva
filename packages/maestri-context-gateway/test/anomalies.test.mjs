import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { evaluateAlerts, evaluateAnomalies, alertHistory, ceoInbox } from '../src/telemetry.mjs';
import { validateContract } from '../src/contracts.mjs';

const root = await mkdtemp(join(tmpdir(), 'mcg-anomaly-'));
try {
  await mkdir(join(root, 'config'), { recursive: true });
  await writeFile(join(root, 'config', 'usage-budgets.json'), JSON.stringify({ global: { token_budget: 100, warning_percent: 50, critical_percent: 80 } }));
  const budgetAlerts = await evaluateAlerts(root, { tokens: 90 });
  assert.equal(validateContract('alert', budgetAlerts[0]).valid, true);
  await writeFile(join(root, 'config', 'anomaly-rules.json'), JSON.stringify({ token_spike: { enabled: true, multiplier: 2, minimum_events: 3 }, retry_storm: { enabled: true, calls: 3 }, tool_loop: { enabled: true, calls: 4 }, context_churn: { enabled: true, calls: 5 }, agent_stuck: { enabled: true, age_minutes: 30 } }));
  const events = [1, 1, 1, 9].map((total_tokens, index) => ({ total_tokens, operation: index ? 'retry' : 'run', tool: 'git' }));
  const alerts = await evaluateAnomalies(root, events, []);
  assert.ok(alerts.some(alert => alert.type === 'TOKEN_SPIKE'));
  assert.ok(alerts.some(alert => alert.type === 'RETRY_STORM'));
  assert.ok(alerts.some(alert => alert.type === 'TOOL_LOOP'));
  assert.ok(alerts.every(alert => validateContract('alert', alert).valid));
  const before = (await alertHistory(root)).length; await evaluateAnomalies(root, events, []); assert.equal((await alertHistory(root)).length, before); assert.ok((await ceoInbox(root)).every(item => item.delivery_status === 'queued'));
} finally { await rm(root, { recursive: true, force: true }); }
console.log('anomaly tests: 1 passed');
