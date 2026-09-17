import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { authorizeModule } from "@/lib/entitlements/authorize-module";
import { createClient } from "@/lib/supabase/server";
import { consumeCheckoutState, createPostgresCheckoutStateStore } from "@/lib/billing/stripe-browser-state";
import { createStripeCheckoutBoundary, StripeCheckoutError, type StripeCheckoutAdapter } from "@/lib/billing/stripe-checkout";

const requestSchema = z.object({
  plan_slug: z.string().min(1),
  checkout_state: z.string().min(1),
  success_url: z.string().url(),
  cancel_url: z.string().url(),
}).strict();

const BILLING_MODULE = { id: "billing_checkout", version: "1", dependencies: [], conflicts: [], requiredCapabilities: [], allowedRoles: ["admin"], risk: "P3" as const, requiresApproval: false };
const CHECKOUT_STATE_MAX_AGE_SECONDS = 900;

/** Runtime provider seam. Stripe CLI/MCP owns the real adapter; absent means fail-closed. */
export let stripeCheckoutAdapter: StripeCheckoutAdapter = {
  async createCheckoutSession() { throw new StripeCheckoutError("adapter_unavailable", "Stripe checkout adapter is not configured"); },
};

export function configureStripeCheckoutAdapter(adapter: StripeCheckoutAdapter): void {
  stripeCheckoutAdapter = adapter;
}

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("admin", { requestId, resource: "billing_checkout" });
  if (!authz.ok) return authz.response;
  let input: z.infer<typeof requestSchema>;
  try { input = requestSchema.parse(await req.json()); } catch { return fail("validation_failed", "Invalid checkout request.", 422, { requestId }); }
  const supabase = await createClient();
  const stateValid = await consumeCheckoutState(input.checkout_state, {
    organizationId: authz.org.orgId,
    planSlug: input.plan_slug,
    nowUnix: Math.floor(Date.now() / 1000),
    maxAgeSeconds: CHECKOUT_STATE_MAX_AGE_SECONDS,
    secret: process.env.STRIPE_CHECKOUT_STATE_SECRET ?? "",
    store: createPostgresCheckoutStateStore(supabase),
  });
  if (!stateValid) return fail("invalid_checkout_state", "Checkout state is invalid or expired.", 403, { requestId });
  const { data: assignment, error } = await supabase.from("organization_plan").select("plan_id, plans!inner(slug)").eq("organization_id", authz.org.orgId).eq("status", "active").maybeSingle();
  if (error) return fail("internal_error", error.message, 500, { requestId });
  const plans = (assignment as unknown as { plans?: { slug?: unknown } | { slug?: unknown }[] } | null)?.plans;
  const planValue = Array.isArray(plans) ? plans[0]?.slug : plans?.slug;
  const plan = typeof planValue === "string" ? planValue : "standard";
  const entitlement = authorizeModule({ requestId, policyVersion: "entitlements.v1", module: BILLING_MODULE, tenant: { organizationId: authz.org.orgId, rlsOrganizationId: authz.org.orgId, rlsAllowed: true, plan, entitledModules: ["billing_checkout"] }, actor: { actorId: authz.user.id, organizationId: authz.org.orgId, role: authz.org.role, capabilities: [] }, enabledModules: [], maxRisk: "P4", approval: { required: false, approved: false } });
  if (entitlement.decision === "DENY") return fail("forbidden", "Billing checkout is not authorized.", 403, { requestId, details: { reason: entitlement.reason } });
  try {
    const result = await createStripeCheckoutBoundary(stripeCheckoutAdapter).createCheckout({ planSlug: input.plan_slug, organizationId: authz.org.orgId, successUrl: input.success_url, cancelUrl: input.cancel_url });
    return ok(result, { requestId });
  } catch (error) {
    if (error instanceof StripeCheckoutError) return fail(error.code === "adapter_unavailable" ? "upstream_unavailable" : error.code, error.message, error.code === "adapter_unavailable" ? 503 : 422, { requestId });
    return fail("upstream_unavailable", "Stripe checkout unavailable.", 503, { requestId });
  }
}
