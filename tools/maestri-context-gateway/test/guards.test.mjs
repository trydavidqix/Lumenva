import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

function run(name, input) {
  return new Promise((resolve, reject) => { const p = spawn(process.execPath, [join(import.meta.dirname, '..', 'hooks', name)]); let out = ''; p.stderr.on('data', d => out += d); p.on('error', reject); p.on('close', code => resolve({ code, out })); p.stdin.end(JSON.stringify(input)); });
}
test('polling guard warns without blocking', async () => { const r = await run('guard-polling.mjs', { tool_name: 'TaskOutput' }); assert.equal(r.code, 0); assert.match(r.out, /mcg wait/); });
test('large output guard warns without blocking', async () => { const r = await run('guard-large-output.mjs', { tool_input: { command: 'cat huge.log' } }); assert.equal(r.code, 0); assert.match(r.out, /bounded/); });
