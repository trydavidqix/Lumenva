import { describe, expect, it } from 'vitest';

import { PRODUCT_AGENT_IDS } from '@/lib/agent-engine/product-agents/contracts';
import { PRODUCT_AGENT_GOLDEN_CASES } from '@/lib/agent-engine/product-agents/golden-cases';
import { validateAtendimentoRecommendation } from '@/lib/agent-engine/product-agents/atendimento';
import { validateSalesRecommendation } from '@/lib/agent-engine/product-agents/sales';
import { validateRetentionRecommendation } from '@/lib/agent-engine/product-agents/retention';
import { validateEscalationDecision } from '@/lib/agent-engine/product-agents/escalation';
import { validateCrmMutationProposal } from '@/lib/agent-engine/product-agents/crm-operator';
import { validateGovernanceJudgement } from '@/lib/agent-engine/product-agents/governance-judge';

describe('Phase 3 product golden cases', () => {
  it('covers every product role and every Supervisor specialist target', () => {
    const coveredAgents = new Set(PRODUCT_AGENT_GOLDEN_CASES.map((entry) => entry.agentId));
    expect(coveredAgents).toEqual(new Set(PRODUCT_AGENT_IDS));

    const supervisorTargets = new Set(
      PRODUCT_AGENT_GOLDEN_CASES
        .filter((entry) => entry.agentId === 'supervisor')
        .map((entry) => entry.expected)
        .filter((expected): expected is Record<string, unknown> => Boolean(expected && typeof expected === 'object'))
        .map((expected) => expected.targetAgent),
    );

    expect(supervisorTargets).toEqual(new Set([
      'atendimento',
      'sales',
      'retention',
      'escalation',
      'crm_operator',
      'governance_judge',
    ]));
  });

  it('contains a fail-closed Supervisor fallback golden case', () => {
    const fallback = PRODUCT_AGENT_GOLDEN_CASES.find((entry) => entry.id === 'supervisor-ambiguous-fallback');
    expect(fallback?.expected).toEqual({
      targetAgent: 'escalation',
      reason: 'supervisor_output_invalid',
      confidence: 0,
      requiresHumanEscalation: true,
    });
  });

  it('keeps specialist golden outputs inside their typed product contracts', () => {
    const byId = new Map(PRODUCT_AGENT_GOLDEN_CASES.map((entry) => [entry.id, entry.expected]));

    expect(validateAtendimentoRecommendation(byId.get('atendimento-draft-support'))).toEqual({ ok: true });
    expect(validateSalesRecommendation(byId.get('sales-qualified-lead'))).toEqual({ ok: true });
    expect(validateRetentionRecommendation(byId.get('retention-high-risk'))).toEqual({ ok: true });
    expect(validateEscalationDecision(byId.get('escalation-policy-review'))).toEqual({ ok: true });
    expect(validateCrmMutationProposal(byId.get('crm-operator-note-proposal'))).toEqual({ ok: true });
    expect(validateGovernanceJudgement(byId.get('governance-golden-pass'))).toEqual({ ok: true });
  });
});
