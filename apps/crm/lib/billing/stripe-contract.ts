import { getStripeCatalogEntry } from "./stripe-catalog";

export type StripeWebhookEnvelope = {
  readonly eventId: string;
  readonly tenantId: string;
  readonly resourceId: string;
  readonly createdAtUnix: number;
  readonly payload: Record<string, unknown>;
};

export type WebhookDecision =
  | { readonly action: "ALLOW"; readonly reason: "accepted" | "duplicate" }
  | { readonly action: "DENY"; readonly reason: "missing_signature" | "invalid_signature" | "out_of_order" | "tenant_mismatch" | "invalid_event" };

export type WebhookState = {
  readonly eventIds: ReadonlySet<string>;
  readonly latestCreatedByResource: ReadonlyMap<string, number>;
};

export function requireWebhookSignature(signature: string | null | undefined): "present" | "missing" {
  return typeof signature === "string" && signature.trim().length > 0 ? "present" : "missing";
}

export function decideWebhook(
  input: StripeWebhookEnvelope,
  signature: string | null | undefined,
  signatureVerified: boolean,
  state: WebhookState,
): WebhookDecision {
  if (requireWebhookSignature(signature) === "missing") return { action: "DENY", reason: "missing_signature" };
  if (!signatureVerified) return { action: "DENY", reason: "invalid_signature" };
  if (!input.eventId || !input.tenantId || !input.resourceId || !Number.isSafeInteger(input.createdAtUnix) || input.createdAtUnix < 0) {
    return { action: "DENY", reason: "invalid_event" };
  }
  const payloadTenant = input.payload.metadata && typeof input.payload.metadata === "object"
    ? (input.payload.metadata as Record<string, unknown>).tenant_id
    : undefined;
  if (payloadTenant !== input.tenantId) return { action: "DENY", reason: "tenant_mismatch" };
  if (state.eventIds.has(input.eventId)) return { action: "ALLOW", reason: "duplicate" };
  const latest = state.latestCreatedByResource.get(input.resourceId);
  if (latest !== undefined && input.createdAtUnix < latest) return { action: "DENY", reason: "out_of_order" };
  return { action: "ALLOW", reason: "accepted" };
}

const SENSITIVE_KEY = /(secret|signature|authorization|token|password|client_secret|api_key|card|cvc|cvv|number|email|phone)/i;

export function redactStripePayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactStripePayload);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, child]) => [
    key,
    SENSITIVE_KEY.test(key) ? "[REDACTED]" : redactStripePayload(child),
  ]));
}

export type CheckoutPlanRequest = {
  readonly planSlug?: string;
  readonly productId?: string;
  readonly priceId?: string;
};

export function authorizeCheckoutPlan(request: CheckoutPlanRequest) {
  if (request.productId || request.priceId) return { action: "DENY" as const, reason: "provider_ids_not_authoritative" as const };
  const entry = request.planSlug ? getStripeCatalogEntry(request.planSlug) : undefined;
  return entry
    ? { action: "ALLOW" as const, planSlug: entry.planSlug, productLookupKey: entry.productLookupKey, priceLookupKey: entry.monthlyPriceLookupKey }
    : { action: "DENY" as const, reason: "unknown_plan" as const };
}

export function denyWhenProviderUnavailable(providerAvailable: boolean) {
  return providerAvailable ? { action: "ALLOW" as const } : { action: "DENY" as const, reason: "provider_unavailable" as const };
}
