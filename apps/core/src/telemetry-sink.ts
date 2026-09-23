import type { CoreEvent } from "./sqlite-store.js";

type MgcTelemetryModule = {
  recordTelemetry(root: string, event: Record<string, unknown>): Promise<unknown>;
};

export class CoreTelemetrySink {
  private readonly modulePromise: Promise<MgcTelemetryModule>;

  constructor(private readonly mcgRoot: string) {
    this.modulePromise = import("@lumenva/maestri-context-gateway/telemetry") as Promise<MgcTelemetryModule>;
  }

  attach(bus: { subscribe(listener: (event: CoreEvent) => Promise<void>): () => void }): () => void {
    return bus.subscribe(async (event) => {
      await this.record(event);
    });
  }

  async record(event: CoreEvent): Promise<void> {
    const payload = isRecord(event.payload) ? event.payload : {};
    const operation = event.type === "context.completed"
      ? "context.compile"
      : event.type === "mcp.catalog.resolved"
        ? "mcp.catalog"
        : event.type;
    const row: Record<string, unknown> = {
      task_id: event.taskId,
      agent: "lumenva-core",
      runtime: "lumenva-core",
      operation,
      measurement_type: typeof payload.measurementType === "string" ? payload.measurementType : "unavailable",
      source: "core.mcg",
      input_chars: typeof payload.inputChars === "number" ? payload.inputChars : undefined,
      output_chars: typeof payload.outputChars === "number" ? payload.outputChars : undefined,
      estimated_tokens: typeof payload.estimatedTokens === "number" ? payload.estimatedTokens : undefined,
      mcp: typeof payload.serverId === "string" ? payload.serverId : undefined,
      provenance: event.type === "mcp.catalog.resolved"
        ? { source: "mcp.gateway", catalog_version: payload.catalogVersion, traceparent: payload.traceparent }
        : undefined,
    };
    const telemetry = await this.modulePromise;
    await telemetry.recordTelemetry(this.mcgRoot, row);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
