import type { VoiceEngine } from "./contracts";
import { createPatterVoiceEngine, type PatterRuntime } from "../patter/adapter";

export interface VoiceEngineConfig {
  implementation: "patter";
}

export interface VoiceEngineFactoryDeps {
  patterRuntime: PatterRuntime;
}

export function createVoiceEngine(
  config: VoiceEngineConfig,
  deps: VoiceEngineFactoryDeps,
): VoiceEngine {
  switch (config.implementation) {
    case "patter":
      return createPatterVoiceEngine(deps.patterRuntime);
    default: {
      const exhaustive: never = config.implementation;
      throw new Error(`unknown voice engine implementation: ${String(exhaustive)}`);
    }
  }
}
