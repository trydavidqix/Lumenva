import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

function repoRoot(): string {
  const cwd = process.cwd();
  if (existsSync(join(cwd, "apps", "crm")) && existsSync(join(cwd, "workers", "voice-worker"))) return cwd;
  const parent = resolve(cwd, "../..");
  if (existsSync(join(parent, "apps", "crm")) && existsSync(join(parent, "workers", "voice-worker"))) return parent;
  throw new Error(`repository root not found from ${cwd}`);
}

const readCrm = (path: string) => readFileSync(join(repoRoot(), "apps/crm", path), "utf8");
const readRepo = (path: string) => readFileSync(join(repoRoot(), path), "utf8");

describe("voice personality ownership boundary", () => {
  it("keeps Patter media-only and delegates business reasoning to Agent OS", () => {
    const worker = readRepo("workers/voice-worker/main.mjs");
    const adapter = readCrm("lib/voice/runtime/agent-os-adapter.ts");
    const route = readCrm("app/api/internal/voice/turn/route.ts");

    expect(worker).toContain("brain.runTurn");
    expect(worker).toContain('systemPrompt: "You are the Lumenva media shell. Business reasoning is provided externally."');
    expect(worker).not.toContain("runModelCall");
    expect(worker).not.toContain("customer_memory");
    expect(worker).not.toContain("currentEmotion");
    expect(worker).not.toContain("voiceSettings =");
    expect(adapter).toContain("deps.kernel.run");
    expect(adapter).toContain("authorizeDelivery");
    expect(route).toContain("createVoiceTurnService");
    expect(route).toContain("return ok(result");
  });

  it("keeps provider-neutral conversation style beside canonical Product Agents", () => {
    const styles = readCrm("lib/agent-engine/product-agents/conversation-style.ts");
    expect(styles).toContain("AgentConversationStyle");
    expect(styles).toContain("atendimento");
    expect(styles).toContain("sales");
    expect(styles).toContain("retention");
    expect(styles).not.toContain("getpatter");
    expect(styles).not.toContain("ElevenLabs");
  });

  it("keeps per-turn delivery metadata in the canonical voice runtime", () => {
    const turnService = readCrm("lib/voice/runtime/turn-service.ts");
    const kernelRuntime = readCrm("lib/voice/runtime/kernel-runtime.ts");
    const worker = readRepo("workers/voice-worker/main.mjs");

    expect(turnService).toContain("VoiceDeliveryStyle");
    expect(turnService).toContain("resolveVoiceDeliveryStyle");
    expect(turnService).toContain("classifySentiment");
    expect(turnService).toContain("prepareSpeakableVoiceText");
    expect(kernelRuntime).toContain("getProductAgentConversationStyle");
    expect(kernelRuntime).toContain("Conversation style affects wording and tone only");
    expect(worker).toContain("normalizeVoiceDeliveryForLog(result.delivery)");
    expect(worker).toContain("return result.text.trim()");
  });

  it("does not implement the new feature in the deprecated legacy AI runtime", () => {
    const legacy = readCrm("lib/ai/runtime/agent.ts");
    expect(legacy).toContain("@deprecated");
    expect(legacy).not.toContain("VoiceDeliveryStyle");
    expect(legacy).not.toContain("AgentConversationStyle");
  });
});
