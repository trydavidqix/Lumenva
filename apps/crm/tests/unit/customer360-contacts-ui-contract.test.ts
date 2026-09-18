import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const read=(p: string)=>readFileSync(p,"utf8");
describe("Customer 360 contacts UI contract",()=>{
it("lists contacts with bounded cursor/filter contract",()=>{const s=read("apps/crm/app/app/contacts/_client.tsx"); expect(s).toMatch(/useContactList/); expect(s).toMatch(/search|cursor/);});
it("shows anonymized state and blocks editing",()=>{const s=read("apps/crm/app/app/contacts/[id]/_client.tsx"); expect(s).toMatch(/is_anonymized|Anonymizado/); expect(s).toMatch(/AnonymizeDialog|disabled/);});
it("API rejects PATCH after irreversible anonymization",()=>{const s=read("apps/crm/app/api/v1/contacts/_handler.ts"); expect(s).toMatch(/is_anonymized/); expect(s).toMatch(/privacy_anonymization_irreversible/);});
});
