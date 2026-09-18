import { z } from 'zod';

const FORBIDDEN_DEFINITION_KEYS = new Set([
  'model',
  'provider',
  'providerId',
  'apiKey',
  'credential',
  'secret',
  'endpoint',
]);

function findForbiddenDefinitionKey(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findForbiddenDefinitionKey(item);
      if (found) return found;
    }
    return undefined;
  }
  if (!value || typeof value !== 'object') return undefined;
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_DEFINITION_KEYS.has(key)) return key;
    const found = findForbiddenDefinitionKey(nested);
    if (found) return found;
  }
  return undefined;
}

const TARGET_CHANNELS = ['whatsapp', 'web', 'email', 'voice', 'internal'] as const;

export const AgentDefinitionSchema = z
  .object({
    id: z.string().min(1),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    name: z.string().min(1),
    objective: z.string().min(1),
    targetChannels: z.array(z.enum(TARGET_CHANNELS)).min(1),
    capabilities: z.array(z.string().min(1)),
  })
  .passthrough()
  .superRefine((value, context) => {
    const forbidden = findForbiddenDefinitionKey(value);
    if (forbidden === 'model') {
      context.addIssue({ code: 'custom', message: 'E_MODEL_IN_DEFINITION' });
    } else if (forbidden) {
      context.addIssue({ code: 'custom', message: 'E_PROVIDER_IN_DEFINITION' });
    }
  });

export type AgentDefinition = z.infer<typeof AgentDefinitionSchema>;

export interface BehaviorContract {
  channelSpecificBehavior: Record<string, {
    avoidMarkdown: boolean;
    defaultSentencesMax: number;
  }>;
}

export function assembleBehaviorContract(definition: Pick<AgentDefinition, 'targetChannels'>): BehaviorContract {
  return {
    channelSpecificBehavior: Object.fromEntries(
      definition.targetChannels.map((channel) => [channel, {
        avoidMarkdown: channel === 'whatsapp',
        defaultSentencesMax: channel === 'whatsapp' ? 3 : 5,
      }]),
    ),
  };
}

export type AuthorityAction = 'READ' | 'BUILD' | 'CHANGE' | 'DEPLOY' | 'EXPORT';
export type AuthorityRisk = 'R0' | 'R1' | 'R2' | 'R3' | 'R4';

export interface AuthorityEnvelope {
  action: AuthorityAction;
  maxRiskWithoutGate: Exclude<AuthorityRisk, 'R4'>;
  requiresApproval: boolean;
}

export interface AuthorityPolicy {
  envelopes: Record<AuthorityAction, AuthorityEnvelope>;
  persistenceNeverRaisesAuthority: true;
}

export function createDefaultAuthorityPolicy(): AuthorityPolicy {
  return {
    envelopes: {
      READ: { action: 'READ', maxRiskWithoutGate: 'R0', requiresApproval: false },
      BUILD: { action: 'BUILD', maxRiskWithoutGate: 'R1', requiresApproval: false },
      CHANGE: { action: 'CHANGE', maxRiskWithoutGate: 'R1', requiresApproval: true },
      DEPLOY: { action: 'DEPLOY', maxRiskWithoutGate: 'R0', requiresApproval: true },
      EXPORT: { action: 'EXPORT', maxRiskWithoutGate: 'R0', requiresApproval: true },
    },
    persistenceNeverRaisesAuthority: true,
  };
}

export type AutonomyLevel = 'OFF' | 'SHADOW' | 'DRAFT' | 'ASSISTED' | 'AUTO_LOW_RISK';

const ALWAYS_GATE = [
  'external_communication',
  'sensitive_commercial',
  'destructive_admin',
  'credential_access',
  'policy_change',
  'production_deploy',
  'data_export',
] as const;

export interface AutonomyPolicy {
  level: AutonomyLevel;
  alwaysGate: readonly (typeof ALWAYS_GATE)[number][];
  approvalId?: string;
}

export function createDefaultAutonomyPolicy(): AutonomyPolicy {
  return { level: 'AUTO_LOW_RISK', alwaysGate: [...ALWAYS_GATE] };
}

export interface CommunicationContract {
  emitKinds: readonly ['STARTED', 'COMPLETE'];
  neverDumpInternalLogs: true;
  escalationChannel: 'human';
}

export function createDefaultCommunicationContract(): CommunicationContract {
  return {
    emitKinds: ['STARTED', 'COMPLETE'],
    neverDumpInternalLogs: true,
    escalationChannel: 'human',
  };
}

