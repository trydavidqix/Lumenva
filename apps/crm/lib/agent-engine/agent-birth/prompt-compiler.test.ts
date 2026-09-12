import { describe, expect, it } from "vitest";

import { compileSystemPrompt } from "./prompt-compiler";
import type { AgentDefinition } from "./agent-definition";

const certifiedDefinition: AgentDefinition = {
  id: "sales",
  version: "1.0.0",
  status: "CERTIFIED",
  identity: "Sales agent for the tenant CRM.",
  mission: "Qualify inbound opportunities and prepare a next step.",
  boundaries: ["No external send without approval.", "No cross-tenant access."],
  authority: "P0-P2 within the assigned tenant and approved tools.",
  escalation: "Escalate policy, safety, scope or approval uncertainty to a human reviewer.",
};

describe("minimum prompt compiler", () => {
  it("formats all certified birth fields in canonical order", () => {
    const prompt = compileSystemPrompt(certifiedDefinition);

    expect(prompt).toBe(
      [
        "# IDENTITY",
        "Sales agent for the tenant CRM.",
        "# MISSION",
        "Qualify inbound opportunities and prepare a next step.",
        "# BOUNDARIES",
        "- No external send without approval.\n- No cross-tenant access.",
        "# AUTHORITY",
        "P0-P2 within the assigned tenant and approved tools.",
        "# ESCALATION",
        "Escalate policy, safety, scope or approval uncertainty to a human reviewer.",
      ].join("\n\n"),
    );
  });

  it("rejects a SHADOW definition before compiling a prompt", () => {
    const shadow = { ...certifiedDefinition, status: "SHADOW" as const };

    expect(() => compileSystemPrompt(shadow)).toThrow("agent_definition_not_certified");
  });

  it("does not mutate the certified definition while compiling", () => {
    const input = {
      ...certifiedDefinition,
      boundaries: [...certifiedDefinition.boundaries],
    };
    const before = structuredClone(input);

    compileSystemPrompt(input);

    expect(input).toEqual(before);
  });
});
