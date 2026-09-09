export const providerJobStates = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
] as const;

export type ProviderJobState = (typeof providerJobStates)[number];

export type ProviderHealth = {
  ok: boolean;
  checkedAt: string;
  latencyMs?: number;
  code?: string;
  message?: string;
};

export type ProviderJobRef = {
  provider: string;
  providerJobId: string;
  state: ProviderJobState;
};
