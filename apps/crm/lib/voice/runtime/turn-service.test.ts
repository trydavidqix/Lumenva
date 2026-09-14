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
          output: { kind: "draft_response", draft: "Olá! Como posso ajudar?", rationale: "safe", needsHumanReview: false },
        }),
    };
    const service = createVoiceTurnService({ kernel, authorizeDelivery: async ({ agentId }) => agentId === "atendimento" });
    await expect(service.run({ organizationId: "org-1", contactId: "contact-1", voiceCallId: "call-1", transcript: "Olá" }))
      .resolves.toMatchObject({ kind: "reply", text: "Olá! Como posso ajudar?", agentId: "atendimento" });
    expect(kernel.run).toHaveBeenCalledTimes(2);
  });

  it("attaches emotional delivery metadata without rewriting Agent OS text", async () => {
    const kernel: AgentKernel = {
      run: vi.fn()
        .mockResolvedValueOnce({
          status: "completed", stopReason: "completed", runId: "supervisor-run", traceId: "t1", correlationId: "call-1",
          output: { targetAgent: "atendimento", reason: "support", confidence: 0.99, requiresHumanEscalation: false },
        })
        .mockResolvedValueOnce({
          status: "completed", stopReason: "completed", runId: "agent-run", traceId: "t2", correlationId: "call-1",
          conversationStyle: {
            register: "warm",
            toneInstructions: "Be warm, patient and calm.",
          },
          output: { kind: "draft_response", draft: "Entendi. Quer que eu verifique?", rationale: "safe", needsHumanReview: false },
        }),
    };
    const service = createVoiceTurnService({ kernel, authorizeDelivery: async ({ agentId }) => agentId === "atendimento" });

    await expect(service.run({
      organizationId: "org-1",
      contactId: "contact-1",
      voiceCallId: "call-1",
      transcript: "Estou frustrado, isto é um problema.",
    })).resolves.toMatchObject({
      kind: "reply",
      text: "Entendi. Quer que eu verifique?",
      agentId: "atendimento",
      delivery: { affect: "empathetic", pace: "slow", energy: 0.35, tone: "warm" },
    });
  });

  it("uses the exact conversation style carried by the executed AgentDefinition", async () => {
    const kernel: AgentKernel = {
      run: vi.fn()
        .mockResolvedValueOnce({
          status: "completed", stopReason: "completed", runId: "supervisor-run", traceId: "t1", correlationId: "call-1",
          output: { targetAgent: "atendimento", reason: "support", confidence: 0.99, requiresHumanEscalation: false },
        })
        .mockResolvedValueOnce({
          status: "completed", stopReason: "completed", runId: "agent-run", traceId: "t2", correlationId: "call-1",
          conversationStyle: {
            register: "professional",
            toneInstructions: "Be formal and emotionally steady.",
          },
          output: { kind: "draft_response", draft: "Entendi. Quer que eu verifique?", rationale: "safe", needsHumanReview: false },
        }),
    };
    const service = createVoiceTurnService({ kernel, authorizeDelivery: async ({ agentId }) => agentId === "atendimento" });

    await expect(service.run({
      organizationId: "org-1",
      contactId: "contact-1",
      voiceCallId: "call-1",
      transcript: "Estou frustrado, isto é um problema.",
    })).resolves.toMatchObject({
      kind: "reply",
      delivery: { affect: "calm", pace: "slow", energy: 0.3, tone: "serious" },
    });
  });

  it("blocks when voice humanization removes the entire speakable reply", async () => {
    const kernel: AgentKernel = {
      run: vi.fn()
        .mockResolvedValueOnce({
          status: "completed", stopReason: "completed", runId: "supervisor-run", traceId: "t1", correlationId: "call-1",
          output: { targetAgent: "atendimento", reason: "support", confidence: 1, requiresHumanEscalation: false },
        })
        .mockResolvedValueOnce({
          status: "completed", stopReason: "completed", runId: "agent-run", traceId: "t2", correlationId: "call-1",
          conversationStyle: { register: "warm", toneInstructions: "Be warm." },
          output: { kind: "draft_response", draft: "Ótima pergunta!", rationale: "safe", needsHumanReview: false },
        }),
    };
    const service = createVoiceTurnService({ kernel, authorizeDelivery: async ({ agentId }) => agentId === "atendimento" });

    await expect(service.run({ organizationId: "org-1", contactId: "contact-1", voiceCallId: "call-1", transcript: "Olá" }))
      .resolves.toMatchObject({ kind: "blocked", reason: "voice_agent_output_not_speakable", agentId: "atendimento" });
  });

  it("fails closed when Agent OS returns a voice-format violation", async () => {
    const kernel: AgentKernel = {
      run: vi.fn()
        .mockResolvedValueOnce({
          status: "completed", stopReason: "completed", runId: "supervisor-run", traceId: "t1", correlationId: "call-1",
          output: { targetAgent: "atendimento", reason: "support", confidence: 1, requiresHumanEscalation: false },
        })
        .mockResolvedValueOnce({
          status: "completed", stopReason: "completed", runId: "agent-run", traceId: "t2", correlationId: "call-1",
          conversationStyle: { register: "warm", toneInstructions: "Be warm." },
          output: { kind: "draft_response", draft: "O valor é 50€. Quer continuar?", rationale: "safe", needsHumanReview: false },
        }),
    };
    const service = createVoiceTurnService({ kernel, authorizeDelivery: async ({ agentId }) => agentId === "atendimento" });

    await expect(service.run({ organizationId: "org-1", contactId: "contact-1", voiceCallId: "call-1", transcript: "Qual é o valor?" }))
      .resolves.toMatchObject({ kind: "blocked", reason: "voice_output_unspoken_value", agentId: "atendimento" });
  });

  it.each([
    ["atendimento", { kind: "draft_response", draft: "Posso ajudar?", rationale: "support", needsHumanReview: false }],
    ["sales", { kind: "sales_recommendation", qualification: "warm", nextAction: "contactar", rationale: "sales", draftMessage: "Quer que eu explique?" }],
    ["retention", { kind: "retention_recommendation", risk: "low", action: "acompanhar", rationale: "retention" }],
  ] as const)("preserves the supervisor-selected role exactly for %s", async (targetAgent, output) => {
    const kernel: AgentKernel = {
      run: vi.fn()
        .mockResolvedValueOnce({
          status: "completed", stopReason: "completed", runId: "supervisor-run", traceId: "t1", correlationId: "call-1",
          output: { targetAgent, reason: "explicit test route", confidence: 1, requiresHumanEscalation: false },
        })
        .mockResolvedValueOnce({
          status: "completed", stopReason: "completed", runId: "agent-run", traceId: "t2", correlationId: "call-1", output,
        }),
    };
    const service = createVoiceTurnService({
      kernel,
      authorizeDelivery: async ({ agentId, channel }) => channel === "voice" && ["atendimento", "sales", "retention"].includes(agentId),
    });

    await service.run({ organizationId: "org-1", contactId: "contact-1", voiceCallId: "call-1", transcript: "teste" });

    expect(kernel.run).toHaveBeenNthCalledWith(2, expect.objectContaining({ agentId: targetAgent }));
  });
});
