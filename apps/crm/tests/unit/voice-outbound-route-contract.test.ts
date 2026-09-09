import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = () => readFileSync(join(process.cwd(), "apps/crm/app/api/v1/voice/calls/route.ts"), "utf8");

describe("governed outbound voice route", () => {
  it("requires manager role and derives tenant from authenticated organization", () => {
    const code = source();
    expect(code).toContain('requireRole("manager"');
    expect(code).toContain("authz.org.orgId");
  });

  it("accepts only contact, product agent and goal — never raw number or first message", () => {
    const code = source();
    expect(code).toContain("contact_id");
    expect(code).toContain("agent_id");
    expect(code).toContain("goal");
    expect(code).not.toContain("to_e164");
    expect(code).not.toContain("first_message");
    expect(code).not.toContain("control_url");
  });

  it("uses the governed production outbound service rather than calling the worker directly", () => {
    const code = source();
    expect(code).toContain("createProductionVoiceOutboundService");
    expect(code).not.toContain("fetch(");
  });
});
