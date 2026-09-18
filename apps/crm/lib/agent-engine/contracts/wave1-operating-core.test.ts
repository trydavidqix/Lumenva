import { describe, expect, it } from 'vitest';

import {
  AgentDefinitionSchema,
  AgentResponseSchema,
  assembleBehaviorContract,
  createDefaultAutonomyPolicy,
  createDefaultCommunicationContract,
  createDefaultAuthorityPolicy,
  createSessionState,
  parseAgentResponse,
  reduceState,
  replaySession,
  type AgentDefinition,
  type SessionEvent,
  type SessionSnapshot,
} from './wave1-operating-core';

const definition: AgentDefinition = {
  id: 'sales',
  version: '1.0.0',
  name: 'Sales',
  objective: 'qualify inbound leads',
  targetChannels: ['whatsapp'],
  capabilities: ['crm.lead.read'],
};

describe('Wave 1 operating core contracts', () => {
  it('validates a provider-free AgentDefinition and rejects model/provider fields', () => {
    expect(AgentDefinitionSchema.safeParse(definition).success).toBe(true);
    const invalid = AgentDefinitionSchema.safeParse({
      ...definition,
      runtime: { model: 'gemini' },
    });
    expect(invalid.success).toBe(false);
    if (!invalid.success) expect(invalid.error.issues[0]?.message).toBe('E_MODEL_IN_DEFINITION');
  });

  it('assembles behavior, authority, autonomy and communication contracts fail-closed', () => {
    const behavior = assembleBehaviorContract(definition);
    expect(behavior.channelSpecificBehavior.whatsapp).toEqual({
      avoidMarkdown: true,
      defaultSentencesMax: 3,
    });
    expect(createDefaultAuthorityPolicy().envelopes.BUILD.maxRiskWithoutGate).not.toBe('R4');
    expect(createDefaultAuthorityPolicy().persistenceNeverRaisesAuthority).toBe(true);
    expect(createDefaultAutonomyPolicy().level).toBe('AUTO_LOW_RISK');
    expect(createDefaultAutonomyPolicy().alwaysGate).toEqual([
      'external_communication',
      'sensitive_commercial',
      'destructive_admin',
      'credential_access',
      'policy_change',
      'production_deploy',
      'data_export',
    ]);
    expect(createDefaultCommunicationContract().emitKinds).toEqual(['STARTED', 'COMPLETE']);
    expect(createDefaultCommunicationContract().neverDumpInternalLogs).toBe(true);
  });

  it('parses AgentResponse and requires handoff_safe', () => {
    expect(parseAgentResponse({ status: 'completed', message: 'ok', handoff_safe: true })).toEqual({
      status: 'completed',
      message: 'ok',
      handoff_safe: true,
      state_updates: {},
      completed_actions: [],
      evidence_refs: [],
    });
    const malformed = AgentResponseSchema.safeParse({ status: 'completed', message: 'ok' });
    expect(malformed.success).toBe(false);
  });

  it('reduces allowed facts once and rejects locked model updates without evidence', () => {
    const state = createSessionState('session-1');
    const result = reduceState(state, {
      status: 'completed',
      message: 'done',
      handoff_safe: true,
      state_updates: { known_facts: { budget: '10k' }, locked_model: 'gemini' },
      completed_actions: [{ evidence_ref: 'missing' }],
      evidence_refs: [],
    });
    expect(result.state.knownFacts).toEqual({ budget: '10k' });
    expect(result.state.stateVersion).toBe(1);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.kind).toBe('fact.learned');
    expect(result.rejected).toEqual([
      { path: 'locked_model', code: 'E_PATH_NOT_WRITABLE' },
      { path: 'completed_actions', code: 'E_NO_EVIDENCE' },
    ]);
    expect(result.state.status).toBe('open');
  });

  it('replays a snapshot plus events deterministically', () => {
    const snapshot: SessionSnapshot = {
      sessionId: 'session-1',
      eventCount: 1,
      state: { ...createSessionState('session-1'), knownFacts: { name: 'Ana' }, stateVersion: 1 },
    };
    const events: SessionEvent[] = [{
      id: 'event-2',
      sessionId: 'session-1',
      kind: 'fact.learned',
      executionEpoch: 0,
      payload: { key: 'budget', value: '10k' },
      occurredAt: '2026-09-11T00:00:00.000Z',
    }];
    expect(replaySession(snapshot, events)).toEqual({
      ...snapshot.state,
      knownFacts: { name: 'Ana', budget: '10k' },
      stateVersion: 2,
    });
  });
});
