import type { VoiceCallDirection, VoiceCallState, VoiceProvider } from "./contracts";

export interface VoiceQueryable {
  query<T = Record<string, unknown>>(sql: string, params: unknown[]): Promise<{ rows: T[] }>;
}

export interface CreateVoiceCallInput {
  id: string;
  organizationId: string;
  contactId: string | null;
  agentId: string | null;
  conversationId: string | null;
  direction: VoiceCallDirection;
  callerNumber: string;
  calledNumber: string;
  state: VoiceCallState;
  provider: VoiceProvider;
  providerCallId: string | null;
}

export type VoiceProviderEventAttribute = string | number | boolean | null;

export interface AppendVoiceProviderEventInput {
  organizationId: string;
  voiceCallId: string;
  provider: VoiceProvider;
  providerEventId: string;
  eventType: string;
  attributes: Record<string, VoiceProviderEventAttribute>;
  occurredAt: string;
}

export function createVoiceRepository(db: VoiceQueryable) {
  return {
    async createCall(input: CreateVoiceCallInput): Promise<string> {
      const { rows } = await db.query<{ id: string }>(
        `insert into voice_calls (
           id, organization_id, contact_id, agent_id, conversation_id,
           direction, caller_number, called_number, state, provider, provider_call_id
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         returning id`,
        [
          input.id,
          input.organizationId,
          input.contactId,
          input.agentId,
          input.conversationId,
          input.direction,
          input.callerNumber,
          input.calledNumber,
          input.state,
          input.provider,
          input.providerCallId,
        ],
      );
      const id = rows[0]?.id;
      if (!id) throw new Error("[voice] createCall did not return an id");
      return id;
    },

    async updateState(organizationId: string, voiceCallId: string, state: VoiceCallState): Promise<void> {
      await db.query(
        `update voice_calls
            set state = $3, updated_at = now()
          where organization_id = $1 and id = $2`,
        [organizationId, voiceCallId, state],
      );
    },

    async appendProviderEvent(input: AppendVoiceProviderEventInput): Promise<boolean> {
      const { rows } = await db.query<{ id: string }>(
        `insert into voice_call_events (
           organization_id, voice_call_id, provider, provider_event_id,
           event_type, attributes, occurred_at
         ) values ($1,$2,$3,$4,$5,$6::jsonb,$7::timestamptz)
         on conflict (organization_id, provider, provider_event_id) do nothing
         returning id`,
        [
          input.organizationId,
          input.voiceCallId,
          input.provider,
          input.providerEventId,
          input.eventType,
          JSON.stringify(input.attributes),
          input.occurredAt,
        ],
      );
      return rows.length > 0;
    },
  };
}
