import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { route, codexCloudStatus, createJulesSession, validateReceipt, completionBlockers, gitSafetyViolation, evaluateHook } from './gate.mjs';

const sha = 'a'.repeat(40);
const base = { run_id: 'run-1', kind: 'code', branch: 'chore/test', head_sha: sha, sealed: true, primary_executor: 'codex', reviewer: 'jules', providers: {} };

test('complex and ambiguous tasks route Codex executor, Jules reviewer', () => {
  assert.deepEqual(route('code', 'cross-package architecture'), { primary_executor: 'codex', reviewer: 'jules' });
  assert.deepEqual(route('code', ''), { primary_executor: 'codex', reviewer: 'jules' });
});
test('small isolated tasks route Jules executor, Codex reviewer', () => {
  assert.deepEqual(route('small', 'small'), { primary_executor: 'jules', reviewer: 'codex' });
});
test('docs-only completion uses lightweight path', () => {
  assert.deepEqual(completionBlockers({ ...base, kind: 'docs-only' }, sha, 'chore/test'), []);
});
test('missing Codex evidence blocks completion', () => {
  assert.ok(completionBlockers(base, sha, 'chore/test').some((v) => v.startsWith('codex:')));
});
test('missing Jules evidence blocks completion', () => {
  assert.ok(completionBlockers(base, sha, 'chore/test').some((v) => v.startsWith('jules:')));
});
test('missing Actions evidence blocks completion', () => {
  assert.ok(completionBlockers(base, sha, 'chore/test').some((v) => v.startsWith('github_actions:')));
});
test('a changed HEAD invalidates the run', () => {
  assert.match(completionBlockers(base, 'b'.repeat(40), 'chore/test')[0], /stale/);
});
test('a changed branch invalidates the run', () => {
  assert.match(completionBlockers(base, sha, 'main')[0], /stale/);
});
test('all required passing receipts on same SHA permit completion', () => {
  const state = structuredClone(base);
  for (const provider of ['codex', 'jules', 'github_actions']) state.providers[provider] = { status: 'pass', validated_sha: sha, blockers: [] };
  assert.deepEqual(completionBlockers(state, sha, 'chore/test'), []);
});
test('a post-review commit makes all prior evidence stale', () => {
  const state = structuredClone(base);
  for (const provider of ['codex', 'jules', 'github_actions']) state.providers[provider] = { status: 'pass', validated_sha: sha, blockers: [] };
  assert.match(completionBlockers(state, 'b'.repeat(40), 'chore/test')[0], /stale/);
});
test('unsealed and dirty states block completion after edits', () => {
  assert.match(completionBlockers({ ...base, sealed: false }, sha, 'chore/test')[0], /must be sealed/);
  assert.match(completionBlockers(base, sha, 'chore/test', false)[0], /working tree changed/);
});
test('failed Actions blocks completion', () => {
  const state = structuredClone(base);
  for (const provider of ['codex', 'jules']) state.providers[provider] = { status: 'pass', validated_sha: sha, blockers: [] };
  state.providers.github_actions = { status: 'fail', validated_sha: sha, blockers: [] };
  assert.ok(completionBlockers(state, sha, 'chore/test').some((v) => v.startsWith('github_actions:')));
});
test('Gemini is required only when the classification requests CTO Intelligence', () => {
  assert.deepEqual(completionBlockers({ ...base, providers: {} }, sha, 'chore/test').length, 3);
  const state = { ...base, require_gemini: true, providers: { gemini: { status: 'pass', validated_sha: sha, blockers: [] } } };
  assert.ok(completionBlockers(state, sha, 'chore/test').some((value) => value.startsWith('codex:')));
  assert.ok(completionBlockers(state, sha, 'chore/test').some((value) => value.startsWith('jules:')));
  assert.ok(completionBlockers(state, sha, 'chore/test').some((value) => value.startsWith('github_actions:')));
  assert.ok(!completionBlockers(state, sha, 'chore/test').some((value) => value.startsWith('gemini:')));
});
test('Codex Cloud with no environment reports CONFIG_REQUIRED', () => {
  assert.deepEqual(codexCloudStatus(''), { status: 'CONFIG_REQUIRED', code: 'CODEX_CLOUD_ENV_REQUIRED' });
});
test('Jules adapter reports missing local API key without making network calls', async () => {
  let called = false;
  const result = await createJulesSession({ apiKey: '', fetchImpl: async () => { called = true; }, branchName: 'chore/test', summary: 'task', runId: 'run-1', headSha: sha, role: 'reviewer' });
  assert.deepEqual(result, { status: 'CONFIG_REQUIRED', code: 'JULES_API_KEY_REQUIRED' });
  assert.equal(called, false);
});
test('Jules adapter verifies exact branch and plan approval before creating a real session', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url.includes('/sources?')) return { ok: true, json: async () => ({ sources: [{ name: 'sources/github-trydavidqix-Lumenva', githubRepo: { owner: 'trydavidqix', repo: 'Lumenva', branches: [{ displayName: 'chore/test' }] } }] }) };
    return { ok: true, json: async () => ({ name: 'sessions/123', id: '123', url: 'https://jules.google/session/123', state: 'QUEUED' }) };
  };
  const session = await createJulesSession({ apiKey: 'test-only', fetchImpl, branchName: 'chore/test', summary: 'Review gate', runId: 'run-1', headSha: sha, role: 'reviewer' });
  assert.equal(session.id, '123');
  const request = JSON.parse(calls[1].options.body);
  assert.equal(request.sourceContext.githubRepoContext.startingBranch, 'chore/test');
  assert.equal(request.requirePlanApproval, true);
  assert.match(request.prompt, new RegExp(sha));
});
test('Git safety blocks destructive commands and direct-main mutations', () => {
  assert.ok(gitSafetyViolation('git reset --hard HEAD', 'chore/test'));
  assert.ok(gitSafetyViolation('git clean -fd', 'chore/test'));
  assert.ok(gitSafetyViolation('git push --force origin chore/test', 'chore/test'));
  assert.ok(gitSafetyViolation('git push origin main', 'chore/test'));
  assert.ok(gitSafetyViolation('git merge main', 'chore/test'));
  assert.ok(gitSafetyViolation('gh pr merge 73', 'chore/test'));
  assert.equal(gitSafetyViolation('git push origin chore/test', 'chore/test'), null);
});
test('Claude and Gemini mutation hooks block without a classified task state', async () => {
  const claude = await evaluateHook({ tool_name: 'Edit', tool_input: { file_path: 'docs/example.md' } });
  const gemini = await evaluateHook({ tool_name: 'write_file', tool_input: { file_path: 'docs/example.md' } });
  assert.equal(claude.allow, false);
  assert.equal(gemini.allow, false);
  assert.match(claude.reason, /ORCHESTRATION_STATE_REQUIRED/);
});
test('Antigravity hook uses native toolCall payload to block a destructive command', async () => {
  const result = await evaluateHook({ toolCall: { name: 'run_command', args: { CommandLine: 'git reset --hard HEAD' } } });
  assert.equal(result.allow, false);
  assert.match(result.reason, /GIT_SAFETY_BLOCKED/);
});
test('provider hook command outputs the documented deny protocol', () => {
  const payload = JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: 'src/example.ts' } });
  const claude = spawnSync(process.execPath, ['tooling/agent-governance/gate.mjs', 'hook', 'claude'], { cwd: new URL('../..', import.meta.url), input: payload, encoding: 'utf8' });
  assert.equal(claude.status, 0);
  assert.equal(JSON.parse(claude.stdout).hookSpecificOutput.permissionDecision, 'deny');
  const gemini = spawnSync(process.execPath, ['tooling/agent-governance/gate.mjs', 'hook', 'gemini'], { cwd: new URL('../..', import.meta.url), input: payload, encoding: 'utf8' });
  assert.equal(gemini.status, 2);
  assert.equal(JSON.parse(gemini.stdout).decision, 'deny');
});
test('read-only hook payloads do not require a full orchestration run', async () => {
  const result = await evaluateHook({ tool_name: 'read_file', tool_input: { file_path: 'AGENTS.md' } });
  assert.equal(result.allow, true);
  const gitStatus = await evaluateHook({ tool_name: 'Bash', tool_input: { command: 'git status --short --branch' } });
  assert.equal(gitStatus.allow, true);
  const shellChain = await evaluateHook({ tool_name: 'Bash', tool_input: { command: 'git status; Remove-Item important.txt' } });
  assert.equal(shellChain.allow, false);
});
test('docs-only classification cannot mutate operational policy files', async () => {
  // State is not fabricated for this test; all policy paths remain relevant mutations.
  const claude = await evaluateHook({ tool_name: 'Edit', tool_input: { file_path: 'AGENTS.md' } });
  assert.equal(claude.allow, false);
});
test('Codex Cloud dispatch without ENV_ID exits before invoking any cloud service', () => {
  const env = { ...process.env };
  delete env.CODEX_CLOUD_ENV_ID;
  const result = spawnSync(process.execPath, ['tooling/agent-governance/gate.mjs', 'dispatch-codex'], { cwd: new URL('../..', import.meta.url), env, encoding: 'utf8' });
  assert.equal(result.status, 2);
  assert.match(result.stdout, /CODEX_CLOUD_ENV_REQUIRED/);
  assert.doesNotMatch(result.stdout, /receipt|validated_sha/);
});
test('receipt rejects an unassigned provider or mismatched SHA', () => {
  const receipt = { task_id: 'run-1', provider_task_ref: 'codex-task-123', provider: 'codex', role: 'executor', branch: 'chore/test', head_sha: sha, result: 'pass', evidence: ['task output'], blockers: [] };
  assert.equal(validateReceipt(receipt, base, 'codex'), null);
  assert.match(validateReceipt({ ...receipt, head_sha: 'b'.repeat(40) }, base, 'codex'), /SHA mismatch/);
  assert.match(validateReceipt(receipt, base, 'gemini'), /not assigned/);
});
test('Gemini analysis receipt is accepted only when policy requires it', () => {
  const receipt = { task_id: 'run-1', provider_task_ref: 'gemini-session-123', provider: 'gemini', role: 'analysis', branch: 'chore/test', head_sha: sha, result: 'pass', evidence: ['analysis'], blockers: [] };
  assert.match(validateReceipt(receipt, base, 'gemini'), /not assigned/);
  assert.equal(validateReceipt(receipt, { ...base, require_gemini: true }, 'gemini'), null);
});
test('Actions receipt needs a run URL and verification role', () => {
  const state = { ...base, primary_executor: 'jules', reviewer: 'codex' };
  const receipt = { task_id: 'run-1', provider_task_ref: 'actions-run-1', provider: 'github_actions', role: 'verification', branch: 'chore/test', head_sha: sha, result: 'pass', evidence: [], blockers: [] };
  assert.match(validateReceipt(receipt, state, 'github_actions'), /run_url/);
  assert.equal(validateReceipt({ ...receipt, run_url: 'https://github.com/org/repo/actions/runs/1' }, state, 'github_actions'), null);
});
test('Actions evidence artifact is a valid same-HEAD completion receipt', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'lumenva-governance-'));
  const outputPath = join(tempDir, 'actions-evidence.json');
  try {
    const env = { ...process.env, GOVERNANCE_ARTIFACT_PATH: outputPath, PR_HEAD_SHA: sha, PR_BRANCH: 'chore/test', GITHUB_RUN_ID: '987', ACTIONS_RUN_URL: 'https://github.com/trydavidqix/Lumenva/actions/runs/987', VERIFY_RESULT: 'success', INVARIANTS_RESULT: 'success' };
    const result = spawnSync(process.execPath, ['tooling/agent-governance/write-actions-evidence.mjs'], { cwd: new URL('../..', import.meta.url), env, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const receipt = JSON.parse(await readFile(outputPath, 'utf8'));
    assert.equal(receipt.result, 'pass');
    assert.equal(validateReceipt(receipt, base, 'github_actions'), null);
  } finally {
    assert.equal(resolve(outputPath).startsWith(resolve(tempDir)), true);
    await rm(tempDir, { recursive: true, force: true });
  }
});
test('provider adapters point to canonical policy rather than copied hierarchies', async () => {
  const [claude, gemini, codex] = await Promise.all(['CLAUDE.md', 'GEMINI.md', '.codex/AGENTS.md'].map((p) => readFile(new URL(`../../${p}`, import.meta.url), 'utf8')));
  assert.match(claude, /AGENT_GOVERNANCE\.md/);
  assert.match(gemini, /AGENT_GOVERNANCE\.md/);
  assert.match(codex, /AGENT_GOVERNANCE\.md/);
});
test('shared orchestration skill is lazy and present', async () => {
  const skill = await readFile(new URL('../../.agents/skills/orchestration/SKILL.md', import.meta.url), 'utf8');
  assert.match(skill, /^description:.*Lazy-load/m);
});
test('provider hooks exist while core policy remains singular', async () => {
  const [claude, gemini, antigravity, canonical] = await Promise.all([
    readFile(new URL('../../.claude/settings.json', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('../../.gemini/settings.json', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('../../.agents/hooks.json', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('../../docs/engineering/AGENT_GOVERNANCE.md', import.meta.url), 'utf8'),
  ]);
  assert.ok(claude.hooks.PreToolUse && claude.hooks.Stop);
  assert.ok(gemini.hooks.BeforeTool);
  assert.ok(antigravity['orchestration-gate'].PreToolUse);
  assert.match(canonical, /Claude Code — CEO/);
});
