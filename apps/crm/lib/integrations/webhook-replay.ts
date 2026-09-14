import { randomUUID } from "node:crypto";
import type { Queryable } from "../agent-engine/queue/queue";

export type WebhookReplayInput = { organizationId: string; provider: string; eventId: string };
export type WebhookClaimResult =
  | { state: "claimed"; token: string }
  | { state: "duplicate" }
  | { state: "in_progress" };

export type WebhookReplayStore = {
  claim(input: WebhookReplayInput): Promise<WebhookClaimResult>;
  complete(input: WebhookReplayInput, token: string): Promise<void>;
  fail(input: WebhookReplayInput, token: string): Promise<void>;
};

export function createPostgresWebhookReplayStore(
  db: Queryable,
  table = "integration_webhook_receipts",
  leaseSeconds = 300,
): WebhookReplayStore {
  if (!/^\w+$/.test(table)) throw new Error("webhook_table_invalid");
  if (!Number.isInteger(leaseSeconds) || leaseSeconds < 1 || leaseSeconds > 3600) throw new Error("webhook_lease_invalid");

  return {
    async claim(input) {
      const token = randomUUID();
      const claimed = await db.query<{ claim_token: string }>(
        `insert into ${table} (organization_id,provider,event_id,status,claim_token,claimed_at,completed_at)
         values ($1,$2,$3,'PROCESSING',$4,now(),null)
         on conflict (organization_id,provider,event_id) do update
           set status='PROCESSING', claim_token=excluded.claim_token, claimed_at=now(), completed_at=null
         where ${table}.status='FAILED'
            or (${table}.status='PROCESSING' and ${table}.claimed_at < now() - ($5 * interval '1 second'))
         returning claim_token`,
        [input.organizationId, input.provider, input.eventId, token, leaseSeconds],
      );
      if (claimed.rows[0]) return { state: "claimed", token: claimed.rows[0].claim_token };

      const current = await db.query<{ status: "PROCESSING" | "PROCESSED" | "FAILED" }>(
        `select status from ${table} where organization_id=$1 and provider=$2 and event_id=$3`,
        [input.organizationId, input.provider, input.eventId],
      );
      if (current.rows[0]?.status === "PROCESSED") return { state: "duplicate" };
      if (current.rows[0]?.status === "PROCESSING") return { state: "in_progress" };
      throw new Error("webhook_claim_state_missing");
    },

    async complete(input, token) {
      const result = await db.query<{ event_id: string }>(
        `update ${table}
         set status='PROCESSED', claim_token=null, completed_at=now()
         where organization_id=$1 and provider=$2 and event_id=$3
           and status='PROCESSING' and claim_token=$4
         returning event_id`,
        [input.organizationId, input.provider, input.eventId, token],
      );
      if (!result.rows[0]) throw new Error("webhook_claim_lost");
    },

    async fail(input, token) {
      const result = await db.query<{ event_id: string }>(
        `update ${table}
         set status='FAILED', claim_token=null, completed_at=null
         where organization_id=$1 and provider=$2 and event_id=$3
           and status='PROCESSING' and claim_token=$4
         returning event_id`,
        [input.organizationId, input.provider, input.eventId, token],
      );
      if (!result.rows[0]) throw new Error("webhook_claim_lost");
    },
  };
}

export async function processWebhookOnce(
  store: WebhookReplayStore,
  input: WebhookReplayInput,
  handler: () => Promise<void>,
): Promise<"processed" | "duplicate" | "in_progress"> {
  const claim = await store.claim(input);
  if (claim.state === "duplicate" || claim.state === "in_progress") return claim.state;

  try {
    await handler();
  } catch (error) {
    await store.fail(input, claim.token);
    throw error;
  }
  await store.complete(input, claim.token);
  return "processed";
}
