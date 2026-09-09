import { phoneLookupVariants } from "@/lib/channels/phone-variants";
import type { CustomerQuickMemory } from "@/lib/agent-engine/customer-memory/types";

export interface VoiceIdentityQueryable {
  query<T = Record<string, unknown>>(sql: string, params: unknown[]): Promise<{ rows: T[] }>;
}

export interface VoiceCustomerMemoryReader {
  getQuickMemory(organizationId: string, contactId: string): Promise<CustomerQuickMemory | null>;
}

export type VoiceCallerResolution =
  | { kind: "known"; contactId: string; quickMemory: CustomerQuickMemory | null }
  | { kind: "unknown"; contactId: null; quickMemory: null };

export function createVoiceCallerResolver(
  db: VoiceIdentityQueryable,
  memory: VoiceCustomerMemoryReader,
) {
  return {
    async resolve(organizationId: string, callerE164: string): Promise<VoiceCallerResolution> {
      if (!organizationId.trim()) throw new Error("[voice] organizationId is required before caller lookup");
      const variants = phoneLookupVariants(callerE164);
      if (variants.length === 0) return { kind: "unknown", contactId: null, quickMemory: null };

      const { rows } = await db.query<{ id: string }>(
        `select id
           from contacts
          where organization_id = $1
            and phone_number = any($2::text[])
          order by id
          limit 2`,
        [organizationId, variants],
      );

      if (rows.length === 0) return { kind: "unknown", contactId: null, quickMemory: null };
      if (rows.length > 1) {
        throw new Error("[voice] ambiguous caller identity inside organization");
      }

      const contactId = rows[0]!.id;
      const quickMemory = await memory.getQuickMemory(organizationId, contactId);
      return { kind: "known", contactId, quickMemory };
    },
  };
}
