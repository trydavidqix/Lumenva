import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { processStripeWebhook, type StripeWebhookStore } from "./stripe-webhook";

const secret = "whsec_test";
const nowMs = Date.UTC(2026, 8, 12, 12, 0, 0);
const event = (o: Record<string, unknown> = {}, created = Math.floor(nowMs / 1000)) => JSON.stringify({ id: "evt_1", type: "customer.subscription.updated", created, data: { object: { id: "sub_1", customer: "cus_1", status: "active", metadata: { plan_slug: "basic" }, ...o } } });
const signature = (body: string) => { const t = Math.floor(nowMs / 1000); return `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`; };
function store(overrides: Partial<StripeWebhookStore> = {}): StripeWebhookStore { return { recordEntitlementEvent: vi.fn(async () => "inserted" as const), getCurrentPlan: vi.fn(async () => null), resolveOrganizationId: vi.fn(async () => "org_1"), assertEntitlementGate: vi.fn(async () => undefined), upsertOrganizationPlan: vi.fn(async () => undefined), ...overrides }; }

describe("Stripe webhook boundary", () => {
  it("rejects invalid signature", async () => { const repository = store(); const body = event(); await expect(processStripeWebhook({ rawBody: body, signature: signature(body).replace(/.$/, "0"), secret, nowMs, repository })).rejects.toThrow(/signature/i); expect(repository.recordEntitlementEvent).not.toHaveBeenCalled(); });
  it("rejects missing event envelope fields", async () => { const body = JSON.stringify({ data: { object: {} } }); await expect(processStripeWebhook({ rawBody: body, signature: signature(body), secret, nowMs, repository: store() })).rejects.toThrow(/event/i); });
  it("deduplicates provider_event_id", async () => { const repository = store({ recordEntitlementEvent: vi.fn(async () => "duplicate" as const) }); const body = event(); await expect(processStripeWebhook({ rawBody: body, signature: signature(body), secret, nowMs, repository })).resolves.toEqual({ status: "duplicate", providerEventId: "evt_1" }); expect(repository.upsertOrganizationPlan).not.toHaveBeenCalled(); });
  it("ignores out-of-order events after recording them", async () => { const repository = store({ getCurrentPlan: vi.fn(async () => ({ status: "active" as const, planSlug: "premium", providerEventId: "evt_new", occurredAt: "2026-09-12T12:00:00.000Z" })) }); const body = event({ status: "past_due" }, Math.floor(nowMs / 1000) - 10); await expect(processStripeWebhook({ rawBody: body, signature: signature(body), secret, nowMs, repository })).resolves.toEqual({ status: "out_of_order", providerEventId: "evt_1" }); expect(repository.upsertOrganizationPlan).not.toHaveBeenCalled(); });
  it("maps lifecycle status and gates before persistence", async () => { const repository = store(); const body = event({ status: "trialing" }); await expect(processStripeWebhook({ rawBody: body, signature: signature(body), secret, nowMs, repository })).resolves.toMatchObject({ status: "processed", planStatus: "trialing" }); expect(repository.assertEntitlementGate).toHaveBeenCalledWith({ organizationId: "org_1", planSlug: "basic", status: "trialing" }); expect(repository.upsertOrganizationPlan).toHaveBeenCalled(); });
});
