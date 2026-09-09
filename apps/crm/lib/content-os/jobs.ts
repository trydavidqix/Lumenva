import type { ProviderJobState } from "./providers/types";

const transitions: Record<ProviderJobState, readonly ProviderJobState[]> = {
  queued: ["running", "failed", "cancelled"],
  running: ["succeeded", "failed", "cancelled"],
  succeeded: [],
  failed: [],
  cancelled: [],
};

export function canTransitionJob(
  from: ProviderJobState,
  to: ProviderJobState,
): boolean {
  return transitions[from].includes(to);
}

export function assertJobTransition(
  from: ProviderJobState,
  to: ProviderJobState,
): void {
  if (!canTransitionJob(from, to)) {
    throw new Error(`Invalid Content OS job transition: ${from} -> ${to}`);
  }
}
