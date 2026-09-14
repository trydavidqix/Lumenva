import { describe, expect, it } from "vitest";
import { PostgresConsentRegistry } from "./consent-registry";

describe("PostgresConsentRegistry", () => {
  it("persists a consent with an atomic insert and normalizes database timestamps", async () => {
    const queries: string[] = [];
    const db = { query: async <T>(text: string) => {
      queries.push(text);
      return { rows: [{ consent_id: "c1", organization_id: "org-1", subject_ref: "contact-1", purpose: "support", channel: "email", status: "GRANTED", granted_at: new Date("2026-09-14T20:00:00.000Z"), source_refs: [], evidence_refs: [] }] as T[] };
    } };
    const result = await new PostgresConsentRegistry(db).register({ consent_id: "c1", organization_id: "org-1", subject_ref: "contact-1", purpose: "support", channel: "email", source_refs: [], evidence_refs: [] });
    expect(result).toMatchObject({ status: "GRANTED", granted_at: "2026-09-14T20:00:00.000Z" });
    expect(queries[0]).toMatch(/insert into public\.contact_consents/i);
    expect(queries[0]).toMatch(/on conflict \(organization_id,consent_id\) do nothing returning/i);
  });

  it("rejects a same-tenant consent id replay whose grant facts differ", async () => {
    let call = 0;
    const db = { query: async <T>() => {
      call += 1;
      if (call === 1) return { rows: [] as T[] };
      return { rows: [{ consent_id: "c1", organization_id: "org-1", subject_ref: "contact-original", purpose: "support", channel: "email", status: "GRANTED", granted_at: "2026-09-14T20:00:00.000Z", source_refs: ["form-1"], evidence_refs: ["event-1"] }] as T[] };
    } };
    await expect(new PostgresConsentRegistry(db).register({ consent_id: "c1", organization_id: "org-1", subject_ref: "contact-other", purpose: "marketing", channel: "voice", source_refs: ["form-2"], evidence_refs: ["event-2"] })).rejects.toThrow("consent_conflict");
  });

  it("fails closed when the durable reader has no allowed row", async () => {
    const db = { query: async <T>() => ({ rows: [{ allowed: false }] as T[] }) };
    await expect(new PostgresConsentRegistry(db).canContact("org-1", "contact-1", "whatsapp", "support")).resolves.toBe(false);
  });
});
