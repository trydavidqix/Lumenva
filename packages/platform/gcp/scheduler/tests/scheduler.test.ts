import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleCloudTask, createMockTaskContext, type TaskHandlerContext } from '../src/index';

describe('GCP Cloud Tasks / Scheduler Contract', () => {
  const SECRET_AUTH_TOKEN = 'test-internal-token-123';
  let processedTasks: Set<string>;

  beforeEach(() => {
    processedTasks = new Set<string>();
  });

  // Fake handler that processes a task and records its ID to prove execution
  const myTaskHandler = async (ctx: TaskHandlerContext) => {
    if (processedTasks.has(ctx.taskId)) {
      // Should not happen if wrapper handles idempotency correctly
      throw new Error('Task already processed');
    }
    processedTasks.add(ctx.taskId);
    return { success: true };
  };

  it('fails if internal authentication is not matching (fail-closed)', async () => {
    const ctx = createMockTaskContext({ authHeader: 'invalid' });
    const result = await handleCloudTask(ctx, SECRET_AUTH_TOKEN, myTaskHandler);

    expect(result.status).toBe('fail');
    expect(result.error).toBe('unauthorized');
    expect(processedTasks.size).toBe(0);
  });

  it('executes task when authentication is valid', async () => {
    const ctx = createMockTaskContext({
      authHeader: `Bearer ${SECRET_AUTH_TOKEN}`,
      taskId: 'task-1'
    });
    const result = await handleCloudTask(ctx, SECRET_AUTH_TOKEN, myTaskHandler);

    expect(result.status).toBe('ok');
    expect(processedTasks.has('task-1')).toBe(true);
  });

  it('enforces idempotency (replay does not duplicate effect)', async () => {
    // We pass a persistent idempotency store (like a mock Redis or DB table) to the handler
    const idempotencyStore = new Set<string>();

    const ctx1 = createMockTaskContext({
      authHeader: `Bearer ${SECRET_AUTH_TOKEN}`,
      taskId: 'task-dedupe-1',
      idempotencyStore
    });

    const result1 = await handleCloudTask(ctx1, SECRET_AUTH_TOKEN, myTaskHandler);
    expect(result1.status).toBe('ok');
    expect(processedTasks.has('task-dedupe-1')).toBe(true);

    // Attempt replay with same taskId
    const ctx2 = createMockTaskContext({
      authHeader: `Bearer ${SECRET_AUTH_TOKEN}`,
      taskId: 'task-dedupe-1',
      idempotencyStore
    });

    const result2 = await handleCloudTask(ctx2, SECRET_AUTH_TOKEN, myTaskHandler);
    expect(result2.status).toBe('ok'); // Request is successful (no error), but effect is no-op

    // It should not throw 'Task already processed' because the handler shouldn't be called
    // We can also verify that myTaskHandler was only invoked once by wrapping it
    const spyHandler = vi.fn(myTaskHandler);
    const ctx3 = createMockTaskContext({
      authHeader: `Bearer ${SECRET_AUTH_TOKEN}`,
      taskId: 'task-dedupe-2',
      idempotencyStore
    });

    await handleCloudTask(ctx3, SECRET_AUTH_TOKEN, spyHandler);
    await handleCloudTask(ctx3, SECRET_AUTH_TOKEN, spyHandler);

    expect(spyHandler).toHaveBeenCalledTimes(1);
  });
});
