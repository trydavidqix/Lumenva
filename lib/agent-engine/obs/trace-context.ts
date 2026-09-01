export interface TraceContext {
  organizationId: string;
  eventId: string;
  traceId: string;
  correlationId: string;
  jobId?: string;
  runId?: string;
  toolId?: string;
  toolInvocationId?: string;
}

export interface DurableJobTraceSource {
  id: string;
  organization_id: string;
  source_event_id: string | null;
  payload: Record<string, unknown>;
}

function requireId(name: string, value: string): string {
  if (value.trim().length === 0) throw new Error(`invalid_trace_context:${name}`);
  return value;
}

function payloadString(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

export function createTraceContext(input: {
  organizationId: string;
  eventId: string;
  traceId: string;
  correlationId: string;
}): TraceContext {
  return {
    organizationId: requireId('organization_id', input.organizationId),
    eventId: requireId('event_id', input.eventId),
    traceId: requireId('trace_id', input.traceId),
    correlationId: requireId('correlation_id', input.correlationId),
  };
}

export function deriveJobTraceContext(parent: TraceContext, jobId: string): TraceContext {
  return { ...parent, jobId: requireId('job_id', jobId) };
}

export function deriveRunTraceContext(parent: TraceContext, runId: string): TraceContext {
  if (!parent.jobId) throw new Error('invalid_trace_context:missing_job_id');
  return { ...parent, runId: requireId('run_id', runId) };
}

export function deriveToolTraceContext(
  parent: TraceContext,
  input: { toolId: string; invocationId: string },
): TraceContext {
  if (!parent.runId) throw new Error('invalid_trace_context:missing_run_id');
  return {
    ...parent,
    toolId: requireId('tool_id', input.toolId),
    toolInvocationId: requireId('tool_invocation_id', input.invocationId),
  };
}

/**
 * Rehydrates trace identity from the durable queue row. This deliberately uses
 * stable persisted IDs so a retry/re-claim continues the same trace instead of
 * inventing a new one in process memory.
 */
export function traceContextFromJob(job: DurableJobTraceSource): TraceContext {
  const eventId = job.source_event_id ?? `job:${job.id}`;
  const traceId =
    payloadString(job.payload, 'trace_id') ??
    payloadString(job.payload, 'correlation_id') ??
    eventId;
  const correlationId =
    payloadString(job.payload, 'correlation_id') ?? job.source_event_id ?? traceId;

  const event = createTraceContext({
    organizationId: job.organization_id,
    eventId,
    traceId,
    correlationId,
  });

  return deriveRunTraceContext(deriveJobTraceContext(event, job.id), job.id);
}
