import { spawn } from "node:child_process";
import { realpath } from "node:fs/promises";
import { basename, isAbsolute, relative, resolve } from "node:path";
import type { RuntimeCommand, RuntimeCommandResult } from "./contracts.js";
import { assertRuntimeCommand } from "./contracts.js";

export interface CommandRunnerPolicy {
  workspaceRoots: readonly string[];
  allowedExecutables: readonly string[];
  allowedEnv?: readonly string[];
  baseEnv?: Readonly<Record<string, string | undefined>>;
}

export class CommandPolicyError extends Error {
  constructor(readonly code: "cwd_denied" | "executable_denied" | "env_denied", message: string) {
    super(message);
    this.name = "CommandPolicyError";
  }
}

const SECRET_KEY = /(token|secret|password|passwd|api[_-]?key|authorization|cookie)/i;
const SECRET_VALUE = /(bearer\s+[a-z0-9._~+\/-]+=*|(?:sk|ghp|github_pat|xox)[-_a-z0-9]{12,})/gi;

export function redactRuntimeText(value: string): string {
  return value.replace(SECRET_VALUE, "[REDACTED]");
}

function contained(root: string, child: string): boolean {
  const rel = relative(root, child);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

async function canonicalExistingPath(path: string): Promise<string> {
  return realpath(resolve(path));
}

export class SafeCommandRunner {
  private readonly allowedExecutables: Set<string>;
  private readonly allowedEnv: Set<string>;

  constructor(private readonly policy: CommandRunnerPolicy) {
    this.allowedExecutables = new Set(policy.allowedExecutables.map((value) => value.toLowerCase()));
    this.allowedEnv = new Set(policy.allowedEnv ?? []);
  }

  async run(command: RuntimeCommand, env: Readonly<Record<string, string | undefined>> = {}): Promise<RuntimeCommandResult> {
    assertRuntimeCommand(command);
    const executable = basename(command.executable).toLowerCase();
    if (!this.allowedExecutables.has(executable)) {
      throw new CommandPolicyError("executable_denied", "runtime_executable_denied");
    }

    const cwd = await canonicalExistingPath(command.cwd);
    const roots = await Promise.all(this.policy.workspaceRoots.map(canonicalExistingPath));
    if (!roots.some((root) => contained(root, cwd))) {
      throw new CommandPolicyError("cwd_denied", "runtime_cwd_denied");
    }

    const childEnv: Record<string, string> = {};
    for (const [key, value] of Object.entries({ ...(this.policy.baseEnv ?? {}), ...env })) {
      if (value === undefined) continue;
      if (!this.allowedEnv.has(key)) throw new CommandPolicyError("env_denied", "runtime_env_denied");
      if (SECRET_KEY.test(key)) continue;
      childEnv[key] = value;
    }

    const started = Date.now();
    return new Promise<RuntimeCommandResult>((resolveResult, reject) => {
      const child = spawn(command.executable, [...command.args], {
        cwd,
        env: childEnv,
        shell: false,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      let bytes = 0;
      let truncated = false;
      let timedOut = false;
      let settled = false;

      const append = (target: "stdout" | "stderr", chunk: Buffer) => {
        if (truncated) return;
        const remaining = command.maxOutputBytes - bytes;
        if (remaining <= 0) { truncated = true; return; }
        const slice = chunk.subarray(0, remaining);
        bytes += slice.byteLength;
        const text = redactRuntimeText(slice.toString("utf8"));
        if (target === "stdout") stdout += text; else stderr += text;
        if (slice.byteLength < chunk.byteLength) truncated = true;
      };
      child.stdout.on("data", (chunk: Buffer) => append("stdout", chunk));
      child.stderr.on("data", (chunk: Buffer) => append("stderr", chunk));

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
        const hardKill = setTimeout(() => child.kill("SIGKILL"), 1_000);
        hardKill.unref();
      }, command.timeoutMs);
      timer.unref();

      child.once("error", (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      });
      child.once("close", (exitCode, signal) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolveResult({
          commandId: command.id,
          exitCode,
          signal,
          stdout,
          stderr,
          truncated,
          timedOut,
          durationMs: Math.max(0, Date.now() - started),
        });
      });
    });
  }
}
