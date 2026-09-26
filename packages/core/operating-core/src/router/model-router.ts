/**
 * Model Router
 * Determines appropriate model based on constraints and complexity,
 * and handles fallback execution.
 */

export interface ModelConstraints {
  maxCost?: number;
  speedPriority?: boolean;
}

export type SupportedModel = 'gpt-4' | 'claude-3-opus' | 'llama-3' | 'gpt-3.5-turbo';

export class ModelRouter {
  determineModel(complexity: 'low' | 'medium' | 'high', constraints?: ModelConstraints): SupportedModel {
    if (constraints?.speedPriority && complexity === 'low') {
      return 'gpt-3.5-turbo';
    }
    
    if (complexity === 'high') {
      return 'claude-3-opus';
    }
    
    return 'gpt-4';
  }

  async executeWithFallback<T>(
    primaryModel: SupportedModel,
    secondaryModel: SupportedModel,
    executeFn: (model: SupportedModel) => Promise<T>
  ): Promise<T> {
    try {
      return await executeFn(primaryModel);
    } catch (error) {
      console.warn(`Primary model ${primaryModel} failed. Falling back to ${secondaryModel}.`, error);
      return await executeFn(secondaryModel);
    }
  }
}
