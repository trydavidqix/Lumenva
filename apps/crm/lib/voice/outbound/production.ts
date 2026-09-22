import type pg from "pg";

import { createVoiceAgentOsAdapter } from "../runtime/agent-os-adapter";
import { createProductAgentVoiceDeliveryAuthorizer } from "../runtime/delivery-policy";
import { createVoiceProductionKernel } from "../runtime/kernel-runtime";
import {
  createGovernedVoiceOutboundService,
  type VoiceOutboundProvider,
  type VoiceOutboundRoute,
} from "./service";

const E164 = /^\+[1-9]\d{6,14}$/;

type VoiceRouteQueryable = Pick<pg.Pool, "query">;

async function resolveAsteriskRoute(db: VoiceRouteQueryable, organizationId: string): Promise<VoiceOutboundRoute | null> {
  const { rows } = await db.query<{
    control_url: string;
    phone_e164: string;
    external_connection_id: string;
  }>(
    `select vwe.control_url, vpn.phone_e164, vsc.external_connection_id
       from voice_sip_connections vsc
       join voice_worker_endpoints vwe
         on vwe.connection_id = vsc.id
        and vwe.enabled = true
       join voice_phone_numbers vpn
         on vpn.connection_id = vsc.id
        and vpn.organization_id = vsc.organization_id
        and vpn.provider = 'asterisk'
        and vpn.enabled = true
        and vpn.ownership_verified_at is not null
      where vsc.organization_id = $1
        and vsc.gateway = 'asterisk'
        and vsc.verified = true
        and vsc.enabled = true
      order by vsc.created_at, vsc.id, vpn.created_at, vpn.id
      limit 2`,
    [organizationId],
  );
  if (rows.length !== 1) return null;
  const row = rows[0]!;
  if (!E164.test(row.phone_e164) || !row.external_connection_id.trim()) return null;
  return {
    provider: "asterisk",
    endpoint: row.control_url.replace(/\/$/, ""),
    phoneE164: row.phone_e164,
    connectionId: row.external_connection_id,
  };
}

async function resolveLegacyTelnyxRoute(db: VoiceRouteQueryable, organizationId: string): Promise<VoiceOutboundRoute | null> {
  const { rows } = await db.query<{ control_url: string; phone_e164: string }>(
    `select vwe.control_url, vpn.phone_e164
       from voice_phone_numbers vpn
       join voice_worker_endpoints vwe on vwe.voice_phone_number_id = vpn.id
      where vpn.organization_id = $1
        and vpn.provider = 'telnyx'
        and vpn.enabled = true
        and vwe.enabled = true
      order by vpn.created_at, vpn.id
      limit 2`,
    [organizationId],
  );
  if (rows.length !== 1) return null;
  const row = rows[0]!;
  if (!E164.test(row.phone_e164)) return null;
  return {
    provider: "telnyx",
    endpoint: row.control_url.replace(/\/$/, ""),
    phoneE164: row.phone_e164,
    connectionId: null,
  };
}

export async function resolveProductionVoiceOutboundRoute(
  db: VoiceRouteQueryable,
  organizationId: string,
): Promise<VoiceOutboundRoute | null> {
  const asterisk = await resolveAsteriskRoute(db, organizationId);
  if (asterisk) return asterisk;
  return resolveLegacyTelnyxRoute(db, organizationId);
}

export async function dialProductionVoiceRoute(
  route: VoiceOutboundRoute,
  internalSecret: string,
  input: {
    voiceCallId: string;
    organizationId: string;
    contactId: string;
    agentId: string;
    goal: string;
    toE164: string;
    firstMessage: string;
  },
): Promise<void> {
  const response = await fetch(`${route.endpoint}/v1/calls`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-secret": internalSecret,
    },
    body: JSON.stringify({
      voice_call_id: input.voiceCallId,
      organization_id: input.organizationId,
      contact_id: input.contactId,
      agent_id: input.agentId,
      goal: input.goal,
      provider: route.provider,
      connection_id: route.connectionId,
      from_e164: route.phoneE164,
      to_e164: input.toE164,
      first_message: input.firstMessage,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`voice_worker_http_${response.status}`);
}

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

    async resolveRoute(organizationId) {
      // New canonical path: verified SIP/BYOC through Asterisk. The old
      // Telnyx worker remains an explicit rollback route only when no
      // verified Asterisk route exists.
      return resolveProductionVoiceOutboundRoute(db, organizationId);
    },

    async createCall(input) {
      const { rows } = await db.query<{ id: string }>(
        `insert into voice_calls
           (organization_id, contact_id, agent_id, direction, caller_number, called_number, state, provider)
         values ($1,$2,null,'outbound',$3,$4,'queued',$5)
         returning id`,
        [input.organizationId, input.contactId, input.fromE164, input.toE164, input.provider],
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
      await dialProductionVoiceRoute(input.route, internalSecret, {
        voiceCallId: input.voiceCallId,
        organizationId: input.organizationId,
        contactId: input.contactId,
        agentId: input.agentId,
        goal: input.goal,
        toE164: input.toE164,
        firstMessage: input.firstMessage,
      });
    },

    async markFailed(organizationId, voiceCallId, provider: VoiceOutboundProvider, reason) {
      await db.query(
        `update voice_calls
            set state = 'failed', ended_at = coalesce(ended_at, now()), updated_at = now()
          where organization_id = $1 and id = $2`,
        [organizationId, voiceCallId],
      );
      await db.query(
        `insert into voice_call_events
           (organization_id, voice_call_id, provider, provider_event_id, event_type, attributes, occurred_at)
         values ($1,$2,$3,$4,'voice.outbound_blocked',$5::jsonb,now())
         on conflict (organization_id, provider, provider_event_id) do nothing`,
        [organizationId, voiceCallId, provider, `${voiceCallId}:outbound_failed:${reason}`, JSON.stringify({ reason })],
      );
    },
  });
}
