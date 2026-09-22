import type { CoreEvent } from "./sqlite-store.js";
import type { OtlpHttpExporter } from "./otlp-exporter.js";

type MgcTrace = { trace_id: string; session_id: string; task_id?: string | null };
type MgcSpan = { span_id: string };
type MgcTracesModule = {
  createTrace(root: string, input: Record<string, unknown>): Promise<MgcTrace>;
  startSpan(root: string, trace: MgcTrace, input: Record<string, unknown>): Promise<MgcSpan>;
  finishSpan(root: string, trace: MgcTrace, spanId: string, update: Record<string, unknown>): Promise<unknown>;
};

export class CoreTraceSink {
  private readonly modulePromise: Promise<MgcTracesModule>;
  private readonly traces = new Map<string, MgcTrace>();
  private otlpFailures = 0;

  constructor(private readonly mcgRoot: string, private readonly options: { otlpExporter?: Pick<OtlpHttpExporter, "exportSpan"> } = {}) {
    const moduleUrl = new URL("../../../packages/maestri-context-gateway/src/traces.mjs", import.meta.url).href;
    this.modulePromise = import(moduleUrl) as unknown as Promise<MgcTracesModule>;
  }

  attach(bus: { subscribe(listener: (event: CoreEvent) => Promise<void>): () => void }): () => void {
    return bus.subscribe(async (event) => this.record(event));
  }

  async record(event: CoreEvent): Promise<void> {
    const payload = isRecord(event.payload) ? event.payload : {};
    const telemetry = await this.modulePromise;
    let trace = this.traces.get(event.traceId);
    if (!trace) {
      trace = await telemetry.createTrace(this.mcgRoot, { trace_id: event.traceId, task_id: event.taskId, source: "lumenva-core" });
      this.traces.set(event.traceId, trace);
    }
    if (event.type === "task.created") return;

    const operationType = event.type === "mcp.catalog.resolved" ? "mcp.catalog" : event.type;
    const span = await telemetry.startSpan(this.mcgRoot, trace, {
      task_id: event.taskId,
      operation_type: operationType,
      runtime: "lumenva-core",
      mcp_name: typeof payload.serverId === "string" ? payload.serverId : undefined,
      traceparent: typeof payload.traceparent === "string" ? payload.traceparent : undefined,
      source: "core.mcg",
      measurement_type: typeof payload.measurementType === "string" ? payload.measurementType : "unavailable",
      input_chars: typeof payload.inputChars === "number" ? payload.inputChars : undefined,
      output_chars: typeof payload.outputChars === "number" ? payload.outputChars : undefined,
    });
    const status = event.type.endsWith("failed") ? "failed" : "completed";
    await telemetry.finishSpan(this.mcgRoot, trace, span.span_id, {
      status,
      output_chars: typeof payload.outputChars === "number" ? payload.outputChars : undefined,
      error_type: typeof payload.code === "string" ? payload.code : undefined,
      source: "core.mcg",
    });
    if (this.options.otlpExporter) {
      const timestamp = String(BigInt(Date.now()) * 1_000_000n);
      try {
        await this.options.otlpExporter.exportSpan({
          traceId: trace.trace_id,
          spanId: span.span_id,
          name: operationType,
          startTimeUnixNano: timestamp,
          endTimeUnixNano: timestamp,
          attributes: {
            ...(event.taskId ? { task_id: event.taskId } : {}),
            runtime: "lumenva-core",
            operation_type: operationType,
            ...(typeof payload.traceparent === "string" ? { traceparent: payload.traceparent } : {}),
          },
          status,
        });
      } catch {
        this.otlpFailures += 1;
      }
    }
  }

  exportFailures(): number { return this.otlpFailures; }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
