import { describe, expect, it, vi } from "vitest";
import type { AgentKernel } from "../../agent-engine/kernel/contracts";
import { createVoiceAgentOsAdapter } from "./agent-os-adapter";

const allowDelivery = async () => true;

describe("Voice Agent Bridge", () => {
  it("routes the transcript then invokes the canonical Agent Kernel", async () => {
    const kernel: AgentKernel = {
      run: vi.fn().mockResolvedValue({
        status: "completed",
        stopReason: "completed",
        runId: "run-1",
        traceId: "trace-1",
        correlationId: "corr-1",
        output: { draft: "Seu pedido chega sexta-feira." },
      }),
    };
    const resolveAgent = vi.fn().mockResolvedValue("atendimento");
    const adapter = createVoiceAgentOsAdapter({ kernel, resolveAgent, authorizeDelivery: allowDelivery });

    await expect(
      adapter.runTurn({
        organizationId: "org-a",
        contactId: "contact-a",
        voiceCallId: "call-a",
        transcript: "Onde está meu pedido?",
      }),
    ).resolves.toEqual({
      kind: "reply",
      text: "Seu pedido chega sexta-feira.",
      agentId: "atendimento",
      runId: "run-1",
      traceId: "trace-1",
    });

    expect(resolveAgent).toHaveBeenCalledWith({
      organizationId: "org-a",
      contactId: "contact-a",
      voiceCallId: "call-a",
      transcript: "Onde está meu pedido?",
    });
    expect(kernel.run).toHaveBeenCalledWith({
      organizationId: "org-a",
      agentId: "atendimento",
      goal: "Onde está meu pedido?",
      trigger: { kind: "voice_turn", sourceId: "contact-a", eventId: "call-a" },
      correlationId: "call-a",
    });
  });

  it("never speaks blocked or approval-waiting kernel results", async () => {
    const kernel: AgentKernel = {
      run: vi.fn().mockResolvedValue({
        status: "waiting_approval",
        stopReason: "human_approval_required",
        runId: "run-2",
        traceId: "trace-2",
        correlationId: "call-a",
        approvalId: "approval-1",
      }),
    };
    const adapter = createVoiceAgentOsAdapter({ kernel, resolveAgent: async () => "sales", authorizeDelivery: allowDelivery });

    await expect(
      adapter.runTurn({
        organizationId: "org-a",
        contactId: "contact-a",
        voiceCallId: "call-a",
        transcript: "Me dá 50% de desconto",
      }),
    ).resolves.toEqual({
      kind: "blocked",
      reason: "human_approval_required",
      agentId: "sales",
      runId: "run-2",
      traceId: "trace-2",
      approvalId: "approval-1",
    });
  });

  it("does not turn shadow/draft output into customer speech when delivery policy denies it", async () => {
    const kernel: AgentKernel = {
      run: vi.fn().mockResolvedValue({
        status: "completed",
        stopReason: "completed",
        runId: "run-shadow",
        traceId: "trace-shadow",
        correlationId: "call-a",
        output: { draft: "rascunho interno" },
      }),
    };
    const authorizeDelivery = vi.fn().mockResolvedValue(false);
    const adapter = createVoiceAgentOsAdapter({ kernel, resolveAgent: async () => "atendimento", authorizeDelivery });

    await expect(
      adapter.runTurn({
        organizationId: "org-a",
        contactId: "contact-a",
        voiceCallId: "call-a",
        transcript: "Olá",
      }),
    ).resolves.toEqual({
      kind: "blocked",
      reason: "voice_delivery_not_authorized",
      agentId: "atendimento",
      runId: "run-shadow",
      traceId: "trace-shadow",
    });
    expect(authorizeDelivery).toHaveBeenCalledWith({ organizationId: "org-a", agentId: "atendimento", channel: "voice" });
  });

  it("fails closed when the agent resolver cannot choose an agent", async () => {
    const kernel: AgentKernel = { run: vi.fn() };
    const adapter = createVoiceAgentOsAdapter({ kernel, resolveAgent: async () => null, authorizeDelivery: allowDelivery });

    await expect(
      adapter.runTurn({
        organizationId: "org-a",
        contactId: "contact-a",
        voiceCallId: "call-a",
        transcript: "Olá",
      }),
    ).resolves.toEqual({ kind: "blocked", reason: "voice_agent_unresolved" });
    expect(kernel.run).not.toHaveBeenCalled();
  });
});
