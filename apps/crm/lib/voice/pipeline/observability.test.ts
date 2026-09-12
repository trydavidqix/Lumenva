import { describe, expect, it, vi } from "vitest";

import { logger } from "@/lib/logger";
import { evaluateVoicePipeline, transitionVoicePipeline, type VoicePipelineSnapshot } from "./contracts";
import { createVoiceObservability, type VoiceAdapterContract } from "./observability";

describe("voice pipeline observability", () => {
  it("smoke vertical encadeia health → adapter contract → pipeline", async () => {
    const observation = createVoiceObservability();
    const adapter: VoiceAdapterContract = {
      health: vi.fn(async () => observation.health({ ok: true, checkedAt: "t1" })),
      send: vi.fn(async () => undefined),
    };
    const health = await adapter.health();
    expect(evaluateVoicePipeline({ enabled: true }, health)).toBe("ready");
    await adapter.send({ type: "session_started", at: "t2" });
    let state: VoicePipelineSnapshot = { stage: "idle", lastEventAt: null };
    state = transitionVoicePipeline(state, { type: "session_started", at: "t2" });
    observation.event(state.stage, { call_id: "fixture-call" });
    state = transitionVoicePipeline(state, { type: "response_ready", at: "t3", text: "fixture" });
    observation.event(state.stage, { call_id: "fixture-call" });
    expect(state.stage).toBe("speaking");
    expect(observation.metrics()).toMatchObject({ healthChecks: 1, events: 2, lastStage: "speaking" });
  });

  it("regista métricas de falha sem emitir conteúdo de voz", () => {
    const info = vi.spyOn(logger, "info").mockImplementation(() => undefined);
    const observation = createVoiceObservability();
    observation.health({ ok: false, checkedAt: "t1", code: "health_off" });
    observation.event("failed", { call_id: "fixture-call", error_code: "adapter_unavailable" });
    expect(observation.metrics()).toMatchObject({ healthChecks: 1, healthFailures: 1, failures: 1 });
    expect(JSON.stringify(info.mock.calls)).not.toContain("audio");
    info.mockRestore();
  });
});
