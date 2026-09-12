import { describe, expect, it } from "vitest";
import { ConsentRegistry } from "./consent-registry";

describe("ConsentRegistry", () => {
  it("registers consent per channel with a grant timestamp", () => {
    const registry = new ConsentRegistry();
    const record = registry.register({ consent_id: "consent-wa", organization_id: "org-1", subject_ref: "contact-1", purpose: "support", channel: "whatsapp", source_refs: ["form-1"], evidence_refs: ["event-1"], granted_at: "2026-09-12T20:00:00.000Z" });
    expect(record).toMatchObject({ status: "GRANTED", channel: "whatsapp", granted_at: "2026-09-12T20:00:00.000Z" });
    expect(registry.canContact("org-1", "contact-1", "whatsapp", "support")).toBe(true);
  });

  it("supports email and voice consent independently", () => {
    const registry = new ConsentRegistry();
    registry.register({ consent_id: "email", organization_id: "org-1", subject_ref: "contact-1", purpose: "marketing", channel: "email", source_refs: [], evidence_refs: [] });
    registry.register({ consent_id: "voice", organization_id: "org-1", subject_ref: "contact-1", purpose: "support", channel: "voice", source_refs: [], evidence_refs: [] });
    expect(registry.canContact("org-1", "contact-1", "email", "marketing")).toBe(true);
    expect(registry.canContact("org-1", "contact-1", "voice", "marketing")).toBe(false);
  });

  it("revokes consent with a timestamp and blocks contact", () => {
    const registry = new ConsentRegistry();
    registry.register({ consent_id: "consent-1", organization_id: "org-1", subject_ref: "contact-1", purpose: "support", channel: "email", source_refs: [], evidence_refs: [], granted_at: "2026-09-12T20:00:00.000Z" });
    const revoked = registry.revoke("org-1", "consent-1", "2026-09-12T21:00:00.000Z");
    expect(revoked).toMatchObject({ status: "REVOKED", revoked_at: "2026-09-12T21:00:00.000Z" });
    expect(registry.canContact("org-1", "contact-1", "email", "support")).toBe(false);
  });

  it("fails closed across tenants", () => {
    const registry = new ConsentRegistry();
    registry.register({ consent_id: "consent-1", organization_id: "org-1", subject_ref: "contact-1", purpose: "support", channel: "voice", source_refs: [], evidence_refs: [] });
    expect(registry.get("org-2", "consent-1")).toBeUndefined();
    expect(() => registry.revoke("org-2", "consent-1")).toThrow("consent_tenant_mismatch");
  });
});
