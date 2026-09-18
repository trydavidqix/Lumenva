#!/usr/bin/env node
import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';

export const MAX_ATTEMPTS = 3;
const READY = new Set(['BACKLOG', 'READY']);

export function selectNextTask(queue) {
  return queue.tasks.find(task => READY.has(task.status));
}

export function parseReviewerVerdict(output) {
  const lines = String(output ?? '').trim().split(/\r?\n/);
  if (lines[0] === 'PASS') return lines.length === 1 ? 'PASS' : null;
  const findings = lines.slice(1).join(' ');
  if (lines[0] === 'FAIL' && lines.length >= 2 && /^\s*\d+\./.test(lines[1]) && /evidence/i.test(findings) && /recommended action/i.test(findings)) return 'FAIL';
  return null;
}

function command(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd: options.cwd, env: { ...process.env, ...options.env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => resolvePromise({ code: code ?? 1, stdout, stderr }));
  });
}

async function atomicJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temp, path);
}

async function record(path, event, detail = '') {
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${new Date().toISOString()} ${event}${detail ? ` ${detail}` : ''}\n`);
}

function renderTasks(queue) {
  const lines = ['# TASKS', '', `Updated: ${new Date().toISOString()}`, ''];
  for (const task of queue.tasks) {
    lines.push(`## ${task.id} — ${task.title || task.objective || 'Untitled'}`);
    lines.push(`- Status: ${task.status}`);
    lines.push(`- Branch: ${task.branch || 'UNSET'}`);
    lines.push(`- Objective: ${task.objective || 'UNSET'}`);
    lines.push(`- Files: ${(task.files || []).join(', ') || 'UNSET'}`);
    lines.push(`- Acceptance: ${(task.acceptance || []).join('; ') || 'UNSET'}`);
    lines.push(`- Verification: ${(task.verification || ['scripts/verify.sh']).join('; ')}`);
    lines.push(`- Attempts: ${task.attempts || 0}/${MAX_ATTEMPTS}`);
    lines.push(`- Reviewer: ${task.reviewer_verdict || 'PENDING'}`, '');
  }
  return `${lines.join('\n')}\n`;
}

function builderPrompt(task, feedback = '') {
  return [`ROLE: BUILDER. Task ${task.id}.`, `Branch: ${task.branch}.`, `Worktree: ${task.worktree}.`, `Objective: ${task.objective || ''}.`,
    `Files in scope: ${(task.files || []).join(', ')}.`, `Acceptance criteria: ${(task.acceptance || []).join('; ')}.`,
    `Run verification: ${(task.verification || ['scripts/verify.sh']).join(' && ')}.`,
    'Inspect real state first. Make smallest scoped change. If task premise is wrong, stop and report to Maestro before editing. Do not merge, push, deploy, edit task acceptance, or declare final PASS.',
    'Return exactly: FILES_CHANGED, COMMANDS_RUN, TEST_RESULTS, KNOWN_ISSUES, STATUS=READY_FOR_REVIEW or FAILED.',
    feedback ? `Previous verification feedback:\n${feedback}` : 'First attempt: implement task.',
  ].join('\n');
}

function reviewerPrompt(task, verification) {
  return [`ROLE: REVIEWER. Task ${task.id}.`, `Worktree: ${task.worktree}.`, `Read task, diff, changed files, and verification evidence.`,
    `Acceptance: ${(task.acceptance || []).join('; ')}.`, `Verifier output:\n${verification}`,
    'Read-only. Do not edit, fix, merge, push, or expand scope. Reply with exactly PASS or FAIL. On FAIL, include numbered evidence after the first line.',
  ].join('\n');
}

async function update(queue, queuePath, tasksPath) {
  await atomicJson(queuePath, queue);
  await mkdir(dirname(tasksPath), { recursive: true });
  await writeFile(tasksPath, renderTasks(queue));
}

