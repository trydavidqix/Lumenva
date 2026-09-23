import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WahaTransportAdapter } from "./adapter";
import { ExternalOperationContext, ChannelTransportCommand } from "./types";
import { env } from "@/lib/env";

const globalFetch = global.fetch;

describe("WahaTransportAdapter (TDD Fakes)", () => {
  let adapter: WahaTransportAdapter;

  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();

    vi.stubEnv("WAHA_API_BASE_URL", "http://fake-waha");
    vi.stubEnv("WAHA_API_KEY", "fake-api-key");

    // Explicitly update the mocked env object which adapter uses via dynamic getter
    (env as any).WAHA_API_BASE_URL = "http://fake-waha";
    (env as any).WAHA_API_KEY = "fake-api-key";

    adapter = new WahaTransportAdapter();
  });

  afterEach(() => {
    global.fetch = globalFetch;
    vi.unstubAllEnvs();
  });

  it("should pass X-Api-Key header and NOT Authorization Bearer", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "waha-msg-id-123" })
    });
    global.fetch = fetchMock;

    const ctx: ExternalOperationContext = { organizationId: "org-1", requestId: "req-1" };
    const command: ChannelTransportCommand = {
      type: "send_message",
      sessionRef: "session-1",
      to: "5511999999999",
      body: "Hello"
    };

    const result = await adapter.execute(ctx, command);

    expect(fetchMock).toHaveBeenCalled();
    const fetchCall = fetchMock.mock.calls[0];
    if (!fetchCall) throw new Error("fetchCall is undefined");
    const url = fetchCall[0];
    const options = fetchCall[1];

    expect(options.headers["X-Api-Key"]).toBe("fake-api-key");
    expect(options.headers["Authorization"]).toBeUndefined();

    expect(url).not.toContain("fake-api-key");

    expect(result.externalId).toBe("waha-msg-id-123");
  });

  it("should handle 23505 deduplication appropriately", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("duplicate key value violates unique constraint 23505"));
    global.fetch = fetchMock;

    const ctx: ExternalOperationContext = { organizationId: "org-1", requestId: "req-1", idempotencyKey: "idem-key-123" };
    const command: ChannelTransportCommand = {
      type: "send_message",
      sessionRef: "session-1",
      to: "5511999999999",
      body: "Hello"
    };

    const result = await adapter.execute(ctx, command);

    expect(result.externalId).toBe("idem-key-123");
    expect(result.error).toBeUndefined();
  });

  it("should validate webhook signature properly using SHA-512", async () => {
    const ctx: ExternalOperationContext = { organizationId: "org-1", requestId: "req-1" };

    const command: ChannelTransportCommand = {
      type: "verify_webhook",
      rawBody: "{}",
      signatureHeader: "bad-signature",
      sessionSecret: "this-is-a-valid-secret-for-sha512"
    };

    const result = await adapter.execute(ctx, command);

    expect(result.isValid).toBe(false);
    expect(result.reason).toBe("bad_signature");
  });

  it("should create signed URLs for media if they refer to storage (fake implementation)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "waha-media-id-123" })
    });
    global.fetch = fetchMock;

    const ctx: ExternalOperationContext = { organizationId: "org-1", requestId: "req-1" };
    const command: ChannelTransportCommand = {
      type: "send_message",
      sessionRef: "session-1",
      to: "5511999999999",
      media: {
        url: "https://signed-url.com/file?token=123",
        mimetype: "application/pdf"
      }
    };

    const result = await adapter.execute(ctx, command);

    expect(fetchMock).toHaveBeenCalled();
    const fetchCall = fetchMock.mock.calls[0];
    if (!fetchCall) throw new Error("fetchCall is undefined");
    const options = fetchCall[1];

    expect(options.body).toContain("https://signed-url.com/file?token=123");
    expect(result.externalId).toBe("waha-media-id-123");
  });

  it("should handle session lifecycle properly (stop then start)", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("/stop")) return { ok: true };
      if (url.includes("/api/sessions") && !url.includes("/start")) return { ok: true, status: 201 };
      if (url.includes("/start")) return { ok: true, json: async () => ({ status: "SCAN_QR_CODE", qr: "qr-data" }) };
      return { ok: true, json: async () => ({}) };
    });
    global.fetch = fetchMock;

    const ctx: ExternalOperationContext = { organizationId: "org-1", requestId: "req-1" };

    await adapter.execute(ctx, { type: "stop_session", sessionRef: "session-1" });

    const result = await adapter.execute(ctx, { type: "start_session", sessionRef: "session-1" });

    expect(result.status).toBe("SCAN_QR_CODE");
    expect(result.qr).toBe("qr-data");
  });
});
