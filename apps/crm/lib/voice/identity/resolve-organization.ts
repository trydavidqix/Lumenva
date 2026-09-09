export interface VoiceOrganizationQueryable {
  query<T = Record<string, unknown>>(sql: string, params: unknown[]): Promise<{ rows: T[] }>;
}

const E164 = /^\+[1-9]\d{6,14}$/;

export type SipGatewayName = "asterisk" | "telnyx";

export function createVoiceOrganizationResolver(db: VoiceOrganizationQueryable) {
  return {
    /**
     * Legacy path: a number the platform purchased from Telnyx identifies
     * the tenant directly. Kept for rollback — Fase 2 supersedes this with
     * `resolveByConnection`, which never trusts a bare number alone.
     */
    async resolve(provider: "telnyx", calledE164: string): Promise<string | null> {
      if (!E164.test(calledE164)) throw new Error("[voice] called number must be valid E.164");
      const { rows } = await db.query<{ organization_id: string }>(
        `select organization_id
           from voice_phone_numbers
          where provider = $1
            and phone_e164 = $2
            and enabled = true
          limit 2`,
        [provider, calledE164],
      );
      if (rows.length === 0) return null;
      if (rows.length > 1) throw new Error("[voice] ambiguous technical number ownership");
      return rows[0]!.organization_id;
    },

    /**
     * SIP/BYOC path (Fase 2 do plano open-source): conexão SIP -> número
     * E.164 -> organização. An unknown or unverified connection never
     * reaches the number lookup — it can't leak which organization a number
     * belongs to. The number itself must also be registered, enabled, and
     * owned by the same organization as the connection: a verified
     * connection alone does not authorize an arbitrary number.
     */
    async resolveByConnection(
      gateway: SipGatewayName,
      externalConnectionId: string,
      calledE164: string,
    ): Promise<string | null> {
      if (!externalConnectionId.trim()) throw new Error("[voice] SIP connection id is required");
      if (!E164.test(calledE164)) throw new Error("[voice] called number must be valid E.164");

      const { rows: connectionRows } = await db.query<{ id: string; organization_id: string }>(
        `select id, organization_id
           from voice_sip_connections
          where gateway = $1
            and external_connection_id = $2
            and verified = true
            and enabled = true
          limit 2`,
        [gateway, externalConnectionId],
      );
      if (connectionRows.length === 0) return null; // unknown/unverified connection: reject
      if (connectionRows.length > 1) throw new Error("[voice] ambiguous SIP connection");
      const connection = connectionRows[0]!;

      const { rows: numberRows } = await db.query<{ organization_id: string }>(
        `select organization_id
           from voice_phone_numbers
          where connection_id = $1
            and provider = 'asterisk'
            and phone_e164 = $2
            and organization_id = $3
            and enabled = true
            and ownership_verified_at is not null
          limit 2`,
        [connection.id, calledE164, connection.organization_id],
      );
      if (numberRows.length === 0) return null; // number not registered under this connection: reject
      if (numberRows.length > 1) throw new Error("[voice] ambiguous number ownership under connection");
      return numberRows[0]!.organization_id;
    },
  };
}
