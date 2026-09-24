import { beforeEach, describe, expect, it, vi } from "vitest";

const { envMock, loggerMock } = vi.hoisted(() => ({
  envMock: { WAHA_HMAC_SECRET: "", WAHA_WEBHOOK_REQUIRE_SIGNATURE: "false" },
  loggerMock: { warn: vi.fn() },
}));
vi.mock("@/lib/env", () => ({ env: envMock }));
vi.mock("@/lib/logger", () => ({ logger: loggerMock }));

import { authenticateWahaWebhook } from "./webhook-auth";

describe("unsigned WAHA webhook warnings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envMock.WAHA_WEBHOOK_REQUIRE_SIGNATURE = "false";
  });

  it("accepts unsigned input as unverified and logs only organization and session", () => {
    const rawBody = '{"event":"message","payload":{"text":"private body"}}';
    const input = {
      rawBody,
      signatureHeader: null,
      sessionSecret: null,
      organizationId: "org-unsigned-test",
      session: "session-unsigned-test",
    };

    const result = authenticateWahaWebhook(input);

    expect(result).toEqual({ ok: true, signatureVerified: false });
    expect(loggerMock.warn).toHaveBeenCalledWith(
      "WAHA webhook accepted without signature",
      { organization_id: "org-unsigned-test", session: "session-unsigned-test" }
    );
    expect(JSON.stringify(loggerMock.warn.mock.calls)).not.toContain(rawBody);
  });

  it("throttles unsigned warning logs to once per minute per session", () => {
    const input = {
      rawBody: "{}",
      signatureHeader: null,
      sessionSecret: null,
      organizationId: "org-throttle-test",
      session: "session-throttle-test",
    };

    authenticateWahaWebhook(input);
    authenticateWahaWebhook(input);

    expect(loggerMock.warn).toHaveBeenCalledTimes(1);
  });

  it("does not log an unsigned request rejected by signature enforcement", () => {
    envMock.WAHA_WEBHOOK_REQUIRE_SIGNATURE = "true";

    const result = authenticateWahaWebhook({ rawBody: "{}", signatureHeader: null, sessionSecret: null });

    expect(result).toEqual({ ok: false, reason: "signature_required" });
    expect(loggerMock.warn).not.toHaveBeenCalled();
  });
});