export async function runLoop({ queuePath, tasksPath, runlogPath, verifyPath = 'scripts/verify.sh', builderName = 'Codex Builder', reviewerName = 'Codex Reviewer', recruit = true, runCommand = command } = {}) {
  if (!queuePath) throw new Error('queuePath required');
  const actualTasksPath = tasksPath || resolve(dirname(queuePath), 'TASKS.md');
  const actualRunlogPath = runlogPath || resolve(dirname(queuePath), 'RUNLOG.md');
  const queue = JSON.parse(await readFile(queuePath, 'utf8'));
  const task = selectNextTask(queue);
  if (!task) return { status: 'IDLE' };
  if (!task.worktree) throw new Error(`${task.id}: worktree required`);
  if (!task.branch) throw new Error(`${task.id}: branch required`);
  task.status = 'RUNNING';
  await update(queue, queuePath, actualTasksPath);
  await record(actualRunlogPath, 'AUDIT_STARTED', task.id);
  const audit = await runCommand('git', ['status', '--short', '--branch'], { cwd: task.worktree, role: 'audit' });
  if (audit.code !== 0) { task.status = 'BLOCKED'; task.blocker = audit.stderr || audit.stdout; await update(queue, queuePath, actualTasksPath); await record(actualRunlogPath, 'AUDIT_FAILED', task.id); return { status: 'BLOCKED', attempts: task.attempts || 0 }; }
  if (task.branch) {
    const branch = await runCommand('git', ['rev-parse', '--verify', task.branch], { cwd: task.worktree, role: 'audit' });
    if (branch.code !== 0) { task.status = 'BLOCKED'; task.blocker = branch.stderr || `Branch not found: ${task.branch}`; await update(queue, queuePath, actualTasksPath); await record(actualRunlogPath, 'AUDIT_FAILED', `${task.id} branch`); return { status: 'BLOCKED', attempts: task.attempts || 0 }; }
    const current = await runCommand('git', ['branch', '--show-current'], { cwd: task.worktree, role: 'audit' });
    if (current.code !== 0 || current.stdout.trim() !== task.branch) { task.status = 'BLOCKED'; task.blocker = `Worktree branch mismatch: expected ${task.branch}, got ${current.stdout.trim() || 'DETACHED'}`; await update(queue, queuePath, actualTasksPath); await record(actualRunlogPath, 'AUDIT_FAILED', `${task.id} worktree branch`); return { status: 'BLOCKED', attempts: task.attempts || 0 }; }
    const worktrees = await runCommand('git', ['worktree', 'list', '--porcelain'], { cwd: task.worktree, role: 'audit' });
    const branchRef = `branch refs/heads/${task.branch}`;
    const matches = worktrees.stdout.split(/\n\n+/).filter(block => block.split(/\r?\n/).some(line => line === branchRef));
    if (worktrees.code !== 0 || matches.length !== 1) { task.status = 'BLOCKED'; task.blocker = matches.length > 1 ? `Branch already active in ${matches.length} worktrees` : 'Cannot prove unique worktree ownership'; await update(queue, queuePath, actualTasksPath); await record(actualRunlogPath, 'AUDIT_FAILED', `${task.id} worktree ownership`); return { status: 'BLOCKED', attempts: task.attempts || 0 }; }
    const recordedWorktree = matches[0].split(/\r?\n/).find(line => line.startsWith('worktree '))?.slice('worktree '.length);
    if (!recordedWorktree || resolve(recordedWorktree) !== resolve(task.worktree)) { task.status = 'BLOCKED'; task.blocker = `Worktree path mismatch: expected ${resolve(task.worktree)}, got ${recordedWorktree || 'UNSET'}`; await update(queue, queuePath, actualTasksPath); await record(actualRunlogPath, 'AUDIT_FAILED', `${task.id} worktree path`); return { status: 'BLOCKED', attempts: task.attempts || 0 }; }
  }
  await record(actualRunlogPath, 'AUDIT_COMPLETED', `${task.id} branch=${task.branch || 'UNSET'}`);
  if (recruit) {
    const recruited = await runCommand('maestri', ['recruit', builderName, '--preset', process.env.MAESTRI_CODEX_PRESET || 'Codex', '--role', process.env.MAESTRI_BUILDER_ROLE || 'Builder', '--dir', task.worktree], { cwd: task.worktree, role: 'builder-recruit' });
    if (recruited.code !== 0) { task.status = 'BLOCKED'; task.blocker = recruited.stderr || recruited.stdout || 'Builder recruitment failed.'; await update(queue, queuePath, actualTasksPath); await record(actualRunlogPath, 'BLOCKED', `${task.id} builder recruitment`); return { status: 'BLOCKED', task_id: task.id, attempts: task.attempts || 0 }; }
    const reviewer = await runCommand('maestri', ['recruit', reviewerName, '--preset', process.env.MAESTRI_CODEX_PRESET || 'Codex', '--role', process.env.MAESTRI_REVIEWER_ROLE || 'Reviewer', '--dir', task.worktree], { cwd: task.worktree, role: 'reviewer-recruit' });
    if (reviewer.code !== 0) { await runCommand('maestri', ['dismiss', builderName], { cwd: task.worktree, role: 'builder-dismiss' }); task.status = 'BLOCKED'; task.blocker = reviewer.stderr || reviewer.stdout || 'Reviewer recruitment failed.'; await update(queue, queuePath, actualTasksPath); await record(actualRunlogPath, 'BLOCKED', `${task.id} reviewer recruitment`); return { status: 'BLOCKED', task_id: task.id, attempts: task.attempts || 0 }; }
  }
  let feedback = '';
  for (let attempt = Math.max(0, task.attempts || 0) + 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    task.attempts = attempt; task.status = 'RUNNING';
    await update(queue, queuePath, actualTasksPath);
    await record(actualRunlogPath, 'BUILDER_STARTED', `${task.id} attempt=${attempt}`);
    const build = await runCommand('maestri', ['ask', builderName, builderPrompt(task, feedback)], { cwd: task.worktree, role: 'builder', attempt });
    if (build.code !== 0) { feedback = build.stderr || build.stdout || 'Builder command failed.'; await record(actualRunlogPath, 'BUILDER_FAILED', `${task.id} attempt=${attempt}`); continue; }
    task.status = 'VERIFYING'; await update(queue, queuePath, actualTasksPath);
    const verify = await runCommand(resolve(task.worktree, verifyPath), [], { cwd: task.worktree, role: 'verifier', attempt });
    const evidence = `${verify.stdout}\n${verify.stderr}`.trim();
    if (verify.code !== 0) { feedback = evidence || `verify exit ${verify.code}`; await record(actualRunlogPath, 'VERIFICATION_FAILED', `${task.id} attempt=${attempt} ${feedback.split('\n')[0]}`); continue; }
    await record(actualRunlogPath, 'VERIFICATION_PASS', `${task.id} attempt=${attempt}`);
    task.status = 'REVIEW'; await update(queue, queuePath, actualTasksPath);
    await record(actualRunlogPath, 'REVIEW_STARTED', task.id);
    const review = await runCommand('maestri', ['ask', reviewerName, reviewerPrompt(task, evidence)], { cwd: task.worktree, role: 'reviewer', attempt });
    const verdict = review.code === 0 ? parseReviewerVerdict(review.stdout) : null;
    if (verdict === 'PASS') { task.status = 'READY_FOR_HUMAN'; task.reviewer_verdict = 'PASS'; await record(actualRunlogPath, 'REVIEW_PASS', task.id); if (recruit) { await runCommand('maestri', ['dismiss', reviewerName], { cwd: task.worktree, role: 'reviewer-dismiss' }); await runCommand('maestri', ['dismiss', builderName], { cwd: task.worktree, role: 'builder-dismiss' }); } await update(queue, queuePath, actualTasksPath); return { status: task.status, task_id: task.id, attempts: attempt }; }
    feedback = review.stderr || review.stdout || 'Reviewer returned invalid verdict.';
    task.reviewer_verdict = verdict || 'FAIL';
    await record(actualRunlogPath, 'REVIEW_FAIL', `${task.id} attempt=${attempt}`);
  }
  if (recruit) { await runCommand('maestri', ['dismiss', reviewerName], { cwd: task.worktree, role: 'reviewer-dismiss' }); await runCommand('maestri', ['dismiss', builderName], { cwd: task.worktree, role: 'builder-dismiss' }); }
  task.status = 'BLOCKED'; task.blocker = feedback || 'Maximum attempts reached.';
  await record(actualRunlogPath, 'BLOCKED', `${task.id} attempts=${MAX_ATTEMPTS}`); await update(queue, queuePath, actualTasksPath);
  return { status: 'BLOCKED', task_id: task.id, attempts: MAX_ATTEMPTS };
}

function args(argv) { const out = {}; for (let i = 2; i < argv.length; i += 1) { if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1]?.startsWith('--') ? true : argv[++i]; } return out; }

if (import.meta.url === `file://${process.argv[1]}`) {
  const options = args(process.argv);
  const result = await runLoop({ queuePath: resolve(options.queue || 'loop/queue.json'), tasksPath: resolve(options.tasks || 'TASKS.md'), runlogPath: resolve(options.runlog || 'RUNLOG.md'), verifyPath: options.verify || 'scripts/verify.sh', builderName: options.builder || 'Codex Builder', reviewerName: options.reviewer || 'Codex Reviewer', recruit: options['no-recruit'] !== true });
  console.log(JSON.stringify(result));
  process.exitCode = result.status === 'BLOCKED' ? 2 : 0;
}
