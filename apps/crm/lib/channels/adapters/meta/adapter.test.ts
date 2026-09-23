import { describe, expect, it, vi, beforeEach } from "vitest";
import { MetaAdapter } from "./adapter";
import type { MetaDependencies } from "./dependencies";

const mockFetch = vi.fn();

vi.mock("node-fetch", () => {
  return {
    default: (...args: any[]) => mockFetch(...args),
  };
});
global.fetch = mockFetch as unknown as typeof fetch;

describe("MetaAdapter", () => {
  let deps: MetaDependencies;
  let adapter: MetaAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    deps = {
      fetch: mockFetch as unknown as typeof fetch,
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
      },
      getConfig: vi.fn(async (key: string) => {
        if (key === "META_APP_SECRET") return "fake_secret";
        if (key === "META_TOKEN") return "fake_token";
        return null;
      }),
      idempotencyStore: {
        has: vi.fn(async () => false),
        set: vi.fn(async () => {}),
      },
    };
    adapter = new MetaAdapter(deps);
  });

  describe("verify_webhook", () => {
    it("rejects an invalid signature without leaking secrets", async () => {
      const result = await adapter.execute(
        { organizationId: "org-1", requestId: "req-1" },
        {
          type: "verify_webhook",
          rawBody: '{"test": true}',
          signatureHeader: "sha256=invalidhash",
        }
      );

      expect(result).toEqual({ isValid: false });
    });
  });

  describe("send_template", () => {
    it("returns gracefully formatted result and redacts PII from logging on failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: { code: 132000, message: "Parameter format does not match", error_data: { details: "Invalid phone" } }
        }),
      });

      const result = await adapter.execute(
        { organizationId: "org-1", requestId: "req-1" },
        {
          type: "send_template",
          phoneNumberId: "phone-1",
          to: "551199999999", // Ensure it's passed safely
          templateName: "hello",
          language: "en",
          components: [],
          bindingValues: {},
        }
      );

      // Must be gracefully caught and formatted, rather than an unhandled throw.
      expect(result).toEqual({
        sent: false,
        reason: "api_error",
        code: 132000,
        message: "Invalid phone", // Must extract the detail instead of generic message
        missing: undefined,
      });

      // The log should contain orgId and error, but not the full raw body with phone number
      expect(deps.logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Meta API error"),
        expect.objectContaining({ organizationId: "org-1" })
      );

      const logArgs = (deps.logger.error as any).mock.calls[0][1];
      expect(JSON.stringify(logArgs)).not.toContain("551199999999"); // PII redacted
    });

    it("returns tenant-aware externalId on success", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          messages: [{ id: "wamid.HBgL..." }]
        }),
      });

      const result = await adapter.execute(
        { organizationId: "org-1", requestId: "req-1" },
        {
          type: "send_template",
          phoneNumberId: "phone-1",
          to: "551199999999",
          templateName: "hello",
          language: "en",
          components: [],
          bindingValues: {},
        }
      );

      expect(result).toEqual({
        sent: true,
        tenantAwareExternalId: "org-1:wamid.HBgL...",
      });
    });
  });

  describe("publish", () => {
    it("skips and returns existing when idempotency key is already processed", async () => {
      // Simulate processed key
      (deps.idempotencyStore.has as any).mockResolvedValue(true);

      const result = await adapter.execute(
        { organizationId: "org-1", requestId: "req-1", idempotencyKey: "publish_123" },
        {
          type: "publish_instagram_photo",
          igUserId: "ig-1",
          imageUrl: "https://example.com/photo.jpg",
          caption: "Hello world",
        }
      );

      // If we already sent it, the mock store doesn't have the real ID,
      // but in the real world we'd either look it up or at least NOT call fetch.
      // The test here is simply that we didn't invoke the Meta API.
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("handles 503 Service Unavailable gracefully without breaking the build", async () => {
       mockFetch.mockResolvedValueOnce({
         ok: false,
         status: 503,
         json: async () => ({
           error: { message: "Service Unavailable" }
         }),
       });

       await expect(adapter.execute(
         { organizationId: "org-1", requestId: "req-1" },
         {
           type: "publish_instagram_photo",
           igUserId: "ig-1",
           imageUrl: "https://example.com/photo.jpg",
           caption: "Hello world",
         }
       )).rejects.toThrow(/Meta API error/);
    });
  });
});
