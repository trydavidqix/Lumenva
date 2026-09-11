export interface QuotaBudget { limit: number; used: number; }
export type QuotaReservation = { ok: true; remaining: number } | { ok: false; remaining: number; requested: number; reason: "quota_exhausted" };
export class QuotaManager {
  private readonly budgets = new Map<string, QuotaBudget>();
  constructor(initial: Readonly<Record<string, QuotaBudget>> = {}) {
    for (const [tenantId, budget] of Object.entries(initial)) this.budgets.set(tenantId, { ...budget });
  }
  remaining(tenantId: string): number {
    const budget = this.budgets.get(tenantId);
    if (!budget) throw new Error("E_QUOTA_NOT_FOUND");
    return Math.max(0, budget.limit - budget.used);
  }
  reserve(tenantId: string, units: number): QuotaReservation {
    if (!Number.isInteger(units) || units <= 0) throw new Error("E_QUOTA_UNITS_INVALID");
    const budget = this.budgets.get(tenantId);
    if (!budget) throw new Error("E_QUOTA_NOT_FOUND");
    const remaining = this.remaining(tenantId);
    if (units > remaining) return { ok: false, remaining, requested: units, reason: "quota_exhausted" };
    budget.used += units;
    return { ok: true, remaining: remaining - units };
  }
  forecast(tenantId: string, requested: number): { exhausted: boolean; remaining: number; requested: number } {
    if (!Number.isInteger(requested) || requested <= 0) throw new Error("E_QUOTA_UNITS_INVALID");
    return { exhausted: requested > this.remaining(tenantId), remaining: this.remaining(tenantId), requested };
  }
}
export interface ToolExecutionRequest { tenantId: string; sessionId: string; executionEpoch: number; toolName: string; idempotencyKey: string; args: unknown; }
export interface ToolExecutionContext { tenantId: string; sessionId: string; executionEpoch: number; toolName: string; args: unknown; }
export type ToolExecutor = (context: ToolExecutionContext) => Promise<unknown>;
export type ToolExecutionResult = { kind: "executed" | "deduped"; value: unknown };
function stable(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, nested]) => JSON.stringify(key) + ":" + stable(nested)).join(",") + "}";
  return JSON.stringify(value) ?? "null";
}
export class ToolRuntime {
  private readonly executors: Readonly<Record<string, ToolExecutor>>;
  private readonly completed = new Map<string, { fingerprint: string; value: unknown }>();
  private readonly epochs = new Map<string, number>();
  private readonly tenantIds?: ReadonlySet<string>;
  constructor(executors: Readonly<Record<string, ToolExecutor>>, options: { tenantIds?: readonly string[] } = {}) { this.executors = executors; this.tenantIds = options.tenantIds ? new Set(options.tenantIds) : undefined; }
  async execute(request: ToolExecutionRequest): Promise<ToolExecutionResult> {
    if (!request.tenantId || !request.sessionId) throw new Error("E_TENANT_CONTEXT_REQUIRED");
    if (this.tenantIds && !this.tenantIds.has(request.tenantId)) throw new Error("E_TENANT_MISMATCH");
    if (!Number.isInteger(request.executionEpoch) || request.executionEpoch < 0) throw new Error("E_EPOCH_INVALID");
    if (!request.idempotencyKey.trim()) throw new Error("E_IDEMPOTENCY_KEY_REQUIRED");
    const sessionKey = request.tenantId + ":" + request.sessionId;
    const currentEpoch = this.epochs.get(sessionKey);
    if (currentEpoch !== undefined && request.executionEpoch < currentEpoch) throw new Error("E_STALE_EPOCH");
    if (currentEpoch === undefined || request.executionEpoch > currentEpoch) this.epochs.set(sessionKey, request.executionEpoch);
    const key = sessionKey + ":" + request.idempotencyKey;
    const fingerprint = request.toolName + ":" + stable(request.args);
    const prior = this.completed.get(key);
    if (prior) {
      if (prior.fingerprint !== fingerprint) throw new Error("E_IDEMPOTENCY_CONFLICT");
      return { kind: "deduped", value: prior.value };
    }
    const executor = this.executors[request.toolName];
    if (!executor) throw new Error("E_TOOL_NOT_REGISTERED");
    const value = await executor({ tenantId: request.tenantId, sessionId: request.sessionId, executionEpoch: request.executionEpoch, toolName: request.toolName, args: request.args });
    this.completed.set(key, { fingerprint, value });
    return { kind: "executed", value };
  }
}
export interface MemoryRecord { tenantId: string; type: string; key: string; value: unknown; }
export interface MemoryPolicy { allowedReadTypes: readonly string[]; allowedWriteTypes: readonly string[]; }
export class MemoryGate {
  private readonly policies: Readonly<Record<string, MemoryPolicy>>;
  private readonly records = new Map<string, MemoryRecord>();
  constructor(policies: Readonly<Record<string, MemoryPolicy>>) { this.policies = policies; }
  private policy(tenantId: string): MemoryPolicy {
    const policy = this.policies[tenantId];
    if (!policy) throw new Error("E_TENANT_MISMATCH");
    return policy;
  }
  read(input: { tenantId: string; type: string; key: string }): MemoryRecord | undefined {
    if (!this.policy(input.tenantId).allowedReadTypes.includes(input.type)) throw new Error("E_MEMORY_READ_FORBIDDEN");
    return this.records.get(input.tenantId + ":" + input.type + ":" + input.key);
  }
  write(record: MemoryRecord): void {
    if (!this.policy(record.tenantId).allowedWriteTypes.includes(record.type)) throw new Error("E_MEMORY_WRITE_FORBIDDEN");
    this.records.set(record.tenantId + ":" + record.type + ":" + record.key, { ...record });
  }
}
export interface HandoffPackData { tenantId: string; sessionId: string; executionEpoch: number; currentGoal: string; knownFacts: readonly string[]; decisions: readonly string[]; pending: readonly string[]; }
export class HandoffPack {
  private constructor(private readonly data: HandoffPackData) {}
  static create(data: HandoffPackData): HandoffPack {
    if (!data.tenantId || !data.sessionId || !data.currentGoal) throw new Error("E_HANDOFF_CONTEXT_REQUIRED");
    if (!Number.isInteger(data.executionEpoch) || data.executionEpoch < 0) throw new Error("E_EPOCH_INVALID");
    return new HandoffPack({ ...data, knownFacts: [...data.knownFacts], decisions: [...data.decisions], pending: [...data.pending] });
  }
  toJSON(): HandoffPackData { return { ...this.data, knownFacts: [...this.data.knownFacts], decisions: [...this.data.decisions], pending: [...this.data.pending] }; }
}
