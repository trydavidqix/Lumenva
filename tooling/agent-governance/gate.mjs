#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const branch = () => git('branch', '--show-current');
const head = () => git('rev-parse', 'HEAD');
const treeIsClean = () => git('status', '--porcelain').length === 0;
const stateFile = () => join(resolve(root, git('rev-parse', '--git-common-dir')), 'agent-governance', `${createHash('sha256').update(`${root}\0${branch()}`).digest('hex').slice(0, 20)}.json`);

export function route(kind, summary = '') {
  const small = kind === 'small' || /\b(isolated|mechanical|small|regression pequena|bug isolado)\b/i.test(summary);
  return small
    ? { primary_executor: 'jules', reviewer: 'codex' }
    : { primary_executor: 'codex', reviewer: 'jules' };
}

export function codexCloudStatus(envId = process.env.CODEX_CLOUD_ENV_ID) {
  return envId?.trim() ? { status: 'READY' } : { status: 'CONFIG_REQUIRED', code: 'CODEX_CLOUD_ENV_REQUIRED' };
}

export async function createJulesSession({ apiKey, fetchImpl = fetch, branchName, summary, runId, headSha, role }) {
  if (!apiKey?.trim()) return { status: 'CONFIG_REQUIRED', code: 'JULES_API_KEY_REQUIRED' };
  const headers = { 'x-goog-api-key': apiKey.trim() };
  const sourcesResponse = await fetchImpl('https://jules.googleapis.com/v1alpha/sources?pageSize=100', { headers });
  if (!sourcesResponse.ok) throw new Error(`Jules sources API failed with HTTP ${sourcesResponse.status}`);
  const sources = await sourcesResponse.json();
  const source = sources.sources?.find((item) => item.githubRepo?.owner === 'trydavidqix' && item.githubRepo?.repo === 'Lumenva');
  if (!source) throw new Error('Jules source trydavidqix/Lumenva is not connected');
  const remoteBranch = source.githubRepo?.branches?.find((item) => item.displayName === branchName);
  if (!remoteBranch) throw new Error(`Jules source does not expose branch ${branchName}`);
  const prompt = [
    `Task ID: ${runId}`, `Role: ${role}`, `Repository: trydavidqix/Lumenva`,
    `Branch: ${branchName}`, `Required HEAD SHA: ${headSha}`, `Task: ${summary}`,
    role === 'reviewer' ? 'Review independently without editing. Report findings, tests, blockers, and the exact HEAD SHA inspected.' : 'Implement only the assigned task. Do not alter governance policy. Report files, tests, blockers, and exact resulting HEAD SHA.'
  ].join('\n');
  const response = await fetchImpl('https://jules.googleapis.com/v1alpha/sessions', {
    method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ title: `Lumenva ${role}: ${summary.slice(0, 80)}`, prompt, sourceContext: { source: source.name, githubRepoContext: { startingBranch: branchName } }, requirePlanApproval: true })
  });
  if (!response.ok) throw new Error(`Jules session API failed with HTTP ${response.status}`);
  return response.json();
}