const AgentResponseStateUpdateSchema = z.record(z.string(), z.unknown());

export const AgentResponseSchema = z.object({
  status: z.enum(['completed', 'blocked', 'waiting']),
  message: z.string(),
  handoff_safe: z.boolean(),
  state_updates: AgentResponseStateUpdateSchema.default({}),
  completed_actions: z.array(z.object({ evidence_ref: z.string().min(1) })).default([]),
  evidence_refs: z.array(z.string().min(1)).default([]),
});

export type AgentResponse = z.infer<typeof AgentResponseSchema>;

export function parseAgentResponse(value: unknown): AgentResponse {
  return AgentResponseSchema.parse(value);
}

export type SessionStatus = 'open' | 'blocked' | 'completed';

export interface SessionState {
  sessionId: string;
  status: SessionStatus;
  stateVersion: number;
  executionEpoch: number;
  knownFacts: Record<string, unknown>;
}

export type SessionEventKind = 'fact.learned' | 'session.completed' | 'session.blocked';

export interface SessionEvent {
  id: string;
  sessionId: string;
  kind: SessionEventKind;
  executionEpoch: number;
  payload: Record<string, unknown>;
  occurredAt: string;
}

export interface SessionSnapshot {
  sessionId: string;
  eventCount: number;
  state: SessionState;
}

export function createSessionState(sessionId: string): SessionState {
  return {
    sessionId,
    status: 'open',
    stateVersion: 0,
    executionEpoch: 0,
    knownFacts: {},
  };
}

export interface StateReducerResult {
  state: SessionState;
  events: SessionEvent[];
  rejected: Array<{ path: string; code: 'E_PATH_NOT_WRITABLE' | 'E_NO_EVIDENCE' }>;
}

export function reduceState(state: SessionState, input: unknown): StateReducerResult {
  const response = AgentResponseSchema.parse(input);
  const nextFacts = { ...state.knownFacts };
  const events: SessionEvent[] = [];
  const rejected: StateReducerResult['rejected'] = [];
  const now = '1970-01-01T00:00:00.000Z';
  const updates = response.state_updates;

  const knownFacts = updates.known_facts;
  if (knownFacts && typeof knownFacts === 'object' && !Array.isArray(knownFacts)) {
    for (const [key, value] of Object.entries(knownFacts)) {
      nextFacts[key] = value;
      events.push({
        id: `fact-${state.stateVersion + 1}-${key}`,
        sessionId: state.sessionId,
        kind: 'fact.learned',
        executionEpoch: state.executionEpoch,
        payload: { key, value },
        occurredAt: now,
      });
    }
  }

  if ('locked_model' in updates) {
    rejected.push({ path: 'locked_model', code: 'E_PATH_NOT_WRITABLE' });
  }

  const evidence = new Set(response.evidence_refs);
  const hasMissingEvidence = response.completed_actions.some((action) => !evidence.has(action.evidence_ref));
  if (hasMissingEvidence) rejected.push({ path: 'completed_actions', code: 'E_NO_EVIDENCE' });

  const canComplete = response.status === 'completed' && !hasMissingEvidence;
  if (canComplete) {
    events.push({
      id: `session-completed-${state.stateVersion + 1}`,
      sessionId: state.sessionId,
      kind: 'session.completed',
      executionEpoch: state.executionEpoch,
      payload: {},
      occurredAt: now,
    });
  }

  return {
    state: {
      ...state,
      status: canComplete ? 'completed' : response.status === 'blocked' ? 'blocked' : state.status,
      stateVersion: state.stateVersion + 1,
      knownFacts: nextFacts,
    },
    events,
    rejected,
  };
}

export function replaySession(snapshot: SessionSnapshot, events: readonly SessionEvent[]): SessionState {
  const state = { ...snapshot.state, knownFacts: { ...snapshot.state.knownFacts } };
  for (const event of events) {
    if (event.sessionId !== snapshot.sessionId) continue;
    if (event.kind === 'fact.learned') {
      const key = event.payload.key;
      if (typeof key === 'string') state.knownFacts[key] = event.payload.value;
    } else if (event.kind === 'session.completed') {
      state.status = 'completed';
    } else if (event.kind === 'session.blocked') {
      state.status = 'blocked';
    }
    state.stateVersion += 1;
  }
  return state;
}
