import { describe, it, expect, vi, beforeEach } from "vitest";

// Stripe
import { StripeAdapter } from "../../packages/integrations/stripe/src/adapter";
import Stripe from "stripe";

// Nuvemshop
import { NuvemshopAdapter } from "../../packages/integrations/nuvemshop/src/index";

// Meta
import { MetaAdapter } from "../../apps/crm/lib/channels/adapters/meta/adapter";

// Resend
import { ResendAdapter } from "../../packages/integrations/resend/src/index";

// Rate-Limit
import { SlidingWindowRateLimiter, FakeRedisBackend } from "../../packages/platform/rate-limit/src/index";

// Sentry
import { scrubEvent } from "../../packages/observability/sentry/src/before-send";

describe("F7 Adapter Contracts Matrix", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Stripe Adapter", () => {
    it("handles provider offline / timeout safely", async () => {
      const adapter = new StripeAdapter({ apiKey: "sk_test_123" });
      const spy = vi.spyOn(adapter["stripe"].prices, "list").mockRejectedValue(new Error("Timeout"));

      await expect(
        adapter.createCheckoutSession(
          { organizationId: "org-1", requestId: "req-1" },
          {
            priceLookupKey: "price_1",
            successUrl: "https://example.com",
            cancelUrl: "https://example.com",
            trialDays: 0,
            trialRequiresPaymentMethod: false,
            metadata: { organization_id: "org-1", plan_slug: "plan_1" },
          }
        )
      ).rejects.toThrow("Stripe API Error: Timeout");

      spy.mockRestore();
    });

    it("handles idempotency correctly", async () => {
      const adapter = new StripeAdapter({ apiKey: "sk_test_123" });

      const priceSpy = vi.spyOn(adapter["stripe"].prices, "list").mockResolvedValue({
        data: [{ id: "price_1", unit_amount: 1000, currency: "usd" }]
      } as any);

      const createSpy = vi.spyOn(adapter["stripe"].checkout.sessions, "create").mockResolvedValue({
        id: "cs_123",
        url: "https://checkout.stripe.com/123"
      } as any);

      await adapter.createCheckoutSession(
        { organizationId: "org-1", requestId: "req-1", idempotencyKey: "idem_123" },
        {
          priceLookupKey: "price_1",
          successUrl: "https://example.com",
          cancelUrl: "https://example.com",
          trialDays: 0,
          trialRequiresPaymentMethod: false,
          metadata: { organization_id: "org-1", plan_slug: "plan_1" },
        }
      );

      expect(createSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ idempotencyKey: "idem_123" })
      );

      priceSpy.mockRestore();
      createSpy.mockRestore();
    });
  });

  describe("Nuvemshop Adapter", () => {
    it("handles timeout/retry", async () => {
      const adapter = new NuvemshopAdapter({ retryDelaysMs: [10] }); // short retry

      const fetchSpy = vi.spyOn(global, 'fetch').mockRejectedValue(new Error("Network Error"));

      const res = await adapter.execute(
        { organizationId: "org-1", requestId: "req-1" },
        { type: "get_store", storeId: "123", token: "tok" }
      );

      expect(fetchSpy).toHaveBeenCalledTimes(2); // 1 initial + 1 retry
      expect(res.ok).toBe(false);
      expect(res.error).toBe("network_error");

      fetchSpy.mockRestore();
    });

    it("prevents SSRF for webhook URLs", async () => {
      const adapter = new NuvemshopAdapter();

      const resLocal = await adapter.execute(
        { organizationId: "org-1", requestId: "req-1" },
        { type: "create_webhook", storeId: "123", token: "tok", event: "app/uninstalled", url: "https://localhost/webhook" }
      );

      expect(resLocal.ok).toBe(false);
      expect(resLocal.error).toBe("invalid_webhook_url");

      const resHttp = await adapter.execute(
        { organizationId: "org-1", requestId: "req-1" },
        { type: "create_webhook", storeId: "123", token: "tok", event: "app/uninstalled", url: "http://example.com/webhook" }
      );

      expect(resHttp.ok).toBe(false);
      expect(resHttp.error).toBe("invalid_webhook_url");
    });
  });

  describe("Resend Adapter", () => {
    it("handles idempotency and rate limiting", async () => {
      const adapter = new ResendAdapter();

      vi.stubEnv('RESEND_API_KEY', 're_1234567890');

      const mockSend = vi.fn().mockResolvedValue({
        error: { name: "RateLimitError", message: "Too many requests" }
      });

      vi.spyOn(adapter as any, 'getClient').mockReturnValue({
        emails: { send: mockSend }
      });

      const res = await adapter.execute(
        { organizationId: "org-1", requestId: "req-1", idempotencyKey: "idem_123" },
        { to: "test@example.com", subject: "Hello", html: "<p>Hello</p>" }
      );

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: { "Idempotency-Key": "idem_123" },
          tags: [{ name: "idempotency_key", value: "idem_123" }]
        })
      );
      expect(res.ok).toBe(false);
      expect(res.error).toBe("rate_limited");

      vi.unstubAllEnvs();
    });
  });

  describe("Rate-Limit", () => {
    it("fails closed or open based on config", async () => {
      const backend = new FakeRedisBackend();
      backend.simulateFailure(true);

      const failClosedLimiter = new SlidingWindowRateLimiter(backend, { windowMs: 1000, maxRequests: 5, failClosed: true });
      const resClosed = await failClosedLimiter.check("org-1", "test");
      expect(resClosed.allowed).toBe(false);
      expect(resClosed.error).toBeDefined();

      const failOpenLimiter = new SlidingWindowRateLimiter(backend, { windowMs: 1000, maxRequests: 5, failClosed: false });
      const resOpen = await failOpenLimiter.check("org-1", "test");
      expect(resOpen.allowed).toBe(true);
      expect(resOpen.error).toBeDefined();
    });
  });

  describe("Sentry Adapter", () => {
    it("scrubs PII", () => {
      const event: any = {
        request: {
          headers: {
            authorization: "Bearer secret",
            cookie: "session=123",
          },
          data: {
            password: "mysecretpassword",
            email: "test@example.com"
          }
        }
      };

      const scrubbed = scrubEvent(event);
      expect(scrubbed?.request?.headers?.authorization).toBe("[Filtered]");
      expect(scrubbed?.request?.headers?.cookie).toBe("[Filtered]");
    });
  });

  describe("Meta Adapter gaps", () => {
    it.skip("gap_meta_adapter_missing_webhook_replay_protection", async () => {
      const deps = {
        getConfig: vi.fn(),
        logger: { warn: vi.fn(), error: vi.fn() },
        idempotencyStore: { has: vi.fn(), set: vi.fn() }
      } as any;
      const adapter = new MetaAdapter(deps);

      deps.getConfig.mockResolvedValue("secret");

      const res = await adapter.execute(
        { organizationId: "org-1", requestId: "req-1" },
        { type: "verify_webhook", rawBody: "body", signatureHeader: "sig" }
      );
      expect(res.isValid).toBe(false);
      // gap: there should be a replay protection assertion here.
    });
  });

  describe("WAHA Adapter gaps", () => {
    it.skip("gap_waha_adapter_missing_retry_config", async () => {
      // Missing retry config explicitly mapped from WAHA config instead of relying on
      // internal retry implementations.
    });
  });
});
