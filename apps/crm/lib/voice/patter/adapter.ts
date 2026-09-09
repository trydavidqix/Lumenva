import type {
  VoiceEngine,
  VoiceEngineEvent,
  VoiceEngineSession,
  VoiceEngineStartInput,
  VoiceEngineTransferResult,
  VoiceTransferTarget,
} from "../engine/contracts";

export type PatterRuntimeEvent =
  | { kind: "speech_started"; at: string }
  | { kind: "transcript_partial" | "transcript_final"; at: string; text: string; confidence: number | null }
  | { kind: "playback_started" | "playback_finished" | "interrupted"; at: string }
  | { kind: "transfer_state"; at: string; state: "connecting" | "connected" | "failed"; reason?: string }
  | { kind: "ended"; at: string; reason: string }
  | { kind: "runtime_error"; at: string; code: string; retryable: boolean };

export interface PatterRuntimeSession {
  events(): AsyncIterable<PatterRuntimeEvent>;
  speak(text: string, options?: { interruptible?: boolean }): Promise<void>;
  interrupt(): Promise<void>;
  transfer(target: VoiceTransferTarget): Promise<VoiceEngineTransferResult>;
  end(reason: string): Promise<void>;
}

/**
 * Internal seam around the Patter SDK/process. Nothing outside
 * `lib/voice/patter/**` needs to know how Patter represents calls or media.
 */
export interface PatterRuntime {
  start(input: VoiceEngineStartInput): Promise<PatterRuntimeSession>;
}

function mapRuntimeEvent(event: PatterRuntimeEvent): VoiceEngineEvent {
  switch (event.kind) {
    case "speech_started":
      return { type: "speech_started", at: event.at };
    case "transcript_partial":
      return {
        type: "partial_transcript",
        at: event.at,
        text: event.text,
        confidence: event.confidence,
      };
    case "transcript_final":
      return {
        type: "final_transcript",
        at: event.at,
        text: event.text,
        confidence: event.confidence,
      };
    case "playback_started":
      return { type: "playback_started", at: event.at };
    case "playback_finished":
      return { type: "playback_finished", at: event.at };
    case "interrupted":
      return { type: "interrupted", at: event.at };
    case "transfer_state":
      return {
        type: "transfer_state",
        at: event.at,
        state: event.state,
        ...(event.reason !== undefined ? { reason: event.reason } : {}),
      };
    case "ended":
      return { type: "ended", at: event.at, reason: event.reason };
    case "runtime_error":
      return {
        type: "provider_error",
        at: event.at,
        code: event.code,
        retryable: event.retryable,
      };
  }
}

function wrapSession(runtimeSession: PatterRuntimeSession): VoiceEngineSession {
  return {
    async *events() {
      for await (const event of runtimeSession.events()) {
        yield mapRuntimeEvent(event);
      }
    },
    speak(text, options) {
      return runtimeSession.speak(text, options);
    },
    interrupt() {
      return runtimeSession.interrupt();
    },
    transfer(target) {
      return runtimeSession.transfer(target);
    },
    end(reason) {
      return runtimeSession.end(reason);
    },
  };
}

export function createPatterVoiceEngine(runtime: PatterRuntime): VoiceEngine {
  return {
    async startSession(input) {
      const runtimeSession = await runtime.start(input);
      return wrapSession(runtimeSession);
    },
  };
}
