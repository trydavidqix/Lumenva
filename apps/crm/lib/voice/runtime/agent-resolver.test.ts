import { describe, expect, it, vi } from "vitest";
import type { AgentKernel } from "../../agent-engine/kernel/contracts";
import { createSupervisorVoiceAgentResolver } from "./agent-resolver";

describe("voice product-agent resolver", () => {
  it("uses the existing supervisor and returns its governed target", async () => {
    const kernel: AgentKernel = {
      run: vi.fn().mockResolvedValue({
        status: "completed",
        stopReason: "completed",
        runId: "route-1",
        traceId: "trace-route-1",
        correlationId: "call-a",
        output: {
          targetAgent: "sales",
          reason: "commercial_intent",
          confidence: 0.92,
          requiresHumanEscalation: false,
        },
      }),
    };
    const resolve = createSupervisorVoiceAgentResolver(kernel);

    await expect(resolve({
      organizationId: "org-a",
      contactId: "contact-a",
      voiceCallId: "call-a",
      transcript: "Quero comprar o plano anual",
    })).resolves.toBe("sales");

    expect(kernel.run).toHaveBeenCalledWith({
      organizationId: "org-a",
      agentId: "supervisor",
      goal: "Quero comprar o plano anual",
      trigger: { kind: "voice_routing", sourceId: "contact-a", eventId: "call-a" },
      correlationId: "call-a",
    });
  });

  it("fails safely to escalation when supervisor output is invalid", async () => {
    const kernel: AgentKernel = {
      run: vi.fn().mockResolvedValue({
        status: "completed",
        stopReason: "completed",
        runId: "route-2",
        traceId: "trace-route-2",
        correlationId: "call-a",
        output: { nonsense: true },
      }),
    };
    const resolve = createSupervisorVoiceAgentResolver(kernel);
    await expect(resolve({
      organizationId: "org-a",
      contactId: "contact-a",
      voiceCallId: "call-a",
      transcript: "Preciso de ajuda",
    })).resolves.toBe("escalation");
  });

  it("returns null if supervisor itself cannot complete", async () => {
    const kernel: AgentKernel = {
      run: vi.fn().mockResolvedValue({
        status: "blocked",
        stopReason: "model_unavailable",
        runId: "route-3",
        traceId: "trace-route-3",
        correlationId: "call-a",
      }),
    };
    const resolve = createSupervisorVoiceAgentResolver(kernel);
    await expect(resolve({
      organizationId: "org-a",
      contactId: "contact-a",
      voiceCallId: "call-a",
      transcript: "Olá",
    })).resolves.toBeNull();
  });
});
