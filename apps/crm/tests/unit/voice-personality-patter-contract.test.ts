import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), "apps/crm", path), "utf8");

describe("voice personality ownership boundary", () => {
  it("keeps Patter media-only and delegates business reasoning to Agent OS", () => {
    const worker = read("workers/voice-worker/main.mjs");
    const adapter = read("lib/voice/runtime/agent-os-adapter.ts");
    const route = read("app/api/internal/voice/turn/route.ts");

    expect(worker).toContain("brain.runTurn");
    expect(worker).toContain('systemPrompt: "You are the Lumenva media shell. Business reasoning is provided externally."');
    expect(worker).not.toContain("runModelCall");
    expect(worker).not.toContain("customer_memory");
    expect(adapter).toContain("deps.kernel.run");
    expect(adapter).toContain("authorizeDelivery");
    expect(route).toContain("createVoiceTurnService");
  });

  it("requires canonical Product Agents to own provider-neutral conversation style", () => {
    const contracts = read("lib/agent-engine/contracts/agent-os.ts");
    const atendimento = read("lib/agent-engine/product-agents/atendimento.ts");
    const sales = read("lib/agent-engine/product-agents/sales.ts");
    const retention = read("lib/agent-engine/product-agents/retention.ts");

    expect(contracts).toContain("AgentConversationStyle");
    expect(contracts).toContain("conversationStyle");
    expect(atendimento).toContain("conversationStyle");
    expect(sales).toContain("conversationStyle");
    expect(retention).toContain("conversationStyle");
  });

  it("requires per-turn delivery metadata to stay in the canonical voice runtime", () => {
    const turnService = read("lib/voice/runtime/turn-service.ts");
    const kernelRuntime = read("lib/voice/runtime/kernel-runtime.ts");

    expect(turnService).toContain("VoiceDeliveryStyle");
    expect(turnService).toContain("resolveVoiceDeliveryStyle");
    expect(kernelRuntime).toContain("conversationStyle");
  });

  it("does not implement the new feature in the deprecated legacy AI runtime", () => {
    const legacy = read("lib/ai/runtime/agent.ts");
    expect(legacy).toContain("@deprecated");
    expect(legacy).not.toContain("VoiceDeliveryStyle");
    expect(legacy).not.toContain("AgentConversationStyle");
  });
});
