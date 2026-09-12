import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const TEST_SECRET = "whsec_vitest_integration";
const TEST_CREATED = Math.floor(Date.now() / 1000);

const harness = vi.hoisted(() => ({
  repository: {
    recordEntitlementEvent: vi.fn(async () => "inserted" as const),
    getCurrentPlan: vi.fn(async () => null),
    resolveOrganizationId: vi.fn(async ({ metadata }: { metadata: Record<string, unknown> }) => metadata.organization_id as string),
    assertEntitlementGate: vi.fn(async () => undefined),
    upsertOrganizationPlan: vi.fn(async () => undefined),
  },
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({})) }));
vi.mock("@/lib/billing/stripe-repository", () => ({ createStripeWebhookStore: vi.fn(() => harness.repository) }));

import { POST } from "@/app/api/v1/stripe/webhook/route";

function fixture() {
  return JSON.stringify({
    id: "evt_vitest_created",
    type: "customer.subscription.created",
    created: TEST_CREATED,
    data: {
      object: {
        id: "sub_vitest_1",
        customer: "cus_vitest_1",
        status: "trialing",
        metadata: { organization_id: "org-vitest-1", plan_slug: "basic" },
      },
    },
  });
}

function signature(rawBody: string) {
  const digest = createHmac("sha256", TEST_SECRET).update(`${TEST_CREATED}.${rawBody}`).digest("hex");
  return `t=${TEST_CREATED},v1=${digest}`;
}

describe("POST /api/v1/stripe/webhook integration", () => {
  it("returns 200 for a valid signed customer.subscription.created event", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = TEST_SECRET;
    const rawBody = fixture();
    const request = new NextRequest("http://localhost/api/v1/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": signature(rawBody), "content-type": "application/json" },
      body: rawBody,
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { status: "processed", planStatus: "trialing", organizationId: "org-vitest-1" } });
    expect(harness.repository.assertEntitlementGate).toHaveBeenCalledWith({ organizationId: "org-vitest-1", planSlug: "basic", status: "trialing" });
    expect(harness.repository.upsertOrganizationPlan).toHaveBeenCalled();
  });
});
