export type StripeWebhookEvent = {
  readonly eventId: string;
  readonly tenantId: string;
  readonly resourceId: string;
  readonly createdAtUnix: number;
  readonly payload: Record<string, unknown>;
};

export type StripeWebhookState = {
  readonly eventIds: ReadonlySet<string>;
  readonly latestCreatedByResource: ReadonlyMap<string, number>;
};

export type StripeWebhookDecision =
  | { readonly action: "ALLOW"; readonly reason: "accepted" | "duplicate" }
  | { readonly action: "DENY"; readonly reason: "missing_signature" | "invalid_signature" | "invalid_event" | "tenant_mismatch" | "out_of_order" };

export function decideStripeWebhook(
  event: StripeWebhookEvent,
  signature: string | null | undefined,
  signatureVerified: boolean,
  state: StripeWebhookState,
): StripeWebhookDecision {
  if (typeof signature !== "string" || signature.trim() === "") return { action: "DENY", reason: "missing_signature" };
  if (!signatureVerified) return { action: "DENY", reason: "invalid_signature" };
  if (!event.eventId || !event.tenantId || !event.resourceId || !Number.isSafeInteger(event.createdAtUnix) || event.createdAtUnix < 0) return { action: "DENY", reason: "invalid_event" };
  const metadata = event.payload.metadata;
  const payloadTenant = metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>).organization_id : undefined;
  if (payloadTenant !== event.tenantId) return { action: "DENY", reason: "tenant_mismatch" };
  if (state.eventIds.has(event.eventId)) return { action: "ALLOW", reason: "duplicate" };
  const latest = state.latestCreatedByResource.get(event.resourceId);
  if (latest !== undefined && event.createdAtUnix < latest) return { action: "DENY", reason: "out_of_order" };
  return { action: "ALLOW", reason: "accepted" };
}

const SENSITIVE_KEY = /(secret|signature|authorization|token|password|client_secret|api_key|card|cvc|cvv|number|email|phone|raw_body)/i;

export function redactStripeWebhookPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactStripeWebhookPayload);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, child]) => [key, SENSITIVE_KEY.test(key) ? "[REDACTED]" : redactStripeWebhookPayload(child)]));
}

export function denyWhenStripeProviderUnavailable(providerAvailable: boolean) {
  return providerAvailable ? { action: "ALLOW" as const } : { action: "DENY" as const, reason: "provider_unavailable" as const };
}
