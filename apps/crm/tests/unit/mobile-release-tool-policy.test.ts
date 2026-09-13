import { describe, expect, it } from "vitest";
import { createMobileReleaseToolDefinitions } from "@/lib/agent-engine/tools/mobile-release";
import { evaluateToolPolicy } from "@/lib/agent-engine/policies/engine";

describe("mobile release Agent OS tools", () => {
  it("classifies audits as read-only, autofix as reversible and submission as sensitive commercial", () => {
    const tools = new Map(createMobileReleaseToolDefinitions().map((tool) => [tool.id, tool]));
    expect(tools.get("mobile_compliance_audit")?.risk).toBe("r0_read");
    expect(tools.get("mobile_runtime_review")?.risk).toBe("r0_read");
    expect(tools.get("mobile_compliance_autofix")?.risk).toBe("r1_reversible_write");
    expect(tools.get("mobile_store_submit")?.risk).toBe("r3_sensitive_commercial");
  });

  it("requires explicit approval before store submission even at expanded autonomy", () => {
    const submit = createMobileReleaseToolDefinitions().find((tool) => tool.id === "mobile_store_submit")!;
    expect(evaluateToolPolicy({ organizationId: "org-1", agentId: "agent-1", autonomyLevel: "autopilot_expanded", tool: submit })).toEqual({ kind: "require_approval", reason: "sensitive_commercial_requires_approval", approvalType: "sensitive_commercial" });
  });
});
