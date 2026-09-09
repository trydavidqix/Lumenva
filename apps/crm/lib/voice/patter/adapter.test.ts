import { describe, expect, it, vi } from "vitest";
import type { VoiceEngineEvent } from "../engine/contracts";
import {
  createPatterVoiceEngine,
  type PatterRuntime,
  type PatterRuntimeEvent,
} from "./adapter";

async function* events(items: PatterRuntimeEvent[]) {
  for (const item of items) yield item;
}

describe("Patter-backed VoiceEngine adapter", () => {
  it("maps Patter runtime events into Lumenva events without leaking provider types", async () => {
    const runtime: PatterRuntime = {
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

    const engine = createPatterVoiceEngine(runtime);
    const session = await engine.startSession({
      organizationId: "org-a",
      voiceCallId: "call-a",
      contactId: null,
      direction: "inbound",
      locale: "pt-PT",
    });

    const received: VoiceEngineEvent[] = [];
    for await (const event of session.events()) received.push(event);

    expect(received).toEqual([
      { type: "final_transcript", text: "olá", confidence: 0.94, at: "2026-08-27T00:00:00Z" },
      { type: "provider_error", code: "stt_unavailable", retryable: true, at: "2026-08-27T00:00:01Z" },
    ]);
  });

  it("delegates media operations but never exposes LLM or tool methods", async () => {
    const speak = vi.fn();
    const interrupt = vi.fn();
    const transfer = vi.fn().mockResolvedValue({ status: "transferred", humanParticipantId: "human-1" });
    const end = vi.fn();
    const runtime: PatterRuntime = {
      start: vi.fn().mockResolvedValue({ events: () => events([]), speak, interrupt, transfer, end }),
    };
    const session = await createPatterVoiceEngine(runtime).startSession({
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
