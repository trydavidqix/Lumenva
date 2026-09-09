import type { VoiceSessionState } from "./session";

export interface CancelableTtsPlayback {
  cancel(): Promise<void>;
}

export async function handleBargeIn(
  state: VoiceSessionState,
  playback: CancelableTtsPlayback,
): Promise<VoiceSessionState> {
  if (state.phase !== "speaking") return state;
  await playback.cancel();
  return { ...state, phase: "listening" };
}