export function validateReceipt(receipt, state, provider) {
  const expectedRole = provider === 'github_actions' ? 'verification'
    : provider === state.primary_executor ? 'executor'
      : provider === state.reviewer ? 'reviewer'
        : provider === 'gemini' && state.require_gemini ? 'analysis' : null;
  if (!expectedRole) return 'provider is not assigned to this run';
  if (provider !== 'github_actions' && receipt.task_id !== state.run_id) return 'task_id does not match this run';
  if (receipt.provider !== provider || receipt.role !== expectedRole) return 'provider role mismatch';
  if (receipt.branch !== state.branch || receipt.head_sha !== state.head_sha) return 'branch or HEAD SHA mismatch';
  if (!/^[0-9a-f]{40}$/.test(receipt.head_sha ?? '')) return 'invalid head_sha';
  if (!['pass', 'fail', 'pending', 'blocked'].includes(receipt.result)) return 'invalid result';
  if (!Array.isArray(receipt.evidence) || !Array.isArray(receipt.blockers)) return 'evidence and blockers must be arrays';
  if (!receipt.provider_task_ref) return 'provider_task_ref is required for traceable evidence';
  if (provider === 'github_actions' && (!receipt.run_url || !/^https:\/\/(github\.com|[^/]+\.ghe\.com)\//.test(receipt.run_url))) return 'GitHub Actions run_url is required';
  return null;
}

export function completionBlockers(state, currentHead, currentBranch, clean = true) {
  if (state.kind === 'docs-only') return [];
  if (!state.sealed) return ['run must be sealed at a clean PR HEAD before collecting completion evidence'];
  if (!clean) return ['working tree changed after the evidence snapshot; reopen and rerun affected gates'];
  if (state.head_sha !== currentHead || state.branch !== currentBranch) return [`run state stale: HEAD/branch changed`];
  const missing = [];
  for (const provider of [state.primary_executor, state.reviewer, ...(state.require_gemini ? ['gemini'] : []), 'github_actions']) {
    const receipt = state.providers?.[provider];
    if (!receipt || receipt.status !== 'pass' || receipt.validated_sha !== currentHead) missing.push(`${provider}: passing receipt for ${currentHead} required`);
    if (receipt?.blockers?.length) missing.push(`${provider}: unresolved blockers`);
  }
  return missing;
}

export function gitSafetyViolation(command, currentBranch) {
  const normalized = String(command ?? '').replace(/\\/g, '/').trim();
  if (/\bgit\s+(?:\S+\s+)*reset\s+--hard\b/i.test(normalized)) return 'GIT_SAFETY_BLOCKED: git reset --hard';
  if (/\bgit\s+(?:\S+\s+)*clean\s+(?=[^\n]*(?:-[a-z]*f|--force))/i.test(normalized)) return 'GIT_SAFETY_BLOCKED: destructive git clean';
  if (/\bgit\s+push\b[^\n]*(?:--force(?:-with-lease)?|\s-f(?:\s|$))/i.test(normalized)) return 'GIT_SAFETY_BLOCKED: force push';
  if (/\bgit\s+push\b[^\n]*(?:\bmain\b|\bmaster\b)/i.test(normalized) || (currentBranch === 'main' && /\bgit\s+push\b/i.test(normalized))) return 'GIT_SAFETY_BLOCKED: direct push to main';
  if (/\bgit\s+merge\b[^\n]*\b(?:main|master)\b/i.test(normalized)) return 'GIT_SAFETY_BLOCKED: direct main merge';
  if (/\bgh\s+pr\s+merge\b/i.test(normalized)) return 'GIT_SAFETY_BLOCKED: PR merge requires explicit owner lifecycle outside this gate';
  return null;
}

async function loadState() {
  try { return JSON.parse(await readFile(stateFile(), 'utf8')); } catch { return null; }
}
async function saveState(state) {
  const path = stateFile();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(state, null, 2)}\n`, { flag: 'w' });
}

function hookMutation(input) {
  const tool = String(input.tool_name ?? input.toolName ?? input.toolCall?.name ?? '');
  if (/edit|write|replace|notebookedit/i.test(tool)) return true;
  const command = getCommand(input);
  if (!command) return false;
  if (/[;&|<>`$\r\n]/.test(command)) return true;
  const safe = /^(?:git\s+(?:status|diff|log|show|branch|rev-parse|remote|worktree\s+list|check-ignore)\b|rg\s|Get-Content\b|Get-ChildItem\b|Test-Path\b|node\s+tooling\/agent-governance\/gate\.mjs\s+(?:begin|seal|reopen|status|session|record|complete|dispatch-codex|dispatch-jules|dispatch-gemini)\b|codex\s+execpolicy\s+check\b|actionlint\b|pnpm\s+(?:harness:check|test:harness|test:governance)\b)/i;
  return !safe.test(command.trim());
}

function getCommand(input) {
  return String(input.tool_input?.command ?? input.tool_input?.cmd ?? input.toolInput?.command ?? input.toolCall?.args?.CommandLine ?? '');
}

