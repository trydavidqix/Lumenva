import type { ConnectHealthResult } from "./contracts";

export interface RawProviderHealth {
  provider: string;
  reachable: boolean | null;
  authenticated: boolean | null;
  degraded: boolean | null;
  evidenceRefs: string[];
  checkedAt?: string;
}

export function normalizeProviderHealth(input: RawProviderHealth): ConnectHealthResult {
  const status = input.authenticated === false
    ? "auth_expired"
    : input.reachable === false
      ? "unavailable"
      : input.reachable === true && input.authenticated === true && input.degraded === true
        ? "degraded"
        : input.reachable === true && input.authenticated === true
          ? "healthy"
          : "unknown";
  return {
    provider: input.provider,
    status,
    checkedAt: input.checkedAt ?? new Date().toISOString(),
    evidenceRefs: [...input.evidenceRefs],
    retryable: status === "degraded" || status === "unavailable" || status === "unknown",
  };
}
