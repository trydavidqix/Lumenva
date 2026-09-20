export interface OutcomeDefinition {
  id: string;
  name: string;
  description: string;
  targetMetrics?: Record<string, any>;
}

export interface ResultContract {
  id: string;
  outcomeDefinitionId: string;
  eligibilityRules: Record<string, any>;
  successRules: Record<string, any>;
  sla: Record<string, any>;
  billingMode: 'pay_per_result' | 'subscription' | 'fixed' | 'usage_based';
}
