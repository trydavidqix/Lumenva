import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { selectNextTask, runLoop, parseReviewerVerdict } from './loop-controller.mjs';

const temp = () => mkdtemp(join(tmpdir(), 'lumenva-loop-'));

test('selects only READY/BACKLOG task and lowest queue order', () => {
  const task = selectNextTask({ tasks: [
    { id: 'DONE', status: 'DONE' },
    { id: 'BLOCKED', status: 'BLOCKED' },
    { id: 'NEXT', status: 'READY' },
    { id: 'LATER', status: 'BACKLOG' },
  ] });
  assert.equal(task.id, 'NEXT');
});

test('reviewer contract accepts only exact PASS or FAIL', () => {
  assert.equal(parseReviewerVerdict('PASS'), 'PASS');
  assert.equal(parseReviewerVerdict('FAIL'), null);
  assert.equal(parseReviewerVerdict('FAIL\n1. Evidence: missing test. Recommended action: add test.'), 'FAIL');
  assert.equal(parseReviewerVerdict('FAIL\nblocking evidence'), null);
  assert.equal(parseReviewerVerdict('PASS\nextra'), null);
  assert.equal(parseReviewerVerdict('looks good'), null);
});

test('controller retries verification, then sends independent review and stops at human gate', async () => {
  const root = await temp();
  const queuePath = join(root, 'queue.json');
  const tasksPath = join(root, 'TASKS.md');
  const runlogPath = join(root, 'RUNLOG.md');
  await writeFile(queuePath, JSON.stringify({ version: 1, tasks: [{
    id: 'TASK-EXAMPLE', status: 'READY', branch: 'example', worktree: root,
    title: 'Example remediation', objective: 'Make example pass', files: ['example.ts'],
    acceptance: ['verify passes'], verification: ['scripts/verify.sh'], attempts: 0,
  }] }));
  const calls = [];
  let verifyRuns = 0;
  const result = await runLoop({ queuePath, tasksPath, runlogPath,
    runCommand: async (command, args, options = {}) => {
      calls.push({ command, args, options });
      if (command === 'git' && args[0] === 'branch') return { code: 0, stdout: 'example\n', stderr: '' };
      if (command === 'git' && args[0] === 'worktree') return { code: 0, stdout: `worktree ${root}\nHEAD abc\nbranch refs/heads/example\n`, stderr: '' };
      if (command === 'git') return { code: 0, stdout: '', stderr: '' };
      if (command.endsWith('verify.sh')) {
        verifyRuns += 1;
        return verifyRuns === 1 ? { code: 1, stdout: '', stderr: 'typecheck: failed' } : { code: 0, stdout: 'PASS', stderr: '' };
      }
      if (command === 'maestri') return { code: 0, stdout: options.role === 'reviewer' ? 'PASS' : 'READY_FOR_REVIEW', stderr: '' };
      throw new Error(`unexpected command ${command}`);
    },
  });
  assert.equal(result.status, 'READY_FOR_HUMAN');
  assert.equal(result.attempts, 2);
  assert.equal(calls.filter(call => call.command === 'maestri' && call.options.role === 'builder').length, 2);
  assert.equal(calls.filter(call => call.command === 'maestri' && call.options.role === 'reviewer').length, 1);
  assert.equal(calls.filter(call => call.command === 'maestri' && call.options.role === 'builder-recruit').length, 1);
  assert.equal(calls.filter(call => call.command === 'maestri' && call.options.role === 'reviewer-recruit').length, 1);
  assert.equal(calls.filter(call => call.command === 'maestri' && call.options.role === 'reviewer-dismiss').length, 1);
  assert.equal(calls.filter(call => call.command === 'maestri' && call.options.role === 'builder-dismiss').length, 1);
  assert.match(calls.find(call => call.command === 'maestri' && call.options.role === 'builder' && call.options.attempt === 2).args[2], /typecheck: failed/);
  const queue = JSON.parse(await readFile(queuePath, 'utf8'));
  assert.equal(queue.tasks[0].status, 'READY_FOR_HUMAN');
  assert.match(await readFile(tasksPath, 'utf8'), /TASK-EXAMPLE/);
  assert.match(await readFile(runlogPath, 'utf8'), /VERIFICATION_FAILED/);
  assert.match(await readFile(runlogPath, 'utf8'), /REVIEW_PASS/);
  assert.equal(calls.some(call => ['merge', 'push', 'deploy'].includes(call.command)), false);
});