export async function evaluateHook(input) {
  if (['Stop', 'AfterAgent'].includes(input.hook_event_name ?? input.hookEventName ?? input.event_name)) {
    const state = await loadState();
    if (!state || state.kind === 'docs-only') return { allow: true, reason: 'no relevant code task is active' };
    const current = head();
    const blockers = completionBlockers(state, current, branch(), treeIsClean());
    if (blockers.length) return { allow: false, reason: `COMPLETION_BLOCKED: ${blockers.join('; ')}` };
    return { allow: true, reason: 'all required receipts pass for current HEAD' };
  }
  if (!hookMutation(input)) return { allow: true, reason: 'read-only or non-mutating tool' };
  const command = getCommand(input);
  const safetyViolation = gitSafetyViolation(command, branch());
  if (safetyViolation) return { allow: false, reason: safetyViolation };
  const state = await loadState();
  const tool = String(input.tool_name ?? input.toolName ?? input.toolCall?.name ?? '');
  const target = String(input.tool_input?.file_path ?? input.tool_input?.path ?? input.toolInput?.file_path ?? input.toolCall?.args?.TargetFile ?? '');
  const docsPath = target.replace(/\\/g, '/').replace(/^\.\//, '');
  const lightweightDocs = /^docs\/(?!engineering\/|security\/|runbooks\/|specs\/|business-rules\/|doctrine\/|superpowers\/)[^\0]+\.md$/i.test(docsPath);
  if (state?.kind === 'docs-only' && /edit|write|replace/i.test(tool) && lightweightDocs) return { allow: true, reason: 'classified non-operational documentation-only change' };
  if (!state || state.kind === 'docs-only') return { allow: false, reason: 'ORCHESTRATION_STATE_REQUIRED: run gate.mjs begin before a relevant mutation' };
  if (state.branch !== branch() || state.head_sha !== head()) return { allow: false, reason: 'STALE_ORCHESTRATION_STATE: branch/HEAD changed; reinitialize and reacquire evidence' };
  if (state.sealed) return { allow: false, reason: 'SEALED_RUN: run gate.mjs reopen to invalidate receipts before changing files' };
  return { allow: true, reason: 'active orchestration run' };
}

async function main(args) {
  const [command, ...rest] = args;
  if (command === 'begin') {
    if (!treeIsClean()) throw new Error('WORKTREE_DIRTY: preserve or commit existing changes before starting a governed task');
    const opts = Object.fromEntries(rest.map((v, i) => v.startsWith('--') ? [v.slice(2), rest[i + 1]] : null).filter(Boolean));
    const kind = opts.kind ?? 'code';
    const runId = randomUUID();
    const routing = route(kind, opts.summary ?? '');
    const sha = head();
    const state = {
      run_id: runId, project_id: 'Lumenva', branch: branch(), head_sha: sha,
      kind, summary: opts.summary ?? '', ceo: 'claude', require_gemini: rest.includes('--require-gemini'), sealed: false, ...routing,
      codex_cloud: codexCloudStatus(),
      providers: Object.fromEntries(['codex', 'jules', 'gemini', 'antigravity', 'github_actions'].map((p) => [p, { status: 'pending', role: p === routing.primary_executor ? 'executor' : p === routing.reviewer ? 'reviewer' : p === 'github_actions' ? 'verification' : 'analysis', validated_sha: null }]))
    };
    await saveState(state);
    console.log(JSON.stringify({ run_id: runId, branch: state.branch, head_sha: sha, ...routing, codex_cloud: state.codex_cloud }, null, 2));
    return;
  }
  if (command === 'seal') {
    const state = await loadState();
    if (!state) throw new Error('ORCHESTRATION_STATE_REQUIRED');
    if (branch() === 'main' || branch() === 'master') throw new Error('GIT_SAFETY_BLOCKED: governed runs cannot be sealed on main');
    if (!treeIsClean()) throw new Error('WORKTREE_DIRTY: commit or preserve task changes before sealing the review HEAD');
    state.head_sha = head();
    state.branch = branch();
    state.sealed = true;
    state.codex_cloud = codexCloudStatus();
    state.providers = Object.fromEntries(Object.entries(state.providers).map(([provider, item]) => [provider, { ...item, status: 'pending', validated_sha: null, evidence: [], blockers: [], run_url: null }]));
    await saveState(state);
    console.log(`SEALED ${state.branch} ${state.head_sha}`);
    return;
  }
  if (command === 'reopen') {
    const state = await loadState();
    if (!state) throw new Error('ORCHESTRATION_STATE_REQUIRED');
    state.head_sha = head();
    state.branch = branch();
    state.sealed = false;
    state.codex_cloud = codexCloudStatus();
    state.providers = Object.fromEntries(Object.entries(state.providers).map(([provider, item]) => [provider, { ...item, status: 'pending', validated_sha: null, evidence: [], blockers: [], run_url: null }]));
    await saveState(state);
    console.log(`REOPENED — all receipts invalidated for ${state.branch} ${state.head_sha}`);
    return;
  }
  if (command === 'status') {
    const state = await loadState();
    if (!state) throw new Error('ORCHESTRATION_STATE_REQUIRED');
    console.log(JSON.stringify({ ...state, current_head_sha: head(), stale: state.head_sha !== head() || state.branch !== branch() }, null, 2));
    return;
  }
  if (command === 'session') {
    const state = await loadState();
    const provider = rest[0] ?? 'gemini';
    const summary = state
      ? `Lumenva orchestration run ${state.run_id} on ${state.branch} at ${state.head_sha.slice(0, 12)}.`
      : `Lumenva governance active on ${branch()} at ${head().slice(0, 12)}. Start a relevant change with tooling/agent-governance/gate.mjs begin.`;
    console.log(JSON.stringify(provider === 'claude'
      ? { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: summary } }
      : provider === 'antigravity'
        ? { injectSteps: [{ ephemeralMessage: summary }] }
        : { systemMessage: summary }));
    return;
  }
  if (command === 'dispatch-codex') {
    const status = codexCloudStatus();
    if (status.status !== 'READY') { console.log(JSON.stringify(status)); process.exitCode = 2; return; }
    const state = await loadState();
    if (!state || !state.sealed || !treeIsClean() || state.branch !== branch() || state.head_sha !== head()) throw new Error('SEALED_CLEAN_RUN_REQUIRED');
    const role = state.primary_executor === 'codex' ? 'executor' : state.reviewer === 'codex' ? 'reviewer' : null;
    if (!role) throw new Error('Codex has no assigned role for this run');
    const prompt = [
      `Task ID: ${state.run_id}`, `Role: ${role}`, `Repository: trydavidqix/Lumenva`,
      `Branch: ${state.branch}`, `Required HEAD SHA: ${state.head_sha}`,
      `Task: ${state.summary}`, role === 'reviewer' ? 'Review independently; do not edit files. Report findings, checks, and blockers.' : 'Execute only this assigned task. Do not change governance policy. Report files, checks, and blockers.',
      'Report the exact commit SHA actually inspected. Do not claim validation for another SHA.'
    ].join('\n');
    const output = execFileSync('codex', ['cloud', 'exec', '--env', process.env.CODEX_CLOUD_ENV_ID.trim(), '--branch', state.branch, prompt], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const taskRef = output.match(/https?:\/\/[^\s]+|(?:task|task_id)\s*[:=]\s*[\w-]+/i)?.[0] ?? null;
    state.codex_cloud = { status: 'RUNNING', task_ref: taskRef };
    state.providers.codex = { ...state.providers.codex, status: 'running', provider_task_ref: taskRef };
    await saveState(state);
    console.log(taskRef ? `Codex Cloud dispatch submitted: ${taskRef}` : 'Codex Cloud dispatch submitted; task reference not parsed. Retrieve it with the official Codex Cloud task list.');
    return;
  }
  if (command === 'dispatch-jules') {
    const state = await loadState();
    if (!state || !state.sealed || !treeIsClean() || state.branch !== branch() || state.head_sha !== head()) throw new Error('SEALED_CLEAN_RUN_REQUIRED');
    const role = state.primary_executor === 'jules' ? 'executor' : state.reviewer === 'jules' ? 'reviewer' : null;
    if (!role) throw new Error('Jules has no assigned role for this run');
    const session = await createJulesSession({ apiKey: process.env.JULES_API_KEY, branchName: state.branch, summary: state.summary, runId: state.run_id, headSha: state.head_sha, role });
    if (session.status === 'CONFIG_REQUIRED') { console.log(JSON.stringify(session)); process.exitCode = 2; return; }
    state.providers.jules = { ...state.providers.jules, status: 'running', session_name: session.name, session_id: session.id ?? null, session_url: session.url ?? null };
    await saveState(state);
    console.log(JSON.stringify({ status: session.state ?? 'QUEUED', session: session.name, url: session.url }, null, 2));
    return;
  }
  if (command === 'dispatch-gemini') {
    const state = await loadState();
    if (!state || !state.sealed || !treeIsClean() || state.branch !== branch() || state.head_sha !== head()) throw new Error('SEALED_CLEAN_RUN_REQUIRED');
    if (!state.require_gemini) throw new Error('Gemini is not required for this run; use begin --require-gemini only when policy/risk requires CTO Intelligence');
    const prompt = [
      `Task ID: ${state.run_id}`, 'Role: independent CTO Intelligence analysis',
      'Repository: trydavidqix/Lumenva', `Branch: ${state.branch}`, `Required HEAD SHA: ${state.head_sha}`,
      `Task: ${state.summary}`, 'Read-only analysis. Do not edit files or alter governance.',
      'Return findings, evidence, blockers, and the exact HEAD SHA actually inspected. Do not claim CI passed.'
    ].join('\n');
    const output = execFileSync('gemini', ['--prompt', prompt, '--approval-mode', 'plan', '--output-format', 'json'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    state.providers.gemini = { ...state.providers.gemini, status: 'completed_unverified', validated_sha: null };
    await saveState(state);
    console.log(output.trim());
    return;
  }
  if (command === 'record') {
    const [provider, receiptPath] = rest;
    const state = await loadState();
    if (!state?.sealed || !treeIsClean() || state.branch !== branch() || state.head_sha !== head()) throw new Error('SEALED_CLEAN_RUN_REQUIRED');
    const receiptBase = await realpath(dirname(stateFile()));
    const receiptFile = await realpath(resolve(root, receiptPath));
    const relativeReceipt = relative(receiptBase, receiptFile);
    if (!relativeReceipt || relativeReceipt.startsWith('..') || isAbsolute(relativeReceipt)) throw new Error('RECEIPT_PATH_BLOCKED: read receipts only from .git/agent-governance/');
    const receipt = JSON.parse(await readFile(receiptFile, 'utf8'));
    const error = validateReceipt(receipt, state, provider);
    if (error) throw new Error(`INVALID_RECEIPT: ${error}`);
    if (provider === 'codex' && state.codex_cloud?.status === 'CONFIG_REQUIRED') throw new Error('CODEX_CLOUD_ENV_REQUIRED: no Codex Cloud receipt can be recorded');
    state.providers[provider] = { status: receipt.result, role: receipt.role, validated_sha: receipt.head_sha, evidence: receipt.evidence, blockers: receipt.blockers, run_url: receipt.run_url ?? null };
    await saveState(state);
    console.log(`Recorded observed ${provider} result ${receipt.result} for ${receipt.head_sha}`);
    return;
  }
  if (command === 'complete') {
    const state = await loadState();
    if (!state) throw new Error('ORCHESTRATION_STATE_REQUIRED');
    const current = head();
    const missing = completionBlockers(state, current, branch(), treeIsClean());
    if (missing.length) { console.error(`COMPLETION_BLOCKED\n- ${missing.join('\n- ')}`); process.exitCode = 1; return; }
    console.log(state.kind === 'docs-only' ? 'DOCS_ONLY_LIGHTWEIGHT_PASS (classification supplied at task start)' : `ORCHESTRATION_PASS ${current}`);
    return;
  }
  if (command === 'hook') {
    const [provider] = rest;
    const input = JSON.parse(await new Promise((resolveInput) => {
      let data = ''; process.stdin.setEncoding('utf8'); process.stdin.on('data', (chunk) => data += chunk); process.stdin.on('end', () => resolveInput(data || '{}'));
    }));
    if (rest.includes('--stop')) input.hook_event_name = 'Stop';
    const decision = await evaluateHook(input);
    if (provider === 'claude') {
      const stop = ['Stop', 'AfterAgent'].includes(input.hook_event_name ?? input.hookEventName ?? input.event_name);
      console.log(JSON.stringify(decision.allow ? {} : stop
        ? { decision: 'block', reason: decision.reason }
        : { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: decision.reason } }));
    } else {
      console.log(JSON.stringify({ decision: decision.allow ? 'allow' : 'deny', reason: decision.reason }));
      if (!decision.allow) process.exitCode = 2;
    }
    return;
  }
  throw new Error('Usage: gate.mjs begin --kind code|small|docs-only --summary "..." [--require-gemini] | seal | reopen | status | dispatch-codex | dispatch-jules | dispatch-gemini | record <provider> <receipt.json> | complete | hook <claude|gemini|antigravity>');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
