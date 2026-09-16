import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dispatch, ingest, loadState, waitForTerminal, sliceEvidence, listTasks } from '../src/core.mjs';

const root = async () => mkdtemp(join(tmpdir(), 'mcg-test-'));

test('dispatch persists the structured task contract', async () => {
  const dir = await root(); const state = await dispatch({ task_id: 'task-1', project: 'demo', objective: 'test' }, dir);
  assert.equal(state.internal_state, 'DISPATCHED'); assert.equal((await loadState('task-1', dir)).objective, 'test');
  assert.match(await sliceEvidence('task-1', 'manifest', 20, dir), /task-1/);
});

test('ingest deduplicates events and normalizes terminal states', async () => {
  const dir = await root(); await dispatch({ task_id: 'task-2' }, dir);
  const event = { task_id: 'task-2', event_id: 'evt-1', sequence: 1, state: 'DONE', result: 'ok' };
  assert.equal((await ingest(event, dir)).deduped, false); assert.equal((await ingest(event, dir)).deduped, true);
  assert.equal((await loadState('task-2', dir)).external_state, 'DONE');
});

test('wait is silent until DONE and returns a compact handoff', async () => {
  const dir = await root(); await dispatch({ task_id: 'task-3' }, dir);
  const waiting = waitForTerminal('task-3', dir); await new Promise(resolve => setTimeout(resolve, 20));
  await ingest({ task_id: 'task-3', event_id: 'evt-3', state: 'DONE', validation: 'node --test: pass' }, dir);
  const result = await waiting; assert.equal(result.STATUS, 'DONE'); assert.equal(result.VALIDATION, 'node --test: pass');
  assert.ok(!(await readFile(join(dir, 'tasks', 'task-3', 'events.jsonl'), 'utf8')).includes('terminal'));
});

test('owner blockers remain distinct from ordinary internal states', async () => {
  const dir = await root(); await dispatch({ task_id: 'task-4' }, dir);
  await ingest({ task_id: 'task-4', event_id: 'evt-4', state: 'BLOCKED', blocker: 'secret missing', owner_needed: 'provide secret' }, dir);
  const state = await loadState('task-4', dir); assert.equal(state.external_state, 'BLOCKED_OWNER'); assert.equal(state.blocker, 'secret missing');
});

test('stale sequence is ignored and bounded evidence stays small', async () => {
  const dir = await root(); await dispatch({ task_id: 'task-5' }, dir);
  await ingest({ task_id: 'task-5', event_id: 'evt-5', sequence: 5, state: 'TESTING' }, dir);
  const stale = await ingest({ task_id: 'task-5', event_id: 'evt-old', sequence: 4, state: 'FAILED_FINAL' }, dir);
  assert.equal(stale.deduped, true); assert.equal((await loadState('task-5', dir)).internal_state, 'TESTING');
  await ingest({ task_id: 'task-5', event_id: 'evt-6', sequence: 6, state: 'DONE', validation: 'line 1\nline 2\nline 3' }, dir);
  assert.equal((await sliceEvidence('task-5', 'validation', 1, dir)).split('\n').length, 1);
});

test('one gateway root isolates multiple projects without coupling task state', async () => {
  const dir = await root(); await dispatch({ task_id: 'project-a', project: '/repo/a' }, dir); await dispatch({ task_id: 'project-b', project: '/repo/b' }, dir);
  const tasks = await listTasks(dir); assert.deepEqual(tasks.map(task => task.project).sort(), ['/repo/a', '/repo/b']);
  assert.equal((await loadState('project-a', dir)).project, '/repo/a'); assert.equal((await loadState('project-b', dir)).project, '/repo/b');
});
