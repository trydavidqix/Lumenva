export interface AiTraceSpan {
  end(input: { output?: unknown; error?: unknown; metrics?: Record<string, number> }): Promise<void>;
}

export interface AiTracer {
  startSpan(input: {
    name: string;
    runId: string;
    organizationId: string;
    metadata?: Record<string, unknown>;
    input?: unknown;
  }): Promise<AiTraceSpan>;
}

class NoopAiTraceSpan implements AiTraceSpan {
  async end(_input: { output?: unknown; error?: unknown; metrics?: Record<string, number> }): Promise<void> {}
}

/** Safe fallback for callers when external tracing is unavailable or disabled. */
export class NoopAiTracer implements AiTracer {
  async startSpan(_input: {
    name: string;
    runId: string;
    organizationId: string;
    metadata?: Record<string, unknown>;
    input?: unknown;
  }): Promise<AiTraceSpan> {
    return new NoopAiTraceSpan();
  }
}
