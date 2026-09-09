import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), "apps/crm", path), "utf8");

describe("Lumenva Voice Engine E2E architecture", () => {
  it("keeps Patter in the media worker and CRM/Agent OS as the brain", () => {
    const worker = read("workers/voice-worker/main.mjs");
    expect(worker).toContain('from "getpatter"');
    expect(worker).toContain("new Telnyx");
    expect(worker).toContain("persist: false");
    expect(worker).toContain("telemetry: false");
    expect(worker).toContain("brain.runTurn");
    expect(worker).not.toContain("runModelCall");
    expect(worker).not.toContain("executeTool");
  });

  it("resolves tenant from technical number before caller identity", () => {
    const context = read("lib/voice/runtime/context-service.ts");
    expect(context.indexOf("resolveOrganization")).toBeLessThan(context.indexOf("resolveCaller"));
    expect(read("lib/voice/identity/resolve-organization.ts")).toContain("voice_phone_numbers");
  });

  it("makes voice calls address the canonical Agent Kernel by server-owned call identity", () => {
    const route = read("app/api/internal/voice/turn/route.ts");
    expect(route).toContain("voice_call_id");
    expect(route).toContain("createVoiceProductionKernel");
    expect(route).toContain("createProductAgentVoiceDeliveryAuthorizer");
    expect(route).not.toContain("organization_id: parsed");
  });

  it("does not require LiveKit for normal AI calls", () => {
    const worker = read("workers/voice-worker/main.mjs").toLowerCase();
    expect(worker).not.toContain("livekit");
    const browser = read("lib/voice/human-browser/adapter.ts");
    expect(browser).toContain('kind: "disabled"');
  });

  it("keeps outbound dialing behind an authenticated worker control plane", () => {
    const control = read("workers/voice-worker/control-server.mjs");
    expect(control).toContain('"x-internal-secret"');
    expect(control).toContain('path !== "/v1/calls"');
    expect(control).toContain("voice_live_disabled");
    expect(control).toContain("phone.call");
  });
});
