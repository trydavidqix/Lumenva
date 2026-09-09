import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { PRODUCT_AGENT_IDS } from '@/lib/agent-engine/product-agents/contracts';
import {
  PRODUCT_AGENT_DEFINITIONS,
  getProductAgentDefinition,
} from '@/lib/agent-engine/product-agents/definitions';

describe('Phase 3 product agent registry', () => {
  it('contains exactly one versioned SHADOW definition per stable product role', () => {
    expect(PRODUCT_AGENT_DEFINITIONS.size).toBe(PRODUCT_AGENT_IDS.length);

    for (const id of PRODUCT_AGENT_IDS) {
      const definition = getProductAgentDefinition(id);
      expect(definition).not.toBeNull();
      expect(definition?.id).toBe(id);
      expect(definition?.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(definition?.autonomyLevel).toBe('shadow');
      expect(definition?.requiredModelCapabilities).toContain('structured_output');
    }
  });

  it('fails closed for unknown role lookup', () => {
    expect(getProductAgentDefinition('unknown_agent')).toBeNull();
  });

  it('keeps product role modules provider-agnostic', () => {
    const files = [
      'contracts.ts',
      'supervisor.ts',
      'atendimento.ts',
      'sales.ts',
      'retention.ts',
      'escalation.ts',
      'crm-operator.ts',
      'governance-judge.ts',
      'definitions.ts',
      'resolver.ts',
      'verification.ts',
      'golden-cases.ts',
      'index.ts',
    ];

    for (const file of files) {
      const source = readFileSync(join(process.cwd(), 'lib/agent-engine/product-agents', file), 'utf8');
      expect(source).not.toMatch(/@ai-sdk\//);
      expect(source).not.toMatch(/from ['"]openai['"]/);
      expect(source).not.toMatch(/from ['"]@anthropic-ai\/sdk['"]/);
      expect(source).not.toMatch(/GoogleGenerativeAI/);
      expect(source).not.toMatch(/createClient\(/);
      expect(source).not.toMatch(/service_role/);
    }
  });
});
