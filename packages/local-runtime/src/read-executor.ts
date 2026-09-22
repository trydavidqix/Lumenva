import { readFile, readdir, realpath, stat } from "node:fs/promises";
import { createConnection } from "node:net";
import { isAbsolute, join, relative, resolve } from "node:path";
import type { RuntimeCommand, RuntimeCorrelation } from "./contracts.js";
import { SafeCommandRunner } from "./command-runner.js";

export interface ExecutorResult<T> {
  capabilityId: string;
  risk: "R0";
  deterministic: true;
  value: T;
}

export interface ReadExecutorOptions {
  workspaceRoot: string;
  commandRunner: SafeCommandRunner;
  gitExecutable?: string;
  maxFileBytes?: number;
  maxSearchResults?: number;
}

function isContained(root: string, child: string): boolean {
  const rel = relative(root, child);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

export class ReadOnlyLocalExecutor {
  private readonly gitExecutable: string;
  private readonly maxFileBytes: number;
  private readonly maxSearchResults: number;

  constructor(private readonly options: ReadExecutorOptions) {
    this.gitExecutable = options.gitExecutable ?? "git";
    this.maxFileBytes = options.maxFileBytes ?? 512_000;
    this.maxSearchResults = options.maxSearchResults ?? 100;
  }

  async read(path: string): Promise<ExecutorResult<string>> {
    const file = await this.resolveAllowed(path);
    const info = await stat(file);
    if (!info.isFile()) throw new Error("runtime_not_file");
    if (info.size > this.maxFileBytes) throw new Error("runtime_file_too_large");
    return this.result("fs.read", await readFile(file, "utf8"));
  }

  async search(query: string): Promise<ExecutorResult<readonly string[]>> {
    if (!query) throw new Error("runtime_search_query_required");
    const root = await realpath(this.options.workspaceRoot);
    const matches: string[] = [];
    const walk = async (dir: string): Promise<void> => {
      if (matches.length >= this.maxSearchResults) return;
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        if (matches.length >= this.maxSearchResults) break;
        if (entry.name === ".git" || entry.name === "node_modules") continue;
        const path = join(dir, entry.name);
        if (entry.isDirectory()) { await walk(path); continue; }
        if (!entry.isFile()) continue;
        const info = await stat(path);
        if (info.size > this.maxFileBytes) continue;
        let text: string;
        try { text = await readFile(path, "utf8"); } catch { continue; }
        if (text.includes(query)) matches.push(relative(root, path));
      }
    };
    await walk(root);
    return this.result("fs.search", matches);
  }

  async gitStatus(correlation: RuntimeCorrelation): Promise<ExecutorResult<string>> {
    return this.git("git.status", correlation, ["status", "--short", "--branch"]);
  }

  async gitDiff(correlation: RuntimeCorrelation): Promise<ExecutorResult<string>> {
    return this.git("git.diff", correlation, ["diff", "--no-ext-diff"]);
  }

  async gitLog(correlation: RuntimeCorrelation, count = 20): Promise<ExecutorResult<string>> {
    const safeCount = Math.max(1, Math.min(Math.trunc(count), 100));
    return this.git("git.log", correlation, ["log", `-${safeCount}`, "--oneline", "--decorate"]);
  }

  async readLog(path: string, maxLines = 200): Promise<ExecutorResult<string>> {
    const value = (await this.read(path)).value;
    const lines = value.split(/\r?\n/);
    return this.result("logs.read", lines.slice(-Math.max(1, Math.min(maxLines, 2_000))).join("\n"));
  }

  async serviceHealth(url: string, timeoutMs = 3_000): Promise<ExecutorResult<{ ok: boolean; status: number | null }>> {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("runtime_health_protocol_denied");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(parsed, { method: "GET", signal: controller.signal, redirect: "error" });
      return this.result("service.health", { ok: response.ok, status: response.status });
    } catch {
      return this.result("service.health", { ok: false, status: null });
    } finally {
      clearTimeout(timer);
    }
  }

  async portCheck(host: string, port: number, timeoutMs = 1_000): Promise<ExecutorResult<boolean>> {
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("runtime_port_invalid");
    const open = await new Promise<boolean>((resolveResult) => {
      const socket = createConnection({ host, port });
      const done = (value: boolean) => { socket.destroy(); resolveResult(value); };
      socket.setTimeout(timeoutMs);
      socket.once("connect", () => done(true));
      socket.once("timeout", () => done(false));
      socket.once("error", () => done(false));
    });
    return this.result("port.check", open);
  }

  private async git(capabilityId: string, correlation: RuntimeCorrelation, args: readonly string[]): Promise<ExecutorResult<string>> {
    const cwd = await realpath(this.options.workspaceRoot);
    const command: RuntimeCommand = {
      id: crypto.randomUUID(),
      correlation,
      capabilityId,
      executable: this.gitExecutable,
      args,
      cwd,
      timeoutMs: 10_000,
      maxOutputBytes: 512_000,
      risk: "R0",
    };
    const output = await this.options.commandRunner.run(command);
    if (output.exitCode !== 0) throw new Error(`runtime_git_failed:${output.stderr}`);
    return this.result(capabilityId, output.stdout);
  }

  private async resolveAllowed(path: string): Promise<string> {
    const root = await realpath(this.options.workspaceRoot);
    const candidate = await realpath(resolve(root, path));
    if (!isContained(root, candidate)) throw new Error("runtime_path_denied");
    return candidate;
  }

  private result<T>(capabilityId: string, value: T): ExecutorResult<T> {
    return { capabilityId, risk: "R0", deterministic: true, value };
  }
}
