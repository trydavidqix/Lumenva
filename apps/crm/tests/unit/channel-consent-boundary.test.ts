import { describe, expect, it } from "vitest";
import { assertChannelConsent, hasChannelConsent } from "@/lib/channels";

const granted = {
  purpose: "marketing" as const,
  legal_basis: "consent" as const,
  channel: "whatsapp" as const,
  recorded_at: "2026-09-15T00:00:00.000Z",
  evidence: { granted_at: "2026-09-15T00:00:00.000Z" },
};

describe("channel consent boundary", () => {
  it("requires active consent for the requested channel", () => {
    expect(hasChannelConsent([granted], "marketing", "whatsapp")).toBe(true);
    expect(hasChannelConsent([granted], "marketing", "instagram")).toBe(false);
    expect(hasChannelConsent([{ ...granted, revoked_at: "2026-09-15T01:00:00.000Z" }], "marketing", "whatsapp")).toBe(false);
  });

  it("does not let a webhook-shaped record grant consent", () => {
    const external = { ...granted, evidence: {}, legal_basis: "consent" as const };
    expect(hasChannelConsent([external], "marketing", "whatsapp")).toBe(false);
    expect(() => assertChannelConsent([external], "marketing", "whatsapp")).toThrow("channel_consent_required");
  });
});
