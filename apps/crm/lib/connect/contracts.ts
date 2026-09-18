export type ConnectProviderFamily =
  | "commerce"
  | "marketplace"
  | "affiliate"
  | "payment"
  | "social_commerce"
  | "publishing";

export type ConnectCapability =
  | "connect"
  | "disconnect"
  | "healthCheck"
  | "initialSync"
  | "incrementalSync"
  | "registerWebhooks"
  | "handleWebhook"
  | "refreshCredentials"
  | "getProducts"
  | "getOrders"
  | "getSales"
  | "getCommissions"
  | "getRefunds"
  | "getPayouts";

export interface ConnectProvider {
  id: string;
  families: ConnectProviderFamily[];
  capabilities: ConnectCapability[];
}

export type ConnectHealthStatus = "healthy" | "degraded" | "unavailable" | "auth_expired" | "unknown";

export interface ConnectHealthResult {
  provider: string;
  status: ConnectHealthStatus;
  checkedAt: string;
  evidenceRefs: string[];
  retryable: boolean;
}
