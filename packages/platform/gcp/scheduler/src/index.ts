export interface TaskHandlerContext {
  authHeader?: string;
  taskId: string;
  idempotencyStore?: Set<string>;
  payload?: unknown;
}

export interface TaskResult {
  status: 'ok' | 'fail';
  error?: string;
  data?: unknown;
}

export function createMockTaskContext(overrides: Partial<TaskHandlerContext>): TaskHandlerContext {
  return {
    taskId: 'mock-task-id',
    ...overrides
  };
}

export async function handleCloudTask(
  ctx: TaskHandlerContext,
  expectedToken: string,
  handler: (ctx: TaskHandlerContext) => Promise<unknown>
): Promise<TaskResult> {
  const token = ctx.authHeader?.replace('Bearer ', '');
  if (token !== expectedToken) {
    // Expected to map to HTTP 401 or 403 downstream
    return { status: 'fail', error: 'unauthorized' };
  }

  if (ctx.idempotencyStore && ctx.idempotencyStore.has(ctx.taskId)) {
    // Return OK immediately without running logic again.
    return { status: 'ok', data: { note: 'idempotent-replay' } };
  }

  try {
    const data = await handler(ctx);

    if (ctx.idempotencyStore) {
      ctx.idempotencyStore.add(ctx.taskId);
    }

    return { status: 'ok', data };
  } catch (err: unknown) {
    let message = 'Unknown error';
    if (err instanceof Error) {
      message = err.message;
    }
    // Note: The HTTP endpoint using this wrapper MUST translate 'fail' into a non-2xx HTTP code
    // (e.g. 500) for Cloud Tasks to register the failure and trigger backoff/retry.
    return { status: 'fail', error: message };
  }
}
