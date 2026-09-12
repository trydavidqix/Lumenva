import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { lgpdAnonymizeSchema } from "../../lib/schemas/contacts";

const read = (path: string) => readFileSync(path, "utf8");

describe("F5 LGPD anonymization contract", () => {
  it("validates UUID and justification without provider access", () => {
    expect(lgpdAnonymizeSchema.safeParse({
      contact_id: "00000000-0000-4000-8000-000000000001",
      justification: "Pedido formal do titular",
    }).success).toBe(true);
    expect(lgpdAnonymizeSchema.safeParse({
      contact_id: "not-a-uuid",
      justification: "Pedido formal do titular",
    }).success).toBe(false);
    expect(lgpdAnonymizeSchema.safeParse({
      contact_id: "00000000-0000-4000-8000-000000000001",
      justification: "curta",
    }).success).toBe(false);
  });

  it("keeps canonical route delegated to the existing atomic implementation", () => {
    const canonical = read("apps/crm/app/api/v1/lgpd/anonymize/route.ts");
    const implementation = read("apps/crm/app/api/v1/privacy/anonymize/route.ts");
    const cascade = read("apps/crm/lib/lgpd/redact-cascade.ts");
    expect(canonical).toMatch(/export \{ POST \} from "\.\.\/\.\.\/privacy\/anonymize\/route"/);
    expect(implementation).toMatch(/cascadeRedactContact/);
    expect(implementation).toMatch(/alreadyAnonymized/);
    expect(implementation).toMatch(/lgpd\.anonymize_executed/);
    expect(cascade).toMatch(/fn_lgpd_cascade_redact_contact/);
    expect(cascade).toMatch(/p_organization_id/);
    expect(cascade).toMatch(/p_contact_id/);
  });

  it("uses canonical hook and keeps anonymized contact actions blocked", () => {
    const hook = read("apps/crm/hooks/contacts/useAnonymizeContact.ts");
    const client = read("apps/crm/app/app/contacts/[id]/_client.tsx");
    expect(hook).toContain("/api/v1/lgpd/anonymize");
    expect(client).toMatch(/role="alert"/);
    expect(client).toMatch(/contact\.is_anonymized && \(/);
    expect(client).toMatch(/!contact\.is_anonymized && \(/);
    expect(client).toMatch(/edição bloqueada/);
    expect(client).toMatch(/Este contato já foi anonimizado/);
  });
});
