import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PublicationConsentError, publishContentItem, type PublicationConsentRecord } from "@/lib/content-os/distribution/publication-service";

const databaseUrl = process.env.DATABASE_URL;
const describeIfDatabase = databaseUrl ? describe : describe.skip;
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>((done) => { resolve = done; }); return { promise, resolve }; };

describeIfDatabase("publication consent TOCTOU enforcement against Postgres", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  let updates = 0;
  let jobs = 0;

  beforeAll(async () => {
    await pool.query("truncate public.contact_consents, public.content_items");
    await pool.query("insert into public.content_items (id, organization_id, title, body, status) values ('item-1','org-1','Old', '{}'::jsonb, 'approved')");
    await pool.query("insert into public.contact_consents (consent_id, organization_id, subject_ref, purpose, channel, status, granted_at) values ('consent-1','org-1','person-1','marketing','email','GRANTED',now())");
  });
  afterAll(async () => { await pool.end(); });

  it("blocks when revocation wins the consent lock during publication", async () => {
    const readDone = deferred();
    const atomicAttempt = deferred();
    const selectStarted = deferred();
    const revocationLocked = deferred();
    const releaseRevocation = deferred();
    const client = await pool.connect();
    await client.query("SET lock_timeout = 5000");
    const repository = {
      findContentItem: async () => ({ id: "item-1", organizationId: "org-1", status: "approved" }),
      findPublishGate: async () => ({ status: "passed" }),
      findConsent: async (organizationId: string, consentId: string): Promise<PublicationConsentRecord | null> => {
        const result = await pool.query("select consent_id, organization_id, status, granted_at, revoked_at, retention_until from public.contact_consents where organization_id=$1 and consent_id=$2", [organizationId, consentId]);
        readDone.resolve();
        return result.rows[0] ?? null;
      },
      publishWithConsent: async (input: { organizationId: string; contentItemId: string; title: string; body: Record<string, unknown>; consentIds: readonly string[] }) => {
        atomicAttempt.resolve();
        await client.query("begin");
        try {
          selectStarted.resolve();
          await client.query("select public.fn_publish_content_if_consent($1,$2,$3,$4::jsonb,$5::text[])", [input.organizationId, input.contentItemId, input.title, JSON.stringify(input.body), input.consentIds]);
          await client.query("commit");
        } catch (error) { await client.query("rollback"); if (error instanceof Error && error.message.includes("publication_consent_required")) throw new PublicationConsentError("Consent was revoked before publication commit."); throw error; }
      },
      updateContentItem: async () => { updates += 1; },
      createPublicationJob: async () => { jobs += 1; throw new Error("must not create a job"); },
    };
    const input = { provenance: { contentId: "item-1", skill: "marketing", content: "Title", source: "briefing", freshness: "current", confidence: 0.95, generatedAt: "2026-09-13T00:00:00Z" }, organizationId: "org-1", contentItemId: "item-1", connectionId: "connection-1", idempotencyKey: "toctou", title: "Title", body: {}, likenessRefs: ["person-1"], consentRequirements: [{ consent_id: "consent-1", subject_ref: "person-1", channel: "email" as const, purpose: "marketing", likeness_ref: "person-1" }] };
    const publication = publishContentItem(repository, input);
    await readDone.promise;
    const revocation = (async () => {
      const revoker = await pool.connect();
      await revoker.query("SET lock_timeout = 5000");
      try {
        await revoker.query("begin");
        await revoker.query("update public.contact_consents set status='REVOKED', revoked_at=now() where organization_id='org-1' and consent_id='consent-1'");
        revocationLocked.resolve();
        await atomicAttempt.promise;
        await selectStarted.promise;
        await releaseRevocation.promise;
        await revoker.query("commit");
      } finally { revoker.release(); }
    })();
    await revocationLocked.promise;
    releaseRevocation.resolve();
    const [publicationResult, revocationResult] = await Promise.allSettled([publication, revocation]);
    expect(revocationResult.status).toBe("fulfilled");
    expect(publicationResult.status).toBe("rejected");
    expect(publicationResult.status === "rejected" && publicationResult.reason).toBeInstanceOf(PublicationConsentError);
    expect(updates).toBe(0);
    expect(jobs).toBe(0);
    const row = await pool.query("select status, revoked_at from public.contact_consents where organization_id='org-1' and consent_id='consent-1'");
    expect(row.rows[0].status).toBe("REVOKED");
    expect(row.rows[0].revoked_at).toBeTruthy();
    const item = await pool.query("select status from public.content_items where organization_id='org-1' and id='item-1'");
    expect(item.rows[0].status).toBe("approved");
    client.release();
  });
});