test('controller blocks after three failed attempts', async () => {
  const root = await temp();
  const queuePath = join(root, 'queue.json');
  await writeFile(queuePath, JSON.stringify({ version: 1, tasks: [{ id: 'TASK-BLOCK', status: 'READY', branch: 'x', worktree: root, attempts: 0 }] }));
  const result = await runLoop({ queuePath, tasksPath: join(root, 'TASKS.md'), runlogPath: join(root, 'RUNLOG.md'), recruit: false,
    runCommand: async (command, args) => command === 'git' && args[0] !== 'branch' && args[0] !== 'worktree' ? { code: 0, stdout: '', stderr: '' } : command === 'git' && args[0] === 'branch' ? { code: 0, stdout: 'x\n', stderr: '' } : command === 'git' && args[0] === 'worktree' ? { code: 0, stdout: `worktree ${root}\nHEAD abc\nbranch refs/heads/x\n`, stderr: '' } : { code: 1, stdout: '', stderr: 'persistent failure' },
  });
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.attempts, 3);
});

test('controller retries reviewer FAIL with evidence and blocks duplicate worktree', async () => {
  const root = await temp(); const queuePath = join(root, 'queue.json');
  await writeFile(queuePath, JSON.stringify({ version: 1, tasks: [{ id: 'TASK-REVIEW', status: 'READY', branch: 'review', worktree: root, attempts: 0 }] }));
  let reviews = 0; const calls = [];
  const result = await runLoop({ queuePath, tasksPath: join(root, 'TASKS.md'), runlogPath: join(root, 'RUNLOG.md'), recruit: false,
    runCommand: async (command, args, options = {}) => {
      calls.push({ command, args, options });
      if (command === 'git' && args[0] === 'branch') return { code: 0, stdout: 'review\n', stderr: '' };
      if (command === 'git' && args[0] === 'worktree') return { code: 0, stdout: `worktree ${root}\nbranch refs/heads/review\n`, stderr: '' };
      if (command === 'git') return { code: 0, stdout: '', stderr: '' };
      if (command.endsWith('verify.sh')) return { code: 0, stdout: 'VERIFY PASS', stderr: '' };
      if (command === 'maestri' && options.role === 'reviewer') return ++reviews === 1 ? { code: 0, stdout: 'FAIL\n1. missing test', stderr: '' } : { code: 0, stdout: 'PASS', stderr: '' };
      return { code: 0, stdout: 'READY_FOR_REVIEW', stderr: '' };
    },
  });
  assert.equal(result.status, 'READY_FOR_HUMAN');
  assert.match(calls.find(call => call.options.role === 'builder' && call.options.attempt === 2).args[2], /missing test/);

  const duplicateRoot = await temp(); const duplicateQueue = join(duplicateRoot, 'queue.json');
  await writeFile(duplicateQueue, JSON.stringify({ version: 1, tasks: [{ id: 'TASK-DUP', status: 'READY', branch: 'dup', worktree: duplicateRoot }] }));
  const duplicate = await runLoop({ queuePath: duplicateQueue, tasksPath: join(duplicateRoot, 'TASKS.md'), runlogPath: join(duplicateRoot, 'RUNLOG.md'), recruit: false,
    runCommand: async (command, args) => command === 'git' && args[0] === 'branch' ? { code: 0, stdout: 'dup\n', stderr: '' } : command === 'git' && args[0] === 'worktree' ? { code: 0, stdout: 'worktree a\nbranch refs/heads/dup\n\nworktree b\nbranch refs/heads/dup\n', stderr: '' } : { code: 0, stdout: '', stderr: '' },
  });
  assert.equal(duplicate.status, 'BLOCKED');
});
