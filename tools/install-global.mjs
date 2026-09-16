#!/usr/bin/env node
import { appendFileSync, chmodSync, copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

const home = homedir();
const repo = process.env.MCG_SOURCE_ROOT || process.cwd();
const codex = join(home, '.codex');
const claude = join(home, '.claude');
const mcg = join(home, '.lumenva', 'maestri-context-gateway');
const copy = (source, target, mode = 0o600) => { mkdirSync(dirname(target), { recursive: true, mode: 0o700 }); copyFileSync(source, target); chmodSync(target, mode); };
copy(join(repo, 'config/agent-orchestration/codex/AGENTS.md'), join(codex, 'AGENTS.md'), 0o600);
copy(join(repo, 'config/agent-orchestration/codex/agents/executor.toml'), join(codex, 'agents/executor.toml'));
for (const name of ['ceo-role.md', 'delegation.md', 'context-budget.md', 'owner-boundary.md']) copy(join(repo, `config/agent-orchestration/claude/rules/${name}`), join(claude, 'rules', name));
copy(join(repo, 'config/agent-orchestration/claude/output-styles/ceo-orchestrator.md'), join(claude, 'output-styles/ceo-orchestrator.md'));
for (const name of ['executor-handoff', 'executor-validation', 'executor-evidence']) copy(join(repo, `config/agent-orchestration/codex/skills/${name}/SKILL.md`), join(home, '.agents', 'skills', name, 'SKILL.md'));
for (const name of ['delegate-codex', 'accept-handoff', 'resolve-blocked-owner', 'inspect-evidence', 'strategic-handoff']) copy(join(repo, `config/agent-orchestration/claude/skills/${name}/SKILL.md`), join(claude, 'skills', name, 'SKILL.md'));
for (const name of ['CLAUDE.md']) {
  const target = join(claude, name); const marker = '\n<!-- ARCH-MIGRATION-001 -->\n';
  const text = readFileSync(join(repo, `config/agent-orchestration/claude/${name}`), 'utf8');
  const current = readFileSync(target, 'utf8'); if (!current.includes(marker.trim())) appendFileSync(target, `${marker}${text}\n<!-- /ARCH-MIGRATION-001 -->\n`);
}
for (const path of ['src/core.mjs', 'bin/mcg.mjs', 'config/default.json', 'hooks/guard-polling.mjs', 'hooks/guard-large-output.mjs']) copy(join(repo, 'tools/maestri-context-gateway', path), join(mcg, path));
const wrapper = join(home, '.local', 'bin', 'mcg'); mkdirSync(dirname(wrapper), { recursive: true, mode: 0o700 }); writeFileSync(wrapper, `#!/bin/sh\nexec /usr/bin/env node "${mcg}/bin/mcg.mjs" "$@"\n`, { mode: 0o700 }); chmodSync(wrapper, 0o700);
const settingsPath = join(claude, 'settings.json'); const settings = JSON.parse(readFileSync(settingsPath, 'utf8')); settings.hooks ??= {};
if (Array.isArray(settings.hooks.PreToolUse)) {
  const add = (command, marker) => { if (!settings.hooks.PreToolUse.some(entry => entry?.hooks?.some(hook => hook.command?.includes(marker)))) settings.hooks.PreToolUse.push({ matcher: '.*', hooks: [{ type: 'command', command, timeout: 1000 }] }); };
  add(`node ${mcg}/hooks/guard-polling.mjs`, 'guard-polling.mjs'); add(`node ${mcg}/hooks/guard-large-output.mjs`, 'guard-large-output.mjs');
} else if (settings.hooks.PreToolUse === undefined) {
  settings.hooks.PreToolUse = [
    { matcher: '.*', hooks: [{ type: 'command', command: `node ${mcg}/hooks/guard-polling.mjs`, timeout: 1000 }] },
    { matcher: '.*', hooks: [{ type: 'command', command: `node ${mcg}/hooks/guard-large-output.mjs`, timeout: 1000 }] },
  ];
}
writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({ installed: ['codex/AGENTS.md', 'codex/agents/executor.toml', 'claude/CLAUDE.md:additive', 'claude/rules', 'claude/output-styles', 'mcg', 'claude/settings.json:observe-hooks'], codex_config: 'unchanged:unsupported-key-not-invented' }));
