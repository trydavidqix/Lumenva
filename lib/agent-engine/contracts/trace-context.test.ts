import { describe, expect, it } from 'vitest';

import {
  createTraceContext,
  deriveJobTraceContext,
  deriveRunTraceContext,
  deriveToolTraceContext,
} from '../obs/trace-context';

describe('Agent OS trace context', () => {
  it('preserva identidade do trigger até tool invocation', () => {
    const event = createTraceContext({
      organizationId: 'org-1',
      eventId: 'evt-1',
      traceId: 'trace-1',
      correlationId: 'corr-1',
    });
    const job = deriveJobTraceContext(event, 'job-1');
    const run = deriveRunTraceContext(job, 'run-1');
    const tool = deriveToolTraceContext(run, {
      toolId: 'send_message',
      invocationId: 'tool-call-1',
    });

    expect(tool).toMatchObject({
      organizationId: 'org-1',
      eventId: 'evt-1',
      jobId: 'job-1',
      runId: 'run-1',
      traceId: 'trace-1',
      correlationId: 'corr-1',
      toolId: 'send_message',
      toolInvocationId: 'tool-call-1',
    });
  });

  it('não permite perder trace/correlation ao derivar filhos', () => {
    const event = createTraceContext({
      organizationId: 'org-1',
      eventId: 'evt-1',
      traceId: 'trace-1',
      correlationId: 'corr-1',
    });

    const run = deriveRunTraceContext(deriveJobTraceContext(event, 'job-1'), 'run-1');

    expect(run.traceId).toBe(event.traceId);
    expect(run.correlationId).toBe(event.correlationId);
    expect(run.organizationId).toBe(event.organizationId);
  });
});
