/** Shared fail-closed mechanics for process/HTTP speech adapters. */
export const DEFAULT_STT_TIMEOUT_MS = 30_000;
export const DEFAULT_TTS_FIRST_AUDIO_TIMEOUT_MS = 15_000;

export function assertLocale(locale: string, provider: string): string {
  const value = locale.trim();
  // BCP-47's common form. Do not silently coerce a caller's locale.
  if (!/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{2,8})*$/.test(value)) {
    throw new Error(`[voice] ${provider} invalid locale "${locale}"`);
  }
  return value;
}

export function timedController(parent: AbortSignal, timeoutMs: number, provider: string) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error(`[voice] ${provider} timeoutMs must be a positive finite number`);
  }
  const controller = new AbortController();
  let timedOut = false;
  const onAbort = () => controller.abort();
  if (parent.aborted) controller.abort();
  else parent.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  return {
    signal: controller.signal,
    abort: () => controller.abort(),
    timedOut: () => timedOut,
    cleanup: () => {
      clearTimeout(timer);
      parent.removeEventListener("abort", onAbort);
    },
  };
}

export async function nextOrAbort<T>(iterator: AsyncIterator<T>, signal: AbortSignal, provider: string): Promise<IteratorResult<T>> {
  if (signal.aborted) throw new Error(`[voice] ${provider} operation aborted`);
  let remove: (() => void) | undefined;
  const aborted = new Promise<never>((_, reject) => {
    const onAbort = () => reject(new Error(`[voice] ${provider} operation aborted`));
    remove = () => signal.removeEventListener("abort", onAbort);
    signal.addEventListener("abort", onAbort, { once: true });
  });
  try {
    return await Promise.race([iterator.next(), aborted]);
  } finally {
    remove?.();
  }
}
