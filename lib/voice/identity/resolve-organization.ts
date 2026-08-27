export interface VoiceOrganizationQueryable {
  query<T = Record<string, unknown>>(sql: string, params: unknown[]): Promise<{ rows: T[] }>;
}

const E164 = /^\+[1-9]\d{6,14}$/;

export function createVoiceOrganizationResolver(db: VoiceOrganizationQueryable) {
  return {
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
  };
}
