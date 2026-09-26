export type TaskIntent = 'sentiment' | 'complex_sales_reasoning' | 'coding' | 'general' | (string & {});

export type AIProvider = 'anthropic' | 'openai' | 'vertex-ai';

export interface AIRoute {
  provider: AIProvider;
  model: string;
}

export interface AITelemetryPayload {
  provider: AIProvider;
  model: string;
  latencyMs: number;
  tokenUsage: number;
  costEstimate: number;
  intent: TaskIntent;
  timestamp: string;
}

export class AIRouter {
  /**
   * Stub for BigQuery telemetry logging.
   */
  private async logTelemetry(payload: AITelemetryPayload): Promise<void> {
    // STUB: Insert BigQuery logging logic here
    // Example: BigQuery client insert into ai_telemetry dataset
    console.log('[Telemetry Stub] Logging to BigQuery:', payload);
  }

  /**
   * Determines the optimal model and provider for a given task intent.
   * Prefers cost/speed for simple intents, and high-reasoning models for complex intents.
   */
  route(intent: TaskIntent): AIRoute {
    switch (intent) {
      case 'sentiment':
        // Simple task: Optimize for speed and low cost
        return { provider: 'vertex-ai', model: 'gemini-1.5-flash' };
        
      case 'complex_sales_reasoning':
        // Complex reasoning task: Prioritize high-end reasoning (Claude 3 Opus)
        return { provider: 'anthropic', model: 'claude-3-opus-20240229' };
        
      case 'coding':
        // Complex logic/coding task: Prioritize high-end models (GPT-4)
        return { provider: 'openai', model: 'gpt-4o' };
        
      case 'general':
      default:
        // General tasks: Balanced approach (speed + acceptable reasoning)
        return { provider: 'openai', model: 'gpt-4o-mini' };
    }
  }
}
