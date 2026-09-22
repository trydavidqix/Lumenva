import { spawn } from 'node:child_process';

export const EXECUTION_CLASSES = Object.freeze({
  TINY: { timeout_ms: 30_000 },
  LIGHT: { timeout_ms: 90_000 },
  NORMAL: { timeout_ms: 300_000 },
  HEAVY: { timeout_ms: 900_000 }
});

export function resolveExecutionPolicy({ job_class = 'NORMAL', timeout_ms, heartbeat_ms = 5_000, grace_ms = 2_000 } = {}) {
  const normalized = String(job_class || 'NORMAL').toUpperCase();
  const base = EXECUTION_CLASSES[normalized];
  if (!base) throw new Error(`unknown execution class: ${job_class}`);
  return {
    job_class: normalized,
    timeout_ms: Number.isFinite(timeout_ms) && timeout_ms > 0 ? timeout_ms : base.timeout_ms,
    heartbeat_ms: Number.isFinite(heartbeat_ms) && heartbeat_ms > 0 ? heartbeat_ms : 5_000,
    grace_ms: Number.isFinite(grace_ms) && grace_ms >= 0 ? grace_ms : 2_000
  };
}

export function classifyExit({ code, signal, timed_out, cancelled, spawn_error }) {
  if (spawn_error) return 'SPAWN_ERROR';
  if (timed_out) return 'TIMEOUT';
  if (cancelled) return 'CANCELLED';
  if (code === 0) return 'SUCCESS';
  if (signal) return 'SIGNAL';
  return 'NON_ZERO';
}

export function runProcess({
  command,
  args = [],
  cwd,
  env,
  job_class = 'NORMAL',
  timeout_ms,
  heartbeat_ms,
  grace_ms,
  signal,
  onHeartbeat
} = {}) {
  if (!command) throw new Error('command is required');
  const policy = resolveExecutionPolicy({ job_class, timeout_ms, heartbeat_ms, grace_ms });

  return new Promise(resolve => {
    const startedAtMs = Date.now();
    const started_at = new Date(startedAtMs).toISOString();
    const stdout = [];
    const stderr = [];
    let child;
    let settled = false;
    let timed_out = false;
    let cancelled = false;
    let spawn_error = null;
    let hardKillTimer = null;
    let heartbeatTimer = null;
    let timeoutTimer = null;
    let heartbeat_count = 0;
    let last_activity_at = started_at;
    let last_heartbeat_at = null;

    const finish = (code = null, exitSignal = null) => {
      if (settled) return;
      settled = true;
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (hardKillTimer) clearTimeout(hardKillTimer);
      if (signal) signal.removeEventListener('abort', abortHandler);
      const finishedAtMs = Date.now();
      const classification = classifyExit({ code, signal: exitSignal, timed_out, cancelled, spawn_error });
      resolve({
        code,
        signal: exitSignal,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
        started_at,
        finished_at: new Date(finishedAtMs).toISOString(),
        duration_ms: finishedAtMs - startedAtMs,
        last_activity_at,
        last_heartbeat_at,
        heartbeat_count,
        timed_out,
        cancelled,
        spawn_error: spawn_error ? String(spawn_error.message || spawn_error) : null,
        classification,
        policy
      });
    };

    const stop = reason => {
      if (settled || !child) return;
      if (reason === 'timeout') timed_out = true;
      if (reason === 'cancel') cancelled = true;
      try { child.kill('SIGTERM'); } catch {}
      hardKillTimer = setTimeout(() => {
        if (settled || child.exitCode != null) return;
        try { child.kill('SIGKILL'); } catch { try { child.kill(); } catch {} }
      }, policy.grace_ms);
      hardKillTimer.unref?.();
    };

    const abortHandler = () => stop('cancel');
    if (signal?.aborted) {
      cancelled = true;
      return finish(null, null);
    }

    try {
      child = spawn(command, args, {
        cwd,
        env,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });
    } catch (error) {
      spawn_error = error;
      return finish(null, null);
    }

    child.stdin?.end();
    child.stdout?.on('data', chunk => {
      stdout.push(Buffer.from(chunk));
      last_activity_at = new Date().toISOString();
    });
    child.stderr?.on('data', chunk => {
      stderr.push(Buffer.from(chunk));
      last_activity_at = new Date().toISOString();
    });
    child.on('error', error => {
      spawn_error = error;
      if (!child.pid) finish(null, null);
    });
    child.on('close', (code, exitSignal) => finish(code, exitSignal));

    if (signal) signal.addEventListener('abort', abortHandler, { once: true });
    timeoutTimer = setTimeout(() => stop('timeout'), policy.timeout_ms);
    timeoutTimer.unref?.();
    heartbeatTimer = setInterval(() => {
      heartbeat_count += 1;
      last_heartbeat_at = new Date().toISOString();
      onHeartbeat?.({
        pid: child.pid || null,
        heartbeat_count,
        last_activity_at,
        last_heartbeat_at,
        job_class: policy.job_class
      });
    }, policy.heartbeat_ms);
    heartbeatTimer.unref?.();
  });
}
