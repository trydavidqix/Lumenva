import { Client, type ClientConfig } from "langsmith";

import { NoopAiTracer, type AiTraceSpan, type AiTracer } from "./ai-tracing";
import { opaqueTenantId, sanitizeExternalTraceValue } from "./external-redaction";
import { resolveExternalTracingConfig, type ExternalTracingConfig } from "./external-tracing-config";
import { createLogger, type Logger } from "./logger";

type EnabledTracingConfig = Extract<ExternalTracingConfig, { enabled: true }>;
type LangSmithRun = Parameters<Client["createRun"]>[0];
type LangSmithRunUpdate = Parameters<Client["updateRun"]>[1];

export interface LangSmithClient {
  createRun(run: LangSmithRun): Promise<void>;
  updateRun(runId: string, run: LangSmithRunUpdate): Promise<void>;
}

export interface LangSmithAiTracerDeps {
  logger?: Logger;
  resolveConfig?: (input: { organizationId: string }) => Promise<ExternalTracingConfig>;
  createClient?: (config: ClientConfig) => LangSmithClient;
  now?: () => Date;
}

function defaultClient(config: ClientConfig): LangSmithClient {
  return new Client(config);
}

function dottedOrder(startedAt: Date, runId: string): string {
  const timestamp = `${startedAt.toISOString().slice(0, -1)}001Z`;
  // Keep the punctuation removal explicit: Tailwind treats the equivalent
  // character-class regex as an arbitrary utility candidate while scanning
  // source files, then emits invalid CSS for it during `next build`.
  return timestamp.replaceAll("-", "").replaceAll(":", "").replaceAll(".", "") + runId;
}

function sanitizedString(value: unknown): string {
  const sanitized = sanitizeExternalTraceValue(value);
  return typeof sanitized === "string" ? sanitized : JSON.stringify(sanitized);
}

function sanitizedMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> {
  const sanitized = sanitizeExternalTraceValue(metadata ?? {});
  if (sanitized !== null && typeof sanitized === "object" && !Array.isArray(sanitized)) {
    return sanitized as Record<string, unknown>;
  }
  return {};
}

function toClientConfig(config: EnabledTracingConfig): ClientConfig {
  return {
    apiKey: config.apiKey,
    ...(config.endpoint ? { apiUrl: config.endpoint } : {}),
    ...(config.workspaceId ? { workspaceId: config.workspaceId } : {}),
    // Supply trace_id + dotted_order below so the SDK queues exports rather than
    // blocking the agent on a network round trip.
    autoBatchTracing: true,
    manualFlushMode: false,
    blockOnRootRunFinalization: false,
  };
}

class LangSmithAiTraceSpan implements AiTraceSpan {
  constructor(
    private readonly client: LangSmithClient,
    private readonly runId: string,
    private readonly traceId: string,
    private readonly traceDottedOrder: string,
    private readonly tenantId: string,
    private readonly traceName: string,
    private readonly log: Logger,
    private readonly now: () => Date,
    private readonly cleanup: () => void,
  ) {}

  async end(input: { output?: unknown; error?: unknown; metrics?: Record<string, number> }): Promise<void> {
    try {
      await this.client.updateRun(this.runId, {
        trace_id: this.traceId,
        dotted_order: this.traceDottedOrder,
        end_time: this.now().getTime(),
        ...(input.output === undefined ? {} : { outputs: { output: sanitizeExternalTraceValue(input.output) } }),
        ...(input.error === undefined ? {} : { error: sanitizedString(input.error) }),
        ...(input.metrics === undefined ? {} : { extra: { metadata: sanitizeExternalTraceValue(input.metrics) } }),
      } as LangSmithRunUpdate);
    } catch {
      this.log.warn("LangSmith tracing failed", {
        event: "langsmith_trace_failure",
        operation: "end",
        tenant_id: this.tenantId,
        trace_name: this.traceName,
      });
    } finally {
      this.cleanup();
    }
  }
}

/**
 * Optional, best-effort LangSmith tracing. Every payload is sanitized before it
 * reaches the SDK and all setup/export failures fall back to a no-op span.
 */
export class LangSmithAiTracer implements AiTracer {
  private readonly noop = new NoopAiTracer();
  private readonly log: Logger;
  private readonly resolveConfig: (input: { organizationId: string }) => Promise<ExternalTracingConfig>;
  private readonly createClient: (config: ClientConfig) => LangSmithClient;
  private readonly now: () => Date;
  private readonly dottedOrders = new Map<string, string>();

  constructor(deps: LangSmithAiTracerDeps = {}) {
    this.log = deps.logger ?? createLogger();
    this.resolveConfig = deps.resolveConfig ?? resolveExternalTracingConfig;
    this.createClient = deps.createClient ?? defaultClient;
    this.now = deps.now ?? (() => new Date());
  }

  async startSpan(input: {
    name: string;
    runId: string;
    traceId?: string;
    parentRunId?: string;
    organizationId: string;
    metadata?: Record<string, unknown>;
    input?: unknown;
  }): Promise<AiTraceSpan> {
    const tenantId = opaqueTenantId(input.organizationId);
    const traceName = sanitizedString(input.name);
    const traceId = input.traceId ?? input.runId;

    let config: ExternalTracingConfig;
    try {
      config = await this.resolveConfig({ organizationId: input.organizationId });
    } catch {
      this.warn("resolve_config", tenantId, traceName);
      return this.noop.startSpan(input);
    }

    if (!config.enabled) return this.noop.startSpan(input);

    try {
      const startedAt = this.now();
      const client = this.createClient(toClientConfig(config));
      const ownDottedOrder = dottedOrder(startedAt, input.runId);
      const parentDottedOrder = input.parentRunId === undefined ? undefined : this.dottedOrders.get(input.parentRunId);
      const traceDottedOrder = parentDottedOrder === undefined ? ownDottedOrder : `${parentDottedOrder}.${ownDottedOrder}`;
      await client.createRun({
        id: input.runId,
        trace_id: traceId,
        dotted_order: traceDottedOrder,
        ...(input.parentRunId === undefined ? {} : { parent_run_id: input.parentRunId }),
        name: traceName,
        run_type: "chain",
        start_time: startedAt.getTime(),
        ...(config.project ? { project_name: config.project } : {}),
        inputs: { input: sanitizeExternalTraceValue(input.input) },
        extra: {
          metadata: {
            organization_id: tenantId,
            ...sanitizedMetadata(input.metadata),
          },
        },
      } as LangSmithRun);
      this.dottedOrders.set(input.runId, traceDottedOrder);
      return new LangSmithAiTraceSpan(
        client,
        input.runId,
        traceId,
        traceDottedOrder,
        tenantId,
        traceName,
        this.log,
        this.now,
        () => this.dottedOrders.delete(input.runId),
      );
    } catch {
      this.warn("start", tenantId, traceName);
      return this.noop.startSpan(input);
    }
  }

  private warn(operation: "resolve_config" | "start", tenantId: string, traceName: string): void {
    this.log.warn("LangSmith tracing failed", {
      event: "langsmith_trace_failure",
      operation,
      tenant_id: tenantId,
      trace_name: traceName,
    });
  }
}
