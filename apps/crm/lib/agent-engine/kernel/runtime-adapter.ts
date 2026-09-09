import type { KernelRuntimePort } from "./ports";

/**
 * Bridges the Kernel to the CRM's existing runtime seam. The adapter owns no
 * provider SDK and no outbound channel. Callers inject the current CRM step
 * implementation, which can continue to use runModelCall + ChannelAdapter.
 */
export function createKernelRuntimeAdapter(step: KernelRuntimePort["step"]): KernelRuntimePort {
  return {
    async step(input) {
      const result = await step(input);
      if (result.usage.tokens < 0 || result.usage.costCents < 0 || result.usage.latencyMs < 0) {
        throw new Error("kernel_runtime_invalid_usage");
      }
      return result;
    },
  };
}
