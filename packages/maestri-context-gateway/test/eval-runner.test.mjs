import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildCodexArgs, buildLanePrompt } from '../src/eval-runner.mjs';
const sample={id:'x',category:'context-recall',evidence:'A = one\nB = two',question:'Report values.',no_evidence_question:'Unknown?',expected_contains:['one','two'],archive_lines:20,tools:[]};
assert.ok(buildLanePrompt('baseline',sample).length>buildLanePrompt('mcg',sample).length);
assert.match(buildLanePrompt('mcg',sample),/A = one/);
const args = buildCodexArgs({ model: 'gpt-5.6', effort: 'medium', workspace: '/tmp/workspace', prompt: 'test prompt' });
assert.equal(args.includes('--ask-for-approval'), false);
assert.deepEqual(args.slice(0, 2), ['exec', '--ignore-user-config']);
assert.equal(args[args.indexOf('--sandbox') + 1], 'read-only');
const root=await mkdtemp(join(tmpdir(),'mcg-eval-runner-'));
try { await writeFile(join(root,'ok'),'ok'); assert.ok(root); } finally { await rm(root,{recursive:true,force:true}); }
console.log('eval runner tests: 1 passed');
