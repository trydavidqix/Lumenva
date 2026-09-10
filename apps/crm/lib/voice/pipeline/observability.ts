import { logger, type LogContext } from "@/lib/logger";

export interface VoicePipelineMetrics {
  healthChecks: number;
  healthFailures: number;
  events: number;
  failures: number;
  lastStage: string | null;
}

export interface VoiceHealthResult {
  ok: boolean;
  checkedAt: string;
  code?: string;
}

export interface VoiceAdapterContract {
  health(): Promise<VoiceHealthResult>;
  send(event: { type: string; at: string }): Promise<void>;
}

export function createVoiceObservability() {
  const metrics: VoicePipelineMetrics = {
    healthChecks: 0,
    healthFailures: 0,
    events: 0,
    failures: 0,
    lastStage: null,
  };

  return {
    metrics(): VoicePipelineMetrics {
      return { ...metrics };
    },
    health(result: VoiceHealthResult): VoiceHealthResult {
      metrics.healthChecks += 1;
      if (!result.ok) metrics.healthFailures += 1;
      logger.info("voice.pipeline.health", { ok: result.ok, code: result.code });
      return result;
    },
    event(stage: string, context?: LogContext): void {
      metrics.events += 1;
      metrics.lastStage = stage;
      if (stage === "failed") metrics.failures += 1;
      logger.info("voice.pipeline.event", { stage, ...context });
    },
  };
}
