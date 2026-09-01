import { describe, expect, it } from 'vitest';

import {
  ATENDIMENTO_AGENT_DEFINITION,
  validateAtendimentoRecommendation,
} from '@/lib/agent-engine/product-agents/atendimento';
import {
  SALES_AGENT_DEFINITION,
  validateSalesRecommendation,
} from '@/lib/agent-engine/product-agents/sales';

describe('Atendimento product role', () => {
  it('starts in SHADOW and cannot send customer communications', () => {
    expect(ATENDIMENTO_AGENT_DEFINITION.id).toBe('atendimento');
    expect(ATENDIMENTO_AGENT_DEFINITION.version).toBe('1.0.0');
    expect(ATENDIMENTO_AGENT_DEFINITION.autonomyLevel).toBe('shadow');
    expect(ATENDIMENTO_AGENT_DEFINITION.allowedTools).toEqual([]);
    expect(ATENDIMENTO_AGENT_DEFINITION.requiredModelCapabilities).toContain('structured_output');
  });

  it('accepts recommendation-only customer drafts', () => {
    expect(validateAtendimentoRecommendation({
      kind: 'draft_response',
      draft: 'Posso ajudar com essa questão.',
      rationale: 'Uses authoritative CRM context.',
      needsHumanReview: true,
    })).toEqual({ ok: true });

    expect(validateAtendimentoRecommendation({
      kind: 'send_message',
      draft: 'send now',
      rationale: 'unsafe',
      needsHumanReview: false,
    })).toEqual({ ok: false, reason: 'invalid_kind' });
  });
});

describe('Sales product role', () => {
  it('starts in SHADOW without send or sensitive commercial tools', () => {
    expect(SALES_AGENT_DEFINITION.id).toBe('sales');
    expect(SALES_AGENT_DEFINITION.version).toBe('1.0.0');
    expect(SALES_AGENT_DEFINITION.autonomyLevel).toBe('shadow');
    expect(SALES_AGENT_DEFINITION.allowedTools).toEqual([]);
  });

  it('validates structured qualification recommendations only', () => {
    expect(validateSalesRecommendation({
      kind: 'sales_recommendation',
      qualification: 'hot',
      nextAction: 'Prepare a proposal draft for human review.',
      rationale: 'Lead explicitly requested pricing.',
      draftMessage: 'Draft only.',
    })).toEqual({ ok: true });

    expect(validateSalesRecommendation({
      kind: 'sales_recommendation',
      qualification: 'guaranteed_close',
      nextAction: 'Commit discount',
      rationale: 'unsafe',
    })).toEqual({ ok: false, reason: 'invalid_qualification' });
  });
});
