import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stats } from '../src/core.mjs';

const root = await mkdtemp(join(tmpdir(), 'mcg-stats-'));
try {
  await mkdir(join(root, 'tasks', 'one'), { recursive: true });
  await writeFile(join(root, 'tasks', 'one', 'state.json'), JSON.stringify({ task_id: 'one', executor: 'codex' }));
  await writeFile(join(root, 'tasks', 'one', 'events.jsonl'), '1234567890');
  await writeFile(join(root, 'tasks', 'one', 'result.json'), '{}');
  await mkdir(join(root, 'tasks', 'two'), { recursive: true });
  await writeFile(join(root, 'tasks', 'two', 'state.json'), '{invalid');
  const result = await stats(root, { tokens: true });
  assert.equal(result.tasks_processed, 1);
  assert.equal(result.original_chars, 10);
  assert.equal(result.delivered_chars, 2);
  assert.equal(result.saved_chars, 8);
  assert.equal(result.reduction_percent, 80);
  assert.equal(result.by_executor.codex.tasks_processed, 1);
  assert.match(result.tokenizer, /^ESTIMATIVA:/);
  assert.equal(result.warnings.length, 2);
} finally { await rm(root, { recursive: true, force: true }); }
console.log('stats tests: 1 passed');
