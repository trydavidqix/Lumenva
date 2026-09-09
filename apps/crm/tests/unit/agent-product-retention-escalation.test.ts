import { describe, expect, it } from 'vitest';

import {
  RETENTION_AGENT_DEFINITION,
  validateRetentionRecommendation,
} from '@/lib/agent-engine/product-agents/retention';
import {
  ESCALATION_AGENT_DEFINITION,
  validateEscalationDecision,
} from '@/lib/agent-engine/product-agents/escalation';

describe('Retention product role', () => {
  it('starts in SHADOW and remains recommendation-only', () => {
    expect(RETENTION_AGENT_DEFINITION.id).toBe('retention');
    expect(RETENTION_AGENT_DEFINITION.autonomyLevel).toBe('shadow');
    expect(RETENTION_AGENT_DEFINITION.allowedTools).toEqual([]);
  });

  it('validates bounded retention risk and action', () => {
    expect(validateRetentionRecommendation({
      kind: 'retention_recommendation',
      risk: 'high',
      action: 'Ask a human to review a recovery offer.',
      rationale: 'Recent cancellation signal.',
    })).toEqual({ ok: true });

    expect(validateRetentionRecommendation({
      kind: 'retention_recommendation',
      risk: 'certain_churn',
      action: 'Auto-discount',
      rationale: 'unsafe',
    })).toEqual({ ok: false, reason: 'invalid_risk' });
  });
});

describe('Escalation product role', () => {
  it('starts in SHADOW with no side-effect tools', () => {
    expect(ESCALATION_AGENT_DEFINITION.id).toBe('escalation');
    expect(ESCALATION_AGENT_DEFINITION.autonomyLevel).toBe('shadow');
    expect(ESCALATION_AGENT_DEFINITION.allowedTools).toEqual([]);
  });

  it('requires an explicit human escalation decision', () => {
    expect(validateEscalationDecision({
      kind: 'human_escalation',
      reason: 'Policy or confidence requires human review.',
      priority: 'high',
      requiredContext: ['lead_id', 'conversation_id'],
    })).toEqual({ ok: true });

    expect(validateEscalationDecision({
      kind: 'auto_resolve',
      reason: 'skip human',
      priority: 'high',
      requiredContext: [],
    })).toEqual({ ok: false, reason: 'invalid_kind' });
  });
});
