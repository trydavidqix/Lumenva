import { describe, expect, it } from 'vitest';

import { InMemoryJobEngine } from '../../../../../packages/operating-core/src/job-engine.js';
import {
  AgentDefinitionSchema,
  InMemoryAgentVersionStore,
  type AgentDefinition,
} from './wave1-operating-core';

const definition: AgentDefinition = {
  id: 'support',
  version: '1.0.0',
  name: 'Support',
  objective: 'resolve customer questions',
  targetChannels: ['web'],
  capabilities: ['crm.contact.read'],
};

describe('Wave 1 acceptance contracts', () => {
  it('proves the provider-free job lifecycle emits every canonical event', () => {
    let id = 0;
    const engine = new InMemoryJobEngine({ id: () => `id-${id++}`, now: () => '2026-09-11T00:00:00.000Z' });
    const queued = engine.enqueue({ organizationId: 'org-a', kind: 'acceptance', payload: { deterministic: true } });
    expect(queued.status).toBe('queued');
    engine.claim(queued.id, 'worker-a', 'org-a');
    engine.start(queued.id, 'worker-a', 'org-a');
    engine.complete(queued.id, 'worker-a', 'org-a');
    const evidence = engine.recordEvidence(queued.id, { kind: 'acceptance', ref: 'evidence-1' }, 'org-a');

    expect(evidence.job.status).toBe('evidence');
    expect(engine.listEvents('org-a').map((event) => event.type)).toEqual([
      'job.queued',
      'job.claimed',
      'job.running',
      'job.completed',
      'job.evidence',
    ]);
  });

  it('validates an AgentDefinition and stores a reproducible draft version', () => {
    expect(AgentDefinitionSchema.safeParse(definition).success).toBe(true);
    const store = new InMemoryAgentVersionStore();
    const result = store.validateAndStore(definition);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.errors.join(','));
    expect(store.get('support', '1.0.0')).toMatchObject({ status: 'draft', definition: { id: 'support' } });
    expect(store.get('support', '1.0.0')?.definitionHash).toBe(result.definitionHash);
    expect(store.validateStored('support', '1.0.0')).toEqual(result);
  });

  it('does not store definitions containing a model field', () => {
    const store = new InMemoryAgentVersionStore();
    const result = store.validateAndStore({ ...definition, runtime: { model: 'not-selected' } });
    expect(result).toEqual({ ok: false, errors: ['E_MODEL_IN_DEFINITION'] });
    expect(store.get('support', '1.0.0')).toBeUndefined();
  });
});
