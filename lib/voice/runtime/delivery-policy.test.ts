import { describe, expect, it } from "vitest";
import { createProductAgentVoiceDeliveryAuthorizer, isVoiceDeliveryAutonomyAllowed } from "./delivery-policy";

describe("voice delivery policy", () => {
  it("blocks off, shadow and draft from customer speech", () => {
    expect(isVoiceDeliveryAutonomyAllowed("off")).toBe(false);
    expect(isVoiceDeliveryAutonomyAllowed("shadow")).toBe(false);
    expect(isVoiceDeliveryAutonomyAllowed("draft")).toBe(false);
  });

  it("allows only governed delivery-capable autonomy levels", () => {
    expect(isVoiceDeliveryAutonomyAllowed("assisted")).toBe(true);
    expect(isVoiceDeliveryAutonomyAllowed("autopilot_low_risk")).toBe(true);
    expect(isVoiceDeliveryAutonomyAllowed("autopilot_expanded")).toBe(true);
  });

  it("currently blocks canonical product agents that remain in shadow", async () => {
    const authorize = createProductAgentVoiceDeliveryAuthorizer();
    await expect(authorize({ organizationId: "org-1", agentId: "atendimento" })).resolves.toBe(false);
    await expect(authorize({ organizationId: "org-1", agentId: "sales" })).resolves.toBe(false);
  });

  it("fails closed for unknown agent ids", async () => {
    const authorize = createProductAgentVoiceDeliveryAuthorizer();
    await expect(authorize({ organizationId: "org-1", agentId: "unknown" })).resolves.toBe(false);
  });
});
