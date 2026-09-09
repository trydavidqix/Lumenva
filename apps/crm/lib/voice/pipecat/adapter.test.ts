import { describe, expect, it, vi } from "vitest";
import type { VoiceEngineEvent } from "../engine/contracts";
import {
  createPipecatVoiceEngine,
  type PipecatRuntime,
  type PipecatRuntimeEvent,
} from "./adapter";

async function* events(items: PipecatRuntimeEvent[]) {
  for (const item of items) yield item;
}

describe("Pipecat-backed VoiceEngine adapter", () => {
  it("maps Pipecat runtime events into Lumenva events without leaking provider types", async () => {
    const runtime: PipecatRuntime = {
      start: vi.fn().mockResolvedValue({
        events: () => events([
          { kind: "transcript_final", text: "olá", confidence: 0.94, at: "2026-08-27T00:00:00Z" },
          { kind: "runtime_error", code: "stt_unavailable", retryable: true, at: "2026-08-27T00:00:01Z" },
        ]),
        speak: vi.fn(),
        interrupt: vi.fn(),
        transfer: vi.fn(),
        end: vi.fn(),
      }),
    };

    const engine = createPipecatVoiceEngine(runtime);
    const session = await engine.startSession({
      organizationId: "org-a",
      voiceCallId: "call-a",
      contactId: null,
      direction: "inbound",
      locale: "pt-PT",
      voiceProfile: {
        mode: "preset",
        locale: "pt-PT",
        gender: "female",
        voiceId: "nina-pt-pt",
        provider: "piper",
      },
    });

    const received: VoiceEngineEvent[] = [];
    for await (const event of session.events()) received.push(event);

    expect(received).toEqual([
      { type: "final_transcript", text: "olá", confidence: 0.94, at: "2026-08-27T00:00:00Z" },
      { type: "provider_error", code: "stt_unavailable", retryable: true, at: "2026-08-27T00:00:01Z" },
    ]);
  });

  it("forwards the voice profile to the runtime without the engine interpreting it", async () => {
    const start = vi.fn().mockResolvedValue({
      events: () => events([]),
      speak: vi.fn(),
      interrupt: vi.fn(),
      transfer: vi.fn(),
      end: vi.fn(),
    });
    const runtime: PipecatRuntime = { start };

    await createPipecatVoiceEngine(runtime).startSession({
      organizationId: "org-a",
      voiceCallId: "call-a",
      contactId: "contact-a",
      direction: "outbound",
      locale: "pt-PT",
      voiceProfile: {
        mode: "cloned",
        locale: "pt-PT",
        gender: "male",
        voiceId: "cliente-x-voz",
        provider: "openvoice",
        cloneProfileId: "clone-123",
      },
    });

    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({
        voiceProfile: expect.objectContaining({ mode: "cloned", cloneProfileId: "clone-123" }),
      }),
    );
  });

  it("delegates media operations but never exposes LLM or tool methods", async () => {
    const speak = vi.fn();
    const interrupt = vi.fn();
    const transfer = vi.fn().mockResolvedValue({ status: "transferred", humanParticipantId: "human-1" });
    const end = vi.fn();
    const runtime: PipecatRuntime = {
      start: vi.fn().mockResolvedValue({ events: () => events([]), speak, interrupt, transfer, end }),
    };
    const session = await createPipecatVoiceEngine(runtime).startSession({
      organizationId: "org-a",
      voiceCallId: "call-a",
      contactId: "contact-a",
      direction: "outbound",
      locale: "pt-PT",
    });

    await session.speak("bom dia", { interruptible: true });
    await session.interrupt();
    await session.transfer({ destination: "+351210000000" });
    await session.end("completed");

    expect(speak).toHaveBeenCalledWith("bom dia", { interruptible: true });
    expect(interrupt).toHaveBeenCalledTimes(1);
    expect(transfer).toHaveBeenCalledWith({ destination: "+351210000000" });
    expect(end).toHaveBeenCalledWith("completed");
    expect("runModel" in session).toBe(false);
    expect("executeTool" in session).toBe(false);
  });
});
