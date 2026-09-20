export interface BriefMetrics {
  new_leads: number;
  active_conversations: number;
  campaign_spend: number;
  campaign_roi: number;
}

export interface RecommendedAction {
  id: string;
  type: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

export interface AttentionNeeded {
  id: string;
  reason: string;
  severity: 'critical' | 'warning' | 'info';
}

export interface MorningBrief {
  organization_id: string;
  date: string;
  metrics: BriefMetrics;
  attention_needed: AttentionNeeded[];
  recommended_actions: RecommendedAction[];
}
