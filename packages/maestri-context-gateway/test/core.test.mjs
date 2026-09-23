import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dispatch, ingest, loadState } from '../src/core.mjs';
import { telemetryEvents } from '../src/telemetry.mjs';

const root = await mkdtemp(join(tmpdir(), 'mcg-core-'));
try {
  const task = await dispatch({ task_id: 'real-metadata', executor: 'codex', agent: 'Codex CTO', runtime: 'Codex CLI', ide: 'Codex CLI', source: { plugin_id: 'caveman', plugin_name: 'Caveman', skill_name: 'caveman', host_agent: 'Codex CTO' } }, root);
  assert.equal(task.source.plugin_id, 'caveman');
  await assert.rejects(ingest({ task_id: task.task_id, event_id: 'invalid-timestamp', state: 'WORKING', timestamp: 'not-a-date' }, root), /event contract invalid/);
  await ingest({ task_id: task.task_id, event_id: 'complete', sequence: 1, state: 'DONE', result: 'ok', usage: { input_tokens: 100, cached_input_tokens: 25, output_tokens: 20, reasoning_tokens: 10, total_tokens: 130, source: 'codex.cli.usage' } }, root);
  assert.equal((await loadState(task.task_id, root)).source.skill_name, 'caveman');
  const telemetry = await telemetryEvents(root);
  assert.equal(telemetry.at(-1).total_tokens, 130);
  assert.equal(telemetry.at(-1).measurement_type, 'exact');
  assert.equal(telemetry.at(-1).plugin, 'caveman');
  assert.match(task.trace_id, /^trace-/);
  const busEvents = (await readFile(join(root, 'state', 'events', 'events.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
  assert.deepEqual(busEvents.map(event => event.type), ['context.compiled', 'task.dispatched', 'task.event']);
  assert.equal(busEvents.at(-1).trace_id, task.trace_id);
} finally { await rm(root, { recursive: true, force: true }); }
console.log('core tests: 1 passed');
