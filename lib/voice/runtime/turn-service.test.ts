import { describe, expect, it, vi } from "vitest";
import type { AgentKernel } from "../../agent-engine/kernel/contracts";
import { createVoiceTurnService } from "./turn-service";

describe("voice turn service", () => {
  it("blocks before supervisor/model work when no conversational agent may speak", async () => {
    const kernel: AgentKernel = { run: vi.fn() };
    const service = createVoiceTurnService({
      kernel,
      authorizeDelivery: async () => false,
    });
    await expect(service.run({ organizationId: "org-1", contactId: null, voiceCallId: "call-1", transcript: "Olá" }))
      .resolves.toEqual({ kind: "blocked", reason: "voice_delivery_not_authorized" });
    expect(kernel.run).not.toHaveBeenCalled();
  });

  it("uses the canonical supervisor and bridge once delivery is promoted", async () => {
    const kernel: AgentKernel = {
      run: vi.fn()
        .mockResolvedValueOnce({
          status: "completed", stopReason: "completed", runId: "supervisor-run", traceId: "t1", correlationId: "call-1",
          output: { targetAgent: "atendimento", reason: "support", confidence: 0.9, requiresHumanEscalation: false },
        })
        .mockResolvedValueOnce({
          status: "completed", stopReason: "completed", runId: "agent-run", traceId: "t2", correlationId: "call-1",
          output: { kind: "draft_response", draft: "Olá!", rationale: "safe", needsHumanReview: false },
        }),
    };
    const service = createVoiceTurnService({ kernel, authorizeDelivery: async ({ agentId }) => agentId === "atendimento" });
    await expect(service.run({ organizationId: "org-1", contactId: "contact-1", voiceCallId: "call-1", transcript: "Olá" }))
      .resolves.toMatchObject({ kind: "reply", text: "Olá!", agentId: "atendimento" });
    expect(kernel.run).toHaveBeenCalledTimes(2);
  });
});
