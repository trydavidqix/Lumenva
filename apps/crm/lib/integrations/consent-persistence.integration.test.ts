import pg from "pg";
import { describe, expect, it } from "vitest";
import { PostgresConsentRegistry } from "./consent-registry";
import { evaluateContactMemoryGatePersisted, type ContactMemoryWrite, type MemoryGatePolicy } from "./consent-memory-gate";

describe("durable consent enforcement against Postgres", () => {
  it("isolates tenants and denies memory after revoke or expiry under concurrent writes", async () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL is required for this integration test");
    const clientA = new pg.Client({ connectionString: databaseUrl });
    const clientB = new pg.Client({ connectionString: databaseUrl });
    await Promise.all([clientA.connect(), clientB.connect()]);
    const claims = JSON.stringify({ org_ids: ["org-a"] });
    await Promise.all([clientA.query("select set_config('request.jwt.claims',$1,false)", [claims]), clientB.query("select set_config('request.jwt.claims',$1,false)", [claims])]);
    const input = { consent_id: "consent-concurrent", organization_id: "org-a", subject_ref: "contact-1", purpose: "support", channel: "email" as const, source_refs: ["form-1"], evidence_refs: ["event-1"] };
    try {
      const [first, second] = await Promise.all([new PostgresConsentRegistry(clientA).register(input), new PostgresConsentRegistry(clientB).register(input)]);
      expect(first.status).toBe("GRANTED");
      expect(second.status).toBe("GRANTED");
      const role = await clientB.query<{ rolbypassrls: boolean }>("select rolbypassrls from pg_roles where rolname=current_user");
      expect(role.rows[0]?.rolbypassrls).toBe(false);
      await clientB.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ org_ids: ["org-b"] })]);
      expect(await new PostgresConsentRegistry(clientB).get("org-a", "consent-concurrent")).toBeUndefined();
      await expect(new PostgresConsentRegistry(clientB).revoke("org-a", "consent-concurrent")).rejects.toThrow("consent_not_found");
      const crossTenantUpdate = await clientB.query("update public.contact_consents set status='REVOKED' where organization_id=$1 and consent_id=$2", ["org-a", "consent-concurrent"]);
      expect(crossTenantUpdate.rowCount).toBe(0);
      const write: ContactMemoryWrite = { owner: "agent-1", scope: "company:org-a", authority: 3, organization_id: "org-a", subject_ref: "contact-1", channel: "email", purpose: "support" };
      const policy: MemoryGatePolicy = { owner: "agent-1", scope: "company:org-a", authority: 2 };
      const durable = new PostgresConsentRegistry(clientA);
      await expect(evaluateContactMemoryGatePersisted(write, policy, durable)).resolves.toBe("ALLOW");
      await durable.revoke("org-a", "consent-concurrent");
      await expect(evaluateContactMemoryGatePersisted(write, policy, durable)).resolves.toBe("DENY");
      await durable.register({ ...input, consent_id: "consent-expired", retention_until: "2000-01-01T00:00:00.000Z" });
      await expect(evaluateContactMemoryGatePersisted({ ...write, subject_ref: "contact-1" }, policy, durable)).resolves.toBe("DENY");
    } finally {
      await Promise.all([clientA.end(), clientB.end()]);
    }
  });
});
