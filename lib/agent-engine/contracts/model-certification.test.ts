import { describe, expect, it } from 'vitest';

import {
  filterCertifiedModels,
  type CertifiedModelMetadata,
  type ModelCapability,
} from '../models/certification';

const caps = (...values: ModelCapability[]): ModelCapability[] => values;

const models: CertifiedModelMetadata[] = [
  {
    provider: 'openai',
    model: 'gpt-tool',
    certification: 'CERTIFIED',
    capabilities: caps('tool_calling', 'structured_output', 'streaming'),
    qualityScore: 90,
    costScore: 50,
  },
  {
    provider: 'anthropic',
    model: 'claude-vision',
    certification: 'CERTIFIED',
    capabilities: caps('vision', 'reasoning', 'long_context'),
    qualityScore: 95,
    costScore: 40,
  },
  {
    provider: 'openai',
    model: 'gpt-exp',
    certification: 'EXPERIMENTAL',
    capabilities: caps('tool_calling', 'structured_output'),
    qualityScore: 99,
    costScore: 99,
  },
  {
    provider: 'other',
    model: 'disabled',
    certification: 'DISABLED',
    capabilities: caps('tool_calling', 'structured_output', 'vision'),
    qualityScore: 100,
    costScore: 100,
  },
];

describe('Agent OS model certification registry', () => {
  it('filtra por certificação e capability antes de ranking', () => {
    const result = filterCertifiedModels(models, {
      requiredCapabilities: ['tool_calling', 'structured_output'],
    });

    expect(result.map((m) => m.model)).toEqual(['gpt-tool']);
  });

  it('rejeita modelo certificado que não tem capability necessária', () => {
    const result = filterCertifiedModels(models, {
      requiredCapabilities: ['vision', 'tool_calling'],
    });

    expect(result).toEqual([]);
  });

  it('nunca retorna EXPERIMENTAL ou DISABLED para routing certificado', () => {
    const result = filterCertifiedModels(models, { requiredCapabilities: [] });

    expect(result.every((m) => m.certification === 'CERTIFIED')).toBe(true);
    expect(result.map((m) => m.model)).not.toContain('gpt-exp');
    expect(result.map((m) => m.model)).not.toContain('disabled');
  });
});
