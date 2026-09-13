import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PublicationConsentError, publishContentItem, type PublicationConsentRecord } from "@/lib/content-os/distribution/publication-service";

const databaseUrl = process.env.DATABASE_URL;
const describeIfDatabase = databaseUrl ? describe : describe.skip;

describeIfDatabase("publication consent enforcement against Postgres", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  let updates = 0;
  let jobs = 0;

  beforeAll(async () => {
    await pool.query("truncate public.contact_consents");
    await pool.query("insert into public.contact_consents (consent_id, organization_id, subject_ref, purpose, channel, status, granted_at) values ('consent-1','org-1','person-1','marketing','email','GRANTED',now())");
    await pool.query("update public.contact_consents set status='REVOKED', revoked_at=now() where organization_id='org-1' and consent_id='consent-1'");
  });

  afterAll(async () => { await pool.end(); });

  it("blocks concurrent publications after consent revocation", async () => {
    const repository = {
      findContentItem: async () => ({ id: "item-1", organizationId: "org-1", status: "approved" }),
      findPublishGate: async () => ({ status: "passed" }),
      findConsent: async (organizationId: string, consentId: string): Promise<PublicationConsentRecord | null> => {
        const result = await pool.query("select consent_id, organization_id, status, granted_at, revoked_at, retention_until from public.contact_consents where organization_id=$1 and consent_id=$2", [organizationId, consentId]);
        return result.rows[0] ?? null;
      },
      updateContentItem: async () => { updates += 1; },
      createPublicationJob: async () => { jobs += 1; throw new Error("must not create a job"); },
    };
    const input = { organizationId: "org-1", contentItemId: "item-1", connectionId: "connection-1", idempotencyKey: "concurrent", title: "Title", body: {}, likenessRefs: ["person-1"], consentRequirements: [{ consent_id: "consent-1", subject_ref: "person-1", channel: "email" as const, purpose: "marketing", likeness_ref: "person-1" }] };
    const results = await Promise.allSettled([publishContentItem(repository, input), publishContentItem(repository, input)]);
    expect(results).toHaveLength(2);
    expect(results.every((result) => result.status === "rejected" && result.reason instanceof PublicationConsentError)).toBe(true);
    expect(updates).toBe(0);
    expect(jobs).toBe(0);
    const row = await pool.query("select status, revoked_at from public.contact_consents where organization_id='org-1' and consent_id='consent-1'");
    expect(row.rows[0].status).toBe("REVOKED");
    expect(row.rows[0].revoked_at).toBeTruthy();
  });
});
