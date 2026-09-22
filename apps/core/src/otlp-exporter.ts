import { createHash } from "node:crypto";

type FetchResponse = { ok: boolean; status: number };
type FetchImpl = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<FetchResponse>;

export type OtlpSpan = {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: Record<string, string | number | boolean>;
  status: "completed" | "failed" | "blocked";
};

export type OtlpExportResult = { exported: true } | { exported: false; reason: "endpoint_not_configured" };

export class OtlpHttpExporter {
  private readonly fetchImpl: FetchImpl;

  constructor(private readonly options: { endpoint?: string; headers?: Record<string, string>; serviceName?: string; fetchImpl?: FetchImpl }) {
    this.fetchImpl = options.fetchImpl ?? (globalThis.fetch as unknown as FetchImpl);
  }

  async exportSpan(span: OtlpSpan): Promise<OtlpExportResult> {
    if (!this.options.endpoint) return { exported: false, reason: "endpoint_not_configured" };
    const body = JSON.stringify({
      resourceSpans: [{
        resource: { attributes: [{ key: "service.name", value: { stringValue: this.options.serviceName ?? "lumenva-core" } }] },
        scopeSpans: [{
          scope: { name: "lumenva.core" },
          spans: [{
            traceId: hex(span.traceId, 32),
            spanId: hex(span.spanId, 16),
            ...(span.parentSpanId ? { parentSpanId: hex(span.parentSpanId, 16) } : {}),
            name: span.name,
            startTimeUnixNano: span.startTimeUnixNano,
            endTimeUnixNano: span.endTimeUnixNano,
            attributes: Object.entries(span.attributes).map(([key, value]) => ({ key, value: attributeValue(value) })),
            status: { code: span.status === "failed" ? 2 : 1 },
          }],
        }],
      }],
    });
    const response = await this.fetchImpl(this.options.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", ...(this.options.headers ?? {}) },
      body,
    });
    if (!response.ok) throw new Error(`OTLP_EXPORT_FAILED:${response.status}`);
    return { exported: true };
  }
}

function hex(value: string, length: number): string {
  return createHash("sha256").update(value).digest("hex").slice(0, length);
}

function attributeValue(value: string | number | boolean): Record<string, string | number | boolean> {
  if (typeof value === "boolean") return { boolValue: value };
  if (typeof value === "number") return { doubleValue: value };
  return { stringValue: value };
}
