import { getStripeCatalogEntry } from "./stripe-catalog";
import { decideStripeWebhook, type StripeWebhookEvent, type StripeWebhookState, type StripeWebhookDecision } from "./stripe-webhook-contract";

export type EntitlementDecision =
  | { readonly decision: "ALLOW" | "DENY"; readonly reason?: string }
  | { readonly kind: "ALLOW" | "DENY"; readonly reason?: string };
export type BrowserCheckoutState = { readonly organizationId?: string; readonly planSlug?: string; readonly productId?: string; readonly priceId?: string; readonly issuedAtUnix?: number };
export type CheckoutRouteDecision =
  | { readonly action: "ALLOW"; readonly planSlug: string; readonly organizationId: string; readonly priceLookupKey: string }
  | { readonly action: "DENY"; readonly reason: "unauthenticated_tenant" | "tenant_mismatch" | "entitlement_denied" | "invalid_browser_state" | "unknown_plan" | "provider_ids_not_authoritative" };

function entitlementAllowed(entitlement: EntitlementDecision): boolean {
  return ("decision" in entitlement ? entitlement.decision : entitlement.kind) === "ALLOW";
}

export function guardStripeCheckoutRoute(
  body: { readonly planSlug?: string; readonly productId?: string; readonly priceId?: string },
  trustedOrganizationId: string | null,
  entitlement: EntitlementDecision,
  browserState: BrowserCheckoutState | null,
  nowUnix = Math.floor(Date.now() / 1000),
): CheckoutRouteDecision {
  if (!trustedOrganizationId?.trim()) return { action: "DENY", reason: "unauthenticated_tenant" };
  if (!browserState || !Number.isSafeInteger(browserState.issuedAtUnix) || nowUnix - (browserState.issuedAtUnix ?? 0) > 900 || nowUnix < (browserState.issuedAtUnix ?? 0)) return { action: "DENY", reason: "invalid_browser_state" };
  if (body.planSlug && browserState.planSlug && body.planSlug !== browserState.planSlug) return { action: "DENY", reason: "invalid_browser_state" };
  if (browserState.organizationId !== trustedOrganizationId) return { action: "DENY", reason: "tenant_mismatch" };
  if (browserState.productId || browserState.priceId) return { action: "DENY", reason: "invalid_browser_state" };
  if (!entitlementAllowed(entitlement)) return { action: "DENY", reason: "entitlement_denied" };
  if (body.productId || body.priceId) return { action: "DENY", reason: "provider_ids_not_authoritative" };
  const entry = body.planSlug ? getStripeCatalogEntry(body.planSlug) : undefined;
  if (!entry) return { action: "DENY", reason: "unknown_plan" };
  return { action: "ALLOW", planSlug: entry.planSlug, organizationId: trustedOrganizationId, priceLookupKey: entry.monthlyPriceLookupKey };
}

export function guardStripeWebhookRoute(event: StripeWebhookEvent, signature: string | null | undefined, signatureVerified: boolean, state: StripeWebhookState): StripeWebhookDecision {
  return decideStripeWebhook(event, signature, signatureVerified, state);
}
