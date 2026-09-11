import { describe, expect, it } from "vitest";
import { isBaselineCovered } from "../../scripts/migration-policy.mjs";

describe("migration baseline selection", () => {
  it("covers timestamp-prefixed migrations without a sequence suffix", () => {
    expect(isBaselineCovered("20260814082914_content_os_foundation.sql")).toBe(true);
  });

  it("covers explicit historical sequence and leaves new migrations executable", () => {
    expect(isBaselineCovered("20260907120000_0160_ai_agent_command_approvals.sql")).toBe(true);
    expect(isBaselineCovered("20260911100000_0161_entitlements_catalog.sql")).toBe(false);
  });
});
