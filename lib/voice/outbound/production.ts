import type pg from "pg";

import { createVoiceAgentOsAdapter } from "../runtime/agent-os-adapter";
import { createProductAgentVoiceDeliveryAuthorizer } from "../runtime/delivery-policy";
import { createVoiceProductionKernel } from "../runtime/kernel-runtime";
import { createGovernedVoiceOutboundService } from "./service";

const E164 = /^\+[1-9]\d{6,14}$/;

export function createProductionVoiceOutboundService(db: pg.Pool, internalSecret: string) {
  const kernel = createVoiceProductionKernel(db);
  const authorizeDelivery = createProductAgentVoiceDeliveryAuthorizer();

  return createGovernedVoiceOutboundService({
    async resolveContactPhone(organizationId, contactId) {
      const { rows } = await db.query<{ phone_number: string | null }>(
        `select phone_number
           from contacts
          where organization_id = $1 and id = $2
          limit 1`,
        [organizationId, contactId],
      );
      const phone = rows[0]?.phone_number?.trim() ?? null;
      return phone && E164.test(phone) ? phone : null;
    },

    async resolveWorker(organizationId) {
      const { rows } = await db.query<{ control_url: string; phone_e164: string }>(
        `select vwe.control_url, vpn.phone_e164
           from voice_phone_numbers vpn
           join voice_worker_endpoints vwe on vwe.voice_phone_number_id = vpn.id
          where vpn.organization_id = $1
            and vpn.enabled = true
            and vwe.enabled = true
          order by vpn.created_at, vpn.id
          limit 2`,
        [organizationId],
      );
      // Until tenant routing explicitly selects a source number, multiple enabled
      // workers are ambiguous. Fail closed instead of choosing one implicitly.
      if (rows.length !== 1) return null;
      const row = rows[0]!;
      if (!E164.test(row.phone_e164)) return null;
      return { endpoint: row.control_url.replace(/\/$/, ""), phoneE164: row.phone_e164 };
    },

    async createCall(input) {
      const { rows } = await db.query<{ id: string }>(
        `insert into voice_calls
           (organization_id, contact_id, agent_id, direction, caller_number, called_number, state, provider)
         values ($1,$2,null,'outbound',$3,$4,'queued','telnyx')
         returning id`,
        [input.organizationId, input.contactId, input.fromE164, input.toE164],
      );
      const id = rows[0]?.id;
      if (!id) throw new Error("voice_call_create_failed");
      return id;
    },

    async generateOpening(input) {
      if (!(await authorizeDelivery({ organizationId: input.organizationId, agentId: input.agentId }))) {
        return { kind: "blocked" as const, reason: "voice_delivery_not_authorized" };
      }
      const adapter = createVoiceAgentOsAdapter({
        kernel,
        resolveAgent: async () => input.agentId,
        authorizeDelivery,
      });
      const result = await adapter.runTurn({
        organizationId: input.organizationId,
        contactId: input.contactId,
        voiceCallId: input.voiceCallId,
        transcript: input.goal,
      });
      return result.kind === "reply"
        ? { kind: "reply" as const, text: result.text }
        : { kind: "blocked" as const, reason: result.reason };
    },

    async dial(input) {
      const response = await fetch(`${input.endpoint}/v1/calls`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-secret": internalSecret,
        },
        body: JSON.stringify({
          voice_call_id: input.voiceCallId,
          to_e164: input.toE164,
          first_message: input.firstMessage,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`voice_worker_http_${response.status}`);
    },

    async markFailed(organizationId, voiceCallId, reason) {
      await db.query(
        `update voice_calls
            set state = 'failed', ended_at = coalesce(ended_at, now()), updated_at = now()
          where organization_id = $1 and id = $2`,
        [organizationId, voiceCallId],
      );
      await db.query(
        `insert into voice_call_events
           (organization_id, voice_call_id, provider, provider_event_id, event_type, payload, occurred_at)
         values ($1,$2,'lumenva',$3,'voice.outbound_blocked',$4::jsonb,now())
         on conflict (organization_id, provider, provider_event_id) do nothing`,
        [organizationId, voiceCallId, `${voiceCallId}:outbound_failed:${reason}`, JSON.stringify({ reason })],
      );
    },
  });
}
