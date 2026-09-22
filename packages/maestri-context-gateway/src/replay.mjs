import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseCodexJsonl } from './codex-usage.mjs';
import { recordTelemetry } from './telemetry.mjs';
import { runProcess } from './executor.mjs';

export async function replayTask({ root, task_id, variant, binary, workspace = root, job_class = 'NORMAL', timeout_ms, signal } = {}) {
  if (!['baseline', 'mcg'].includes(variant)) throw new Error('variant must be baseline or mcg');
  const state = JSON.parse(await readFile(join(root, 'tasks', task_id, 'state.json'), 'utf8'));
  let context = '';
  try {
    const artifact = JSON.parse(await readFile(join(root, 'tasks', task_id, 'evidence', 'context.json'), 'utf8'));
    context = artifact.fragments.map(item => item.content).join('\n');
  } catch {
    context = state.objective || '';
  }
  const prompt = `Replay variant: ${variant.toUpperCase()}\nSource task: ${task_id}\nEvidence context:\n${context}\n\nObjective:\n${state.objective || 'Repeat the source task and report evidence.'}\nDo not edit files. Return a concise result.`;
  const replay_id = `replay-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const dir = join(root, 'state', 'evals', 'replays', replay_id);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await writeFile(join(dir, 'snapshot.json'), `${JSON.stringify({ replay_id, source_task_id: task_id, variant, workspace_snapshot: 'read-only process snapshot', original_untouched: true, timestamp: new Date().toISOString() }, null, 2)}\n`, { mode: 0o600 });

  const result = await runProcess({
    command: binary,
    args: ['exec', '--ignore-user-config', '--ephemeral', '--skip-git-repo-check', '--sandbox', 'read-only', '--json', '-C', workspace, prompt],
    cwd: workspace,
    job_class,
    timeout_ms,
    signal
  });
  const usage = parseCodexJsonl(result.stdout);
  const record = {
    replay_id,
    source_task_id: task_id,
    variant,
    result: result.stdout,
    stderr: result.stderr,
    success: result.classification === 'SUCCESS',
    exit_code: result.code,
    exit_classification: result.classification,
    tokens: usage?.total_tokens ?? null,
    input_tokens: usage?.input_tokens ?? null,
    cached_input_tokens: usage?.cached_input_tokens ?? null,
    output_tokens: usage?.output_tokens ?? null,
    reasoning_tokens: usage?.reasoning_tokens ?? null,
    measurement_type: usage?.measurement_type || 'unavailable',
    source: usage?.source || 'codex.exec.jsonl',
    latency_ms: result.duration_ms,
    last_activity_at: result.last_activity_at,
    heartbeat_count: result.heartbeat_count,
    timed_out: result.timed_out,
    cancelled: result.cancelled,
    job_class: result.policy.job_class,
    original_untouched: true,
    snapshot: `${replay_id}/snapshot.json`,
    timestamp: new Date().toISOString()
  };
  await writeFile(join(dir, 'result.json'), `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
  await recordTelemetry(root, {
    task_id,
    executor: 'codex',
    runtime: 'Codex CLI',
    operation: `replay.${variant}`,
    input_tokens: record.input_tokens,
    cached_input_tokens: record.cached_input_tokens,
    output_tokens: record.output_tokens,
    reasoning_tokens: record.reasoning_tokens,
    total_tokens: record.tokens,
    latency_ms: record.latency_ms,
    measurement_type: record.measurement_type,
    source: record.source
  });
  return record;
}

export async function compareReplay(root, task_id) {
  const dir = join(root, 'state', 'evals', 'replays'); let files = [];
  try { files = await readdir(dir); } catch { return { task_id, status: 'BLOCKED', reason: 'no replay directory' }; }
  const records = [];
  for (const id of files) {
    try {
      const record = JSON.parse(await readFile(join(dir, id, 'result.json'), 'utf8'));
      if (record.source_task_id === task_id) records.push(record);
    } catch {}
  }
  const baseline = records.filter(item => item.variant === 'baseline').at(-1);
  const mcg = records.filter(item => item.variant === 'mcg').at(-1);
  if (!baseline || !mcg) return { task_id, status: 'BLOCKED', reason: 'paired replay missing', baseline: baseline || null, mcg: mcg || null };
  const savings = Number.isFinite(baseline.tokens) && Number.isFinite(mcg.tokens) && baseline.tokens > 0
    ? Number(((baseline.tokens - mcg.tokens) / baseline.tokens * 100).toFixed(2))
    : null;
  return {
    task_id,
    status: 'COMPARED',
    baseline: { replay_id: baseline.replay_id, tokens: baseline.tokens, success: baseline.success, measurement_type: baseline.measurement_type },
    mcg: { replay_id: mcg.replay_id, tokens: mcg.tokens, success: mcg.success, measurement_type: mcg.measurement_type },
    real_token_saving_percent: savings,
    source: 'state/evals/replays',
    timestamp: new Date().toISOString()
  };
}
