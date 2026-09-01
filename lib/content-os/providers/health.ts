import type { ProviderHealth } from "./types";

const DEFAULT_TIMEOUT_MS = 5_000;

class ProviderHealthTimeoutError extends Error {}

export async function checkProviderHealth(
  check: () => Promise<void>,
  options: { timeoutMs?: number } = {},
): Promise<ProviderHealth> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const startedAt = Date.now();
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    await Promise.race([
      Promise.resolve().then(check),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new ProviderHealthTimeoutError()),
          timeoutMs,
        );
      }),
    ]);

    return {
      ok: true,
      code: "ok",
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    const timedOut = error instanceof ProviderHealthTimeoutError;

    return {
      ok: false,
      code: timedOut ? "timeout" : "unavailable",
      message: timedOut
        ? "Provider health check timed out"
        : "Provider health check failed",
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
    };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
