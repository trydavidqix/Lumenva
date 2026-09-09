import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  parseTelnyxCallEvent,
  verifyTelnyxWebhook,
  type TelnyxNumberDirectory,
} from "./webhook";

function signed(body: string, timestamp: number) {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const signature = sign(null, Buffer.from(`${timestamp}|${body}`), privateKey).toString("base64");
  return {
    signature,
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
  };
}

describe("Telnyx voice webhook boundary", () => {
  it("accepts a valid Ed25519 signature inside the replay window", () => {
    const nowMs = Date.UTC(2026, 7, 26, 12, 0, 0);
    const timestamp = Math.floor(nowMs / 1000) - 10;
    const body = JSON.stringify({ data: { event_type: "call.initiated" } });
    const fixture = signed(body, timestamp);
    expect(verifyTelnyxWebhook({
      rawBody: body,
      signatureBase64: fixture.signature,
      timestamp: String(timestamp),
      publicKey: fixture.publicKeyPem,
      nowMs,
    })).toBe(true);
  });

  it("rejects valid signatures older than five minutes", () => {
    const nowMs = Date.UTC(2026, 7, 26, 12, 0, 0);
    const timestamp = Math.floor(nowMs / 1000) - 301;
    const body = JSON.stringify({ data: { event_type: "call.initiated" } });
    const fixture = signed(body, timestamp);
    expect(verifyTelnyxWebhook({
      rawBody: body,
      signatureBase64: fixture.signature,
      timestamp: String(timestamp),
      publicKey: fixture.publicKeyPem,
      nowMs,
    })).toBe(false);
  });

  it("rejects tampered bodies fail closed", () => {
    const nowMs = Date.UTC(2026, 7, 26, 12, 0, 0);
    const timestamp = Math.floor(nowMs / 1000);
    const fixture = signed("{}", timestamp);
    expect(verifyTelnyxWebhook({
      rawBody: '{"tampered":true}',
      signatureBase64: fixture.signature,
      timestamp: String(timestamp),
      publicKey: fixture.publicKeyPem,
      nowMs,
    })).toBe(false);
  });

  it("resolves the tenant from the called technical number before exposing caller identity", async () => {
    const directory: TelnyxNumberDirectory = {
      resolveOrganizationByCalledNumber: vi.fn().mockResolvedValue("org-a"),
    };
    const event = await parseTelnyxCallEvent({
      rawBody: JSON.stringify({
        data: {
          id: "evt-1",
          event_type: "call.initiated",
          occurred_at: "2026-08-26T12:00:00Z",
          payload: {
            call_control_id: "ctrl-1",
            call_session_id: "sess-1",
            from: "+351911111111",
            to: "+351220000000",
            direction: "incoming",
          },
        },
      }),
      directory,
    });
    expect(directory.resolveOrganizationByCalledNumber).toHaveBeenCalledWith("+351220000000");
    expect(event.organizationId).toBe("org-a");
    expect(event.callerE164).toBe("+351911111111");
    expect(event.calledE164).toBe("+351220000000");
    expect(event.attributes).toEqual({ callControlId: "ctrl-1", callSessionId: "sess-1" });
  });

  it("fails closed when the called number is not mapped to an organization", async () => {
    const directory: TelnyxNumberDirectory = {
      resolveOrganizationByCalledNumber: vi.fn().mockResolvedValue(null),
    };
    await expect(parseTelnyxCallEvent({
      rawBody: JSON.stringify({
        data: {
          id: "evt-1",
          event_type: "call.initiated",
          occurred_at: "2026-08-26T12:00:00Z",
          payload: { from: "+351911111111", to: "+351220000000", direction: "incoming" },
        },
      }),
      directory,
    })).rejects.toThrow(/organization/i);
  });
});
