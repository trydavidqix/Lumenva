import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runProcess } from '../src/executor.mjs';

test('executor captures output and classifies success', async () => {
  const result = await runProcess({ command: process.execPath, args: ['-e', "process.stdout.write('ok')"], job_class: 'TINY' });
  assert.equal(result.classification, 'SUCCESS');
  assert.equal(result.stdout, 'ok');
  assert.equal(result.code, 0);
});

test('executor times out with configurable policy', async () => {
  const result = await runProcess({
    command: process.execPath,
    args: ['-e', 'setTimeout(() => {}, 1000)'],
    job_class: 'TINY',
    timeout_ms: 40,
    heartbeat_ms: 10,
    grace_ms: 10
  });
  assert.equal(result.classification, 'TIMEOUT');
  assert.equal(result.timed_out, true);
  assert.ok(result.heartbeat_count >= 1);
});

test('executor supports cancellation', async () => {
  const controller = new AbortController();
  const pending = runProcess({
    command: process.execPath,
    args: ['-e', 'setTimeout(() => {}, 1000)'],
    timeout_ms: 1000,
    grace_ms: 10,
    signal: controller.signal
  });
  setTimeout(() => controller.abort(), 20);
  const result = await pending;
  assert.equal(result.classification, 'CANCELLED');
  assert.equal(result.cancelled, true);
});
