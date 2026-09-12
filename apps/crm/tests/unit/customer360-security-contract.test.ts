import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const read = (path: string) => readFileSync(path, "utf8");
describe("Customer 360 PII security contract", () => {
  it("keeps contact queries tenant-scoped and CPF decrypt role-gated", () => {
    const handler = read("apps/crm/app/api/v1/contacts/_handler.ts");
    expect(handler).toMatch(/eq\("organization_id", ctx\.organization_id\)/);
    expect(handler).toMatch(/ROLE_RANK\.manager/);
    expect(handler).toMatch(/decrypt_cpf/);
  });
  it("does not expose plaintext CPF through MCP contact tools", () => {
    const tool = read("apps/crm/lib/mcp/tools/contacts.ts");
    expect(tool).toMatch(/CPF nunca retornado em plaintext/);
    expect(tool).not.toMatch(/cpf_decrypted|cpf_encrypted/);
  });
  it("keeps merge UI read-only until manager endpoint exists", () => {
    const dialog = read("apps/crm/components/contacts/MergeDialog.tsx");
    expect(dialog).toMatch(/read-only scaffolding/);
    expect(dialog).toMatch(/disabled/);
  });
});
