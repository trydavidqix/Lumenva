import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../../../..");
if (!existsSync(join(root, "infra", "supabase", "baseline.sql"))) {
  throw new Error("Repository root not found");
}
const baseline = readFileSync(join(root, "infra", "supabase", "baseline.sql"), "utf8");

describe("F2 platform-admin function ACL", () => {
  it("does not expose the SECURITY DEFINER audit function to authenticated", () => {
    expect(baseline).toMatch(
      /revoke execute on function public\.record_platform_admin_tenant_access\(uuid, text\) from public, anon, authenticated;/,
    );
  });
});
