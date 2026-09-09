import { describe, expect, it } from "vitest";
import { createProductAgentVoiceDeliveryAuthorizer } from "./delivery-policy";

describe("voice delivery policy", () => {
  it("allows only the explicit conversational voice allowlist without changing global autonomy", async () => {
    const authorize = createProductAgentVoiceDeliveryAuthorizer();

    await expect(authorize({ organizationId: "org-1", agentId: "atendimento", channel: "voice" })).resolves.toBe(true);
    await expect(authorize({ organizationId: "org-1", agentId: "sales", channel: "voice" })).resolves.toBe(true);
    await expect(authorize({ organizationId: "org-1", agentId: "retention", channel: "voice" })).resolves.toBe(true);
    await expect(authorize({ organizationId: "org-1", agentId: "atendimento", channel: "default" })).resolves.toBe(false);
    await expect(authorize({ organizationId: "org-1", agentId: "supervisor", channel: "voice" })).resolves.toBe(false);
  });
});
