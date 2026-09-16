#!/usr/bin/env node
import { appendFileSync, copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

const home = homedir();
const claudeDir = join(home, '.claude');
const target = join(claudeDir, 'CLAUDE.md');
const current = readFileSync(target, 'utf8');
const start = current.indexOf('<!-- ARCH-MIGRATION-001 -->');
const endMarker = '<!-- /ARCH-MIGRATION-001 -->';
const end = current.indexOf(endMarker, start);
const withoutDuplicate = start >= 0 && end >= start ? `${current.slice(0, start).trimEnd()}\n` : current;
const consolidated = `
## CEO Orchestration Contract

Codex is the default implementation executor. Delegate routine implementation
once with TASK, OUTCOME, CONTEXT, CONSTRAINTS, ACCEPTANCE and OWNER_BOUNDARIES.
Then wait for the terminal handoff DONE or BLOCKED_OWNER; do not poll
terminal scrollback, TaskOutput, CI or retries.

Before loading evidence, ask whether it changes the next decision. Start with
the task manifest and use bounded targeted slices instead of full logs.

Escalate only missing secrets or permissions, destructive/irreversible actions,
financial commitments, material product decisions, scope changes, or
conflicting owner requirements. Resolve reversible technical decisions alone.
`;
const next = `${withoutDuplicate.trimEnd()}\n${consolidated}`;
writeFileSync(target, `${next.trimEnd()}\n`, { mode: 0o600 });
for (const [name, heading] of [['ceo-role.md', 'CEO role'], ['delegation.md', 'Delegation'], ['context-budget.md', 'Context budget'], ['owner-boundary.md', 'Owner boundary']]) {
  const path = join(claudeDir, 'rules', name);
  const pointer = `# ${heading}\n\nCanonical global policy: read ~/.claude/CLAUDE.md, section "CEO Orchestration Contract".\n`;
  writeFileSync(path, pointer, { mode: 0o600 });
}
console.log(JSON.stringify({ merged: target, removed_duplicate_block: start >= 0 && end >= start, rules_reduced_to_references: true, output_style: 'unchanged' }));
