import type { VoiceEngine } from "./contracts";
import { createPatterVoiceEngine, type PatterRuntime } from "../patter/adapter";
import { createPipecatVoiceEngine, type PipecatRuntime } from "../pipecat/adapter";

export type VoiceEngineConfig =
  | { implementation: "patter" }
  | { implementation: "pipecat" };

export interface VoiceEngineFactoryDeps {
  patterRuntime: PatterRuntime;
  /** Only required when config.implementation is "pipecat". */
  pipecatRuntime?: PipecatRuntime;
}

export function createVoiceEngine(
  config: VoiceEngineConfig,
  deps: VoiceEngineFactoryDeps,
): VoiceEngine {
  switch (config.implementation) {
    case "patter":
      return createPatterVoiceEngine(deps.patterRuntime);
    case "pipecat":
      if (!deps.pipecatRuntime) {
        throw new Error("[voice] pipecatRuntime is required for the pipecat implementation");
      }
      return createPipecatVoiceEngine(deps.pipecatRuntime);
    default: {
      const exhaustive: never = config;
      throw new Error(`unknown voice engine implementation: ${String((exhaustive as VoiceEngineConfig).implementation)}`);
    }
  }
}
