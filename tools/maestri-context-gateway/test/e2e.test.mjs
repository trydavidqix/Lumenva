import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dispatch, ingest, waitForTerminal } from '../src/core.mjs';

test('CEO -> MCG -> executor -> MCG terminal handoff stays structured', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mcg-e2e-'));
  await dispatch({ task_id: 'e2e-1', project: 'project-a', objective: 'small safe task', acceptance: ['pass'] }, root);
  const waiting = waitForTerminal('e2e-1', root);
  await ingest({ task_id: 'e2e-1', event_id: 'executor-1', state: 'DONE', result: 'implemented', validation: 'tests: pass', evidence: { command: 'node --test', output_reference: 'tests.log' } }, root);
  const handoff = await waiting;
  assert.deepEqual(Object.keys(handoff).sort(), ['COMMIT', 'EVIDENCE', 'RESULT', 'STATUS', 'TASK', 'VALIDATION']);
  assert.equal(handoff.STATUS, 'DONE');
  assert.doesNotMatch(JSON.stringify(handoff), /output|terminal/i);
  assert.match(await readFile(join(root, 'tasks', 'e2e-1', 'events.jsonl'), 'utf8'), /output_reference/);
});
