import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { cancelledResult, ExecutionPort, HealthSnapshot, TaskContract, ExecutionResult, QuotaSnapshot, unavailableQuota, unavailableResult, UsageSnapshot } from "./execution-port.js";

const execFileAsync = promisify(execFile);

export interface ClaudeRunnerResult { output: string; usage?: UsageSnapshot; }
export interface ClaudeRunner { run(contract: TaskContract): Promise<ClaudeRunnerResult>; health?: () => Promise<HealthSnapshot>; capabilities?: () => Promise<string[]>; }

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function claudeUsage(output: string): UsageSnapshot | undefined {
  try {
    const payload = JSON.parse(output) as Record<string, unknown>;
    const usage = payload.usage as Record<string, unknown> | undefined;
    if (!usage) return undefined;
    return {
      input_tokens: numberOrZero(usage.input_tokens),
      cached_tokens: numberOrZero(usage.cache_creation_input_tokens) + numberOrZero(usage.cache_read_input_tokens),
      output_tokens: numberOrZero(usage.output_tokens),
      duration_ms: numberOrZero(payload.duration_ms),
      cost_usd: numberOrZero(payload.total_cost_usd),
    };
  } catch {
    return undefined;
  }
}

const executionSchema = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["success", "failure", "partial", "unavailable", "cancelled"] },
    summary: { type: "string" },
    files_changed: { type: "array", items: { type: "string" } },
    commands: { type: "array", items: { type: "string" } },
    tests: { type: "array", items: { type: "object" } },
    evidence: { type: "array", items: { type: "string" } },
  },
  required: ["status", "summary", "files_changed", "commands", "tests", "evidence"],
  additionalProperties: false,
} as const;

export function createClaudeCliRunner(): ClaudeRunner {
  const executable = process.platform === "win32" ? "claude.cmd" : "claude";
  return {
    async health() {
      try {
        await execFileAsync(executable, ["--version"], { timeout: 5_000, windowsHide: true });
        await execFileAsync(executable, ["auth", "status"], { timeout: 5_000, windowsHide: true });
        return { ok: true, status: "healthy" };
      } catch {
        return { ok: false, status: "unavailable", message: "Claude CLI or authentication is unavailable" };
      }
    },
    async capabilities() { return ["execute", "structured_output", "read_only"]; },
    async run(contract) {
      const prompt = JSON.stringify({ contract, instruction: "Execute only read-only inspection within the contract and return the required structured result." });
      const result = await execFileAsync(executable, [
        "--print", prompt, "--output-format", "json", "--json-schema", JSON.stringify(executionSchema),
        "--tools", "Read", "--permission-mode", "plan", "--permission-prompts", "none", "--no-session-persistence",
      ], { cwd: process.cwd(), timeout: 120_000, maxBuffer: 8 * 1024 * 1024, windowsHide: true });
      return { output: result.stdout, usage: claudeUsage(result.stdout) };
    },
  };
}

function parseResult(taskId: string, output: string, usage?: UsageSnapshot): ExecutionResult {
  try {
    const payload = JSON.parse(output) as Record<string, unknown>;
    const parsed = (typeof payload.result === "string" ? JSON.parse(payload.result) : payload) as Partial<ExecutionResult>;
    if (!parsed.status || !parsed.summary || !Array.isArray(parsed.files_changed) || !Array.isArray(parsed.commands) || !Array.isArray(parsed.tests) || !Array.isArray(parsed.evidence)) throw new Error("provider_result_schema_invalid");
    return { ...parsed, task_id: taskId, usage } as ExecutionResult;
  } catch {
    return { task_id: taskId, status: "failure", summary: "Claude returned an unstructured result", files_changed: [], commands: [], tests: [], evidence: [], error: { code: "invalid_provider_result", message: "Claude response did not match ExecutionResult schema", retryable: true } };
  }
}

export class ClaudeAdapter implements ExecutionPort {
  public name = "claude";
  private lastUsage: UsageSnapshot = { input_tokens: 0, cached_tokens: 0, output_tokens: 0, duration_ms: 0, cost_usd: 0 };
  constructor(private readonly runner?: ClaudeRunner) {}
  async execute(contract: TaskContract): Promise<ExecutionResult> {
    if (!this.runner) return unavailableResult(contract.task_id, this.name, "Claude execution adapter is not configured for this runtime");
    try {
      const result = await this.runner.run(contract);
      const usage = result.usage ?? claudeUsage(result.output);
      if (usage) this.lastUsage = usage;
      return parseResult(contract.task_id, result.output, usage);
    }
    catch (error) { return unavailableResult(contract.task_id, this.name, error instanceof Error ? error.message : "Claude execution failed"); }
  }
  async resume(taskId: string): Promise<ExecutionResult> { return unavailableResult(taskId, this.name, "Claude resume is unavailable because no execution handle is configured"); }
  async cancel(taskId: string): Promise<ExecutionResult> { return cancelledResult(taskId, this.name); }
  async health(): Promise<HealthSnapshot> { return this.runner?.health ? this.runner.health() : { ok: false, status: "unavailable", message: "Claude health probe is not configured" }; }
  async capabilities(): Promise<string[]> { return this.runner?.capabilities ? this.runner.capabilities() : []; }
  async usage(): Promise<UsageSnapshot> { return this.lastUsage; }
  async quota(): Promise<QuotaSnapshot> { return unavailableQuota(this.name); }
  async checkQuota(): Promise<QuotaSnapshot> { return this.quota(); }
}
