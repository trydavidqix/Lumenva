import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

let root = process.cwd();
while (!existsSync(join(root, "supabase", "baseline.sql"))) {
  const parent = join(root, "..");
  if (parent === root) throw new Error("Repository root not found");
  root = parent;
}
const baseline = readFileSync(join(root, "supabase", "baseline.sql"), "utf8");

describe("F2 platform-admin function ACL", () => {
  it("does not expose the SECURITY DEFINER audit function to authenticated", () => {
    expect(baseline).toMatch(
      /revoke execute on function public\.record_platform_admin_tenant_access\(uuid, text\) from public, anon, authenticated;/,
    );
  });
});
