import { describe, expect, it, vi } from 'vitest';
import { createKernelRuntimeAdapter } from '../kernel/runtime-adapter';

describe('AgentKernel runtime adapter', () => {
  it('keeps provider-specific invocation behind the provider-agnostic step port', async () => {
    const step = vi.fn().mockResolvedValue({ kind: 'final', output: { ok: true }, progressFingerprint: 'done', usage: { tokens: 1, costCents: 1, latencyMs: 1 } });
    const runtime = createKernelRuntimeAdapter(step);
    await expect(runtime.step({} as never)).resolves.toMatchObject({ kind: 'final', output: { ok: true } });
    expect(step).toHaveBeenCalledOnce();
  });

  it('rejects invalid negative usage from the provider adapter', async () => {
    const runtime = createKernelRuntimeAdapter(vi.fn().mockResolvedValue({ kind: 'final', output: {}, progressFingerprint: 'done', usage: { tokens: -1, costCents: 0, latencyMs: 0 } }));
    await expect(runtime.step({} as never)).rejects.toThrow('kernel_runtime_invalid_usage');
  });
});
