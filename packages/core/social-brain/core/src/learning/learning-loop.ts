export interface ProposedChange {
  targetPolicy: string;
  currentValue: unknown;
  proposedValue: unknown;
  rationale: string;
}

export interface LearningCandidateMetrics {
  confidenceScore: number;
  impactPotential: 'low' | 'medium' | 'high';
}

export interface LearningCandidate {
  id: string;
  sourceType: 'post_performance' | 'audience_insight' | 'campaign_result' | string;
  sourceId: string;
  proposedChange: ProposedChange;
  metrics: LearningCandidateMetrics;
  status: 'pending' | 'approved' | 'rejected' | 'implemented';
  createdAt: Date;
}

export class LearningEngine {
  /**
   * Analyzes performance data and generates learning candidates.
   * This is a pure functional approach that does not mutate state or policies directly.
   */
  public generateCandidate(
    sourceType: string,
    sourceId: string,
    change: ProposedChange,
    metrics: LearningCandidateMetrics
  ): LearningCandidate {
    return {
      id: crypto.randomUUID(),
      sourceType,
      sourceId,
      proposedChange: change,
      metrics,
      status: 'pending',
      createdAt: new Date(),
    };
  }

  /**
   * Processes a batch of performance insights to yield potential learning candidates.
   * This is where the engine analyzes data (e.g. posting times) to suggest improvements.
   */
  public processInsights(insights: Array<{
    id: string;
    type: string;
    performanceDelta: number;
    metadata: Record<string, any>;
  }>): LearningCandidate[] {
    const candidates: LearningCandidate[] = [];

    for (const insight of insights) {
      // Minimalist example logic: if performance is significantly positive, generate a candidate
      if (insight.performanceDelta > 0.2) {
        candidates.push(
          this.generateCandidate(
            'post_performance',
            insight.id,
            {
              targetPolicy: 'posting_schedule',
              currentValue: insight.metadata.currentTime || '10:00',
              proposedValue: insight.metadata.optimalTime || '18:00',
              rationale: `Performance increased by ${insight.performanceDelta * 100}% compared to baseline.`,
            },
            {
              confidenceScore: Math.min(Math.round(insight.performanceDelta * 100) + 50, 99),
              impactPotential: insight.performanceDelta > 0.5 ? 'high' : 'medium',
            }
          )
        );
      }
    }

    return candidates;
  }
}
