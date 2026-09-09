import { describe, expect, it } from 'vitest';

import {
  PHASE_4_GOLDEN_DATASET_VERSION,
  getGoldenCasesForAgent,
  getPhase4GoldenCases,
} from '@/lib/agent-engine/evals/datasets';
import { PRODUCT_AGENT_IDS } from '@/lib/agent-engine/product-agents/contracts';

function serialize(value: unknown): string {
  return JSON.stringify(value).toLowerCase();
}

describe('Phase 4 golden eval datasets', () => {
  it('uses a stable Phase 4 dataset version', () => {
    expect(PHASE_4_GOLDEN_DATASET_VERSION).toBe('4.0.0');
  });

  it('contains at least one case for every Product Agent', () => {
    const cases = getPhase4GoldenCases();

    for (const agentId of PRODUCT_AGENT_IDS) {
      expect(getGoldenCasesForAgent(agentId).length, agentId).toBeGreaterThan(0);
      expect(cases.some((item) => item.agentId === agentId), agentId).toBe(true);
    }
  });

  it('covers every Supervisor specialist route plus ambiguous fallback', () => {
    const supervisorCases = getGoldenCasesForAgent('supervisor');
    const serialized = serialize(supervisorCases);

    for (const target of [
      'atendimento',
      'sales',
      'retention',
      'escalation',
      'crm_operator',
      'governance_judge',
    ]) {
      expect(serialized).toContain(target);
    }

    expect(supervisorCases.some((item) => item.tags.includes('ambiguous'))).toBe(true);
  });

  it('includes the required adversarial security tags', () => {
    const tags = new Set(getPhase4GoldenCases().flatMap((item) => item.tags));

    for (const tag of [
      'prompt_injection',
      'cross_tenant',
      'credential_request',
      'destructive_request',
    ]) {
      expect(tags.has(tag), tag).toBe(true);
    }
  });

  it('includes the required failure-mode tags', () => {
    const tags = new Set(getPhase4GoldenCases().flatMap((item) => item.tags));

    for (const tag of [
      'provider_failure',
      'malformed_output',
      'repeated_loop',
      'budget_exhaustion',
    ]) {
      expect(tags.has(tag), tag).toBe(true);
    }
  });

  it('keeps repository fixtures sanitized from obvious raw phone and email fields', () => {
    for (const item of getPhase4GoldenCases()) {
      const payload = serialize({ input: item.input, expected: item.expected });
      expect(payload).not.toMatch(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
      expect(payload).not.toMatch(/(?:\+?\d[\s().-]*){9,}/);
      expect(Object.keys(item.input).map((key) => key.toLowerCase())).not.toContain('email');
      expect(Object.keys(item.input).map((key) => key.toLowerCase())).not.toContain('phone');
    }
  });

  it('has unique case IDs and stamps every case with the stable dataset version', () => {
    const cases = getPhase4GoldenCases();
    expect(new Set(cases.map((item) => item.id)).size).toBe(cases.length);
    expect(cases.every((item) => item.version === PHASE_4_GOLDEN_DATASET_VERSION)).toBe(true);
  });
});
