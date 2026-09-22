import {
  RUNTIME_PROTOCOL_VERSION,
  type RuntimeCapability,
  type RuntimeEvent,
  type RuntimeHealth,
  type RuntimeIdentity,
  type RuntimeState,
} from "./contracts.js";

export interface RuntimeDaemonOptions {
  runtimeId: string;
  hostId: string;
  version: string;
  capabilities?: readonly RuntimeCapability[];
  now?: () => Date;
  id?: () => string;
  heartbeatTimeoutMs?: number;
  onEvent?: (event: RuntimeEvent) => void | Promise<void>;
}

export class LocalRuntimeDaemon {
  private readonly now: () => Date;
  private readonly id: () => string;
  private readonly onEvent?: RuntimeDaemonOptions["onEvent"];
  private readonly heartbeatTimeoutMs: number;
  private readonly identity: RuntimeIdentity;
  private readonly capabilities: readonly RuntimeCapability[];
  private state: RuntimeState = "offline";
  private startedAt: string | null = null;
  private lastHeartbeatAt: string | null = null;

  constructor(options: RuntimeDaemonOptions) {
    if (!options.runtimeId.trim() || !options.hostId.trim() || !options.version.trim()) {
      throw new Error("runtime_identity_invalid");
    }
    this.now = options.now ?? (() => new Date());
    this.id = options.id ?? (() => crypto.randomUUID());
    this.onEvent = options.onEvent;
    this.heartbeatTimeoutMs = options.heartbeatTimeoutMs ?? 30_000;
    this.identity = {
      runtimeId: options.runtimeId,
      hostId: options.hostId,
      version: options.version,
      protocolVersion: RUNTIME_PROTOCOL_VERSION,
    };
    this.capabilities = Object.freeze([...(options.capabilities ?? [])]);
  }

  async start(): Promise<RuntimeHealth> {
    if (this.state !== "offline") return this.health();
    const now = this.timestamp();
    this.state = "idle";
    this.startedAt = now;
    this.lastHeartbeatAt = now;
    await this.emit("runtime.started", { identity: this.identity });
    return this.health();
  }

  async heartbeat(): Promise<RuntimeHealth> {
    if (this.state === "offline" || this.state === "stopping") {
      throw new Error("runtime_not_started");
    }
    this.lastHeartbeatAt = this.timestamp();
    await this.emit("runtime.heartbeat", { state: this.state });
    return this.health();
  }

  async stop(): Promise<RuntimeHealth> {
    if (this.state === "offline") return this.health();
    this.state = "stopping";
    await this.emit("runtime.offline", { reason: "graceful_shutdown" });
    this.state = "offline";
    return this.health();
  }

  setBusy(busy: boolean): RuntimeHealth {
    if (this.state === "offline" || this.state === "stopping") throw new Error("runtime_not_started");
    this.state = busy ? "busy" : "idle";
    return this.health();
  }

  isHeartbeatStale(at = this.now()): boolean {
    if (!this.lastHeartbeatAt) return true;
    const last = Date.parse(this.lastHeartbeatAt);
    return !Number.isFinite(last) || at.getTime() - last > this.heartbeatTimeoutMs;
  }

  health(): RuntimeHealth {
    return {
      identity: { ...this.identity },
      state: this.state,
      startedAt: this.startedAt,
      lastHeartbeatAt: this.lastHeartbeatAt,
      capabilities: this.capabilities.map((capability) => ({ ...capability })),
    };
  }

  private timestamp(): string {
    return this.now().toISOString();
  }

  private async emit(type: RuntimeEvent["type"], payload: unknown): Promise<void> {
    if (!this.onEvent) return;
    await this.onEvent({
      id: this.id(),
      type,
      correlation: { organizationId: "system", traceId: this.id() },
      occurredAt: this.timestamp(),
      payload,
    });
  }
}
