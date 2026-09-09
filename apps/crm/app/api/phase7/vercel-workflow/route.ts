import { start } from 'workflow/api';

import type { DurableBenchmarkRunInput } from '@/lib/agent-engine/durable-benchmark/contracts';
import { phase7VercelWorkflowBenchmark } from '@/workflows/phase7-vercel-workflow-benchmark';

// A delivery can be submitted more than once before the first workflow has
// been enqueued. Keep the enqueue itself idempotent so duplicate deliveries
// observe the same durable run instead of creating competing workflow runs.
const deliveryRuns = new Map<string, Promise<string>>();

function localOnly(): boolean {
  return process.env.NODE_ENV !== 'production' && !process.env.VERCEL;
}

function isRun(value: unknown): value is DurableBenchmarkRunInput {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.runId === 'string' &&
    typeof candidate.scenarioId === 'string' &&
    typeof candidate.scenarioVersion === 'string' &&
    typeof candidate.organizationId === 'string'
  );
}

export async function GET(): Promise<Response> {
  if (!localOnly()) return new Response('Not found', { status: 404 });
  return Response.json({ ready: true, runtime: 'workflow-local-world' });
}

export async function POST(request: Request): Promise<Response> {
  if (!localOnly()) return new Response('Not found', { status: 404 });
  const body = (await request.json()) as { run?: unknown; deliveryGroupId?: unknown };
  if (!isRun(body.run) || typeof body.deliveryGroupId !== 'string' || !body.deliveryGroupId.trim()) {
    return Response.json({ error: 'invalid_phase7_vercel_workflow_input' }, { status: 400 });
  }
  if (!body.run.organizationId.startsWith('bench-org-')) {
    return Response.json({ error: 'phase7_vercel_workflow_requires_synthetic_organization' }, { status: 400 });
  }

  const deliveryKey = [
    body.run.organizationId,
    body.run.scenarioVersion,
    body.run.scenarioId,
    body.run.runId,
    body.deliveryGroupId,
  ].join(':');
  let runIdPromise = deliveryRuns.get(deliveryKey);
  if (!runIdPromise) {
    runIdPromise = start(phase7VercelWorkflowBenchmark, [{
      run: body.run,
      deliveryGroupId: body.deliveryGroupId,
    }]).then((run) => run.runId);
    deliveryRuns.set(deliveryKey, runIdPromise);
    void runIdPromise.catch(() => {
      if (deliveryRuns.get(deliveryKey) === runIdPromise) deliveryRuns.delete(deliveryKey);
    });
  }

  return Response.json({ runId: await runIdPromise });
}
