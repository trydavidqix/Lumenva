import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

function run(script, cwd, env) {
  return new Promise((resolve) => {
    const child = spawn(script, [], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
}

test('verify.sh runs checks in order and stops on first failure', async () => {
  const root = await mkdtemp(join(tmpdir(), 'verify-')); const bin = join(root, 'pnpm');
  await writeFile(bin, '#!/bin/sh\nprintf "%s\\n" "$@" >> "$VERIFY_CALLS"\nprintf "CHECK_SEPARATOR\\n" >> "$VERIFY_CALLS"\n[ "$3" != "typecheck" ]\n'); await chmod(bin, 0o755);
  const calls = join(root, 'calls');
  const result = await run(join(process.cwd(), 'scripts/verify.sh'), root, { ...process.env, PATH: `${root}:${process.env.PATH}`, VERIFY_CALLS: calls });
  assert.equal(result.code, 1); const output = await readFile(calls, 'utf8');
  assert.match(output, /--filter\nlumenva-crm\nlint/); assert.match(output, /--filter\nlumenva-crm\ntypecheck/); assert.doesNotMatch(output, /test:unit|\nbuild\n/);
});

test('verify.sh runs all four required checks on success', async () => {
  const root = await mkdtemp(join(tmpdir(), 'verify-pass-')); const bin = join(root, 'pnpm');
  await writeFile(bin, '#!/bin/sh\nprintf "%s\\n" "$@" >> "$VERIFY_CALLS"\nprintf "CHECK_SEPARATOR\\n" >> "$VERIFY_CALLS"\nexit 0\n'); await chmod(bin, 0o755);
  const calls = join(root, 'calls');
  const result = await run(join(process.cwd(), 'scripts/verify.sh'), root, { ...process.env, PATH: `${root}:${process.env.PATH}`, VERIFY_CALLS: calls });
  assert.equal(result.code, 0); const groups = (await readFile(calls, 'utf8')).trim().split('CHECK_SEPARATOR').filter(Boolean).map(group => group.trim().split('\n'));
  assert.deepEqual(groups.map(group => group.slice(2)), [['lint'], ['typecheck'], ['test:unit'], ['build']]);
});
