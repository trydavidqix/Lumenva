/**
 * Cost Estimator
 * Calculates rough costs based on token usage and model pricing.
 */

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
}

export interface ModelPricing {
  pricePer1kPrompt: number;
  pricePer1kCompletion: number;
}

export class CostEstimator {
  calculateCost(usage: TokenUsage, pricing: ModelPricing): number {
    const promptCost = (usage.promptTokens / 1000) * pricing.pricePer1kPrompt;
    const completionCost = (usage.completionTokens / 1000) * pricing.pricePer1kCompletion;
    
    return promptCost + completionCost;
  }
}
