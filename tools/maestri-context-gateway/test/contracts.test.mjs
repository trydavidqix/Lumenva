import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('../../..', import.meta.url).pathname;
const read = path => readFile(join(root, path), 'utf8');

test('global Codex constitution enforces terminal handoffs and evidence', async () => {
  const text = await read('config/agent-orchestration/codex/AGENTS.md');
  assert.match(text, /DONE/); assert.match(text, /BLOCKED_OWNER/); assert.match(text, /evidence/i); assert.match(text, /terminal scrollback/);
});

test('Claude constitution delegates and avoids routine polling', async () => {
  const text = await read('config/agent-orchestration/claude/CLAUDE.md');
  assert.match(text, /Codex is the default implementation\s+executor/); assert.match(text, /wait for a terminal handoff/); assert.match(text, /repeatedly poll/);
});

test('MCG config keeps secrets external and Maestri feed capability explicit', async () => {
  const text = await read('tools/maestri-context-gateway/config/default.json');
  assert.match(text, /explicit-inbox/); assert.match(text, /redact_secrets/); assert.doesNotMatch(text, /TOKEN|SECRET_VALUE|PRIVATE_KEY/);
});
