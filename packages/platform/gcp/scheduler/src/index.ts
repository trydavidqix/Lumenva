import { createHash, timingSafeEqual } from 'node:crypto';

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
  expectedToken: string | undefined,
  handler: (ctx: TaskHandlerContext) => Promise<unknown>
): Promise<TaskResult> {
  const authHeader = ctx.authHeader;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : undefined;
  const isAuthorized =
    typeof expectedToken === 'string' &&
    expectedToken.trim().length > 0 &&
    typeof token === 'string' &&
    token.length > 0 &&
    timingSafeEqual(
      createHash('sha256').update(token, 'utf8').digest(),
      createHash('sha256').update(expectedToken, 'utf8').digest()
    );
  if (!isAuthorized) {
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
