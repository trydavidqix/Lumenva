import { describe, expect, it, vi } from "vitest";
import { createVoiceEngine } from "./factory";
import type { PatterRuntime } from "../patter/adapter";
import type { PipecatRuntime } from "../pipecat/adapter";

async function* noEvents() {}

describe("VoiceEngine factory", () => {
  it("selects the Patter-backed implementation behind the stable Lumenva interface", async () => {
    const runtime: PatterRuntime = {
      start: vi.fn().mockResolvedValue({
        events: () => noEvents(),
        speak: vi.fn(),
        interrupt: vi.fn(),
        transfer: vi.fn(),
        end: vi.fn(),
      }),
    };

    const engine = createVoiceEngine({ implementation: "patter" }, { patterRuntime: runtime });
    const session = await engine.startSession({
      organizationId: "org-a",
      voiceCallId: "call-a",
      contactId: null,
      direction: "inbound",
      locale: "pt-PT",
    });

    expect(runtime.start).toHaveBeenCalledWith({
      organizationId: "org-a",
      voiceCallId: "call-a",
      contactId: null,
      direction: "inbound",
      locale: "pt-PT",
    });
    expect(session).toBeDefined();
  });

  it("selects the Pipecat-backed implementation behind the same stable interface", async () => {
    const runtime: PipecatRuntime = {
      start: vi.fn().mockResolvedValue({
        events: () => noEvents(),
        speak: vi.fn(),
        interrupt: vi.fn(),
        transfer: vi.fn(),
        end: vi.fn(),
      }),
    };

    const engine = createVoiceEngine(
      { implementation: "pipecat" },
      { patterRuntime: {} as PatterRuntime, pipecatRuntime: runtime },
    );
    const session = await engine.startSession({
      organizationId: "org-a",
      voiceCallId: "call-a",
      contactId: null,
      direction: "inbound",
      locale: "pt-PT",
    });

    expect(runtime.start).toHaveBeenCalled();
    expect(session).toBeDefined();
  });

  it("fails closed when pipecat is selected without a pipecatRuntime", () => {
    expect(() =>
      createVoiceEngine({ implementation: "pipecat" }, { patterRuntime: {} as PatterRuntime }),
    ).toThrow(/pipecatRuntime is required/i);
  });

  it("fails closed for unknown engine implementations", () => {
    expect(() =>
      createVoiceEngine(
        { implementation: "unknown" as "patter" },
        { patterRuntime: {} as PatterRuntime },
      ),
    ).toThrow(/unknown voice engine/i);
  });
});
