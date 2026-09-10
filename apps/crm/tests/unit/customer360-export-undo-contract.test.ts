import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const read = (path: string) => readFileSync(path, "utf8");
describe("Customer 360 export and merge loser contract", () => {
  it("exports audit data with tenant scope and CSV attachment", () => {
    const source = read("apps/crm/app/api/v1/audit/export/route.ts");
    expect(source).toMatch(/\.eq\("organization_id", activeOrg\.orgId\)/);
    expect(source).toMatch(/Content-Disposition/);
    expect(source).toMatch(/text\/csv/);
  });
  it("returns 410 and redirects merged losers to the canonical contact", () => {
    const source = read("apps/crm/app/api/v1/contacts/[id]/route.ts");
    expect(source).toMatch(/result\.is_merged_into/);
    expect(source).toMatch(/\b410\b/);
    expect(source).toMatch(/Location:.*result\.is_merged_into/);
  });
  it("keeps merge resolution provider-free and delegated to the transactional RPC", () => {
    const source = read("apps/crm/app/api/v1/merge_queue/[id]/resolve/route.ts");
    expect(source).toMatch(/supabase\.rpc\("merge_contacts"/);
    expect(source).toMatch(/p_queue_id/);
  });
});
