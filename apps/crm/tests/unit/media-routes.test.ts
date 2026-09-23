import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("Media routes auth client", () => {
  it("uses admin client in GET messages/[id]/media to avoid Supabase Auth dependency", () => {
    const source = read("app/api/v1/messages/[id]/media/route.ts");
    expect(source).not.toMatch(/const supabase = await createClient\(\);/);
    expect(source).toMatch(/const admin = createAdminClient\(\);/);
    expect(source).toMatch(/\.eq\("organization_id", activeOrg\.orgId\)/);
  });

  it("uses admin client in POST conversations/[id]/media to avoid Supabase Auth dependency", () => {
    const source = read("app/api/v1/conversations/[id]/media/route.ts");
    expect(source).not.toMatch(/const supabase = await createClient\(\);/);
    expect(source).toMatch(/const admin = createAdminClient\(\);/);
    expect(source).toMatch(/\.eq\("organization_id", activeOrg\.orgId\)/);
  });
});
