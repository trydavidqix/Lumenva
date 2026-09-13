import { describe, expect, it } from "vitest";
import { PostgresConsentRegistry } from "./consent-registry";

describe("PostgresConsentRegistry", () => {
  it("persists a consent with an atomic insert and reads the returned record", async () => {
    const queries: string[] = [];
    const db = { query: async <T>(text: string) => { queries.push(text); return { rows: [{ consent_id: "c1", organization_id: "org-1", subject_ref: "contact-1", purpose: "support", channel: "email", status: "GRANTED", source_refs: [], evidence_refs: [] }] as T[] }; } };
    const result = await new PostgresConsentRegistry(db).register({ consent_id: "c1", organization_id: "org-1", subject_ref: "contact-1", purpose: "support", channel: "email", source_refs: [], evidence_refs: [] });
    expect(result.status).toBe("GRANTED");
    expect(queries[0]).toMatch(/insert into public\.contact_consents/i);
    expect(queries[0]).toMatch(/on conflict \(organization_id,consent_id\) do nothing returning/i);
  });
  it("fails closed when the durable reader has no allowed row", async () => {
    const db = { query: async <T>() => ({ rows: [{ allowed: false }] as T[] }) };
    await expect(new PostgresConsentRegistry(db).canContact("org-1", "contact-1", "whatsapp", "support")).resolves.toBe(false);
  });
});
