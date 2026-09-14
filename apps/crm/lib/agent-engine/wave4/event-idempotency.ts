import type { WakeEvent } from "./event-wake";

export type Queryable = { query<T = unknown>(text: string, values?: unknown[]): Promise<{ rows: T[] }> };
export type WakeEventClaim = { id: string; organization_id: string; event_id: string; idempotency_key: string; status: "CLAIMED" };

export class PostgresWakeEventStore {
  constructor(private readonly db: Queryable) {}

  /** One insert is the replay gate; an empty RETURNING means this event was already processed. */
  async claim(event: WakeEvent): Promise<WakeEventClaim | undefined> {
    const result = await this.db.query<WakeEventClaim>(
      `insert into public.browsermesh_event_idempotency (organization_id,event_id,idempotency_key,status) values ($1,$2,$3,'CLAIMED') on conflict do nothing returning id,organization_id,event_id,idempotency_key,status`,
      [event.organization_id, event.event_id, event.idempotency_key],
    );
    return result.rows[0];
  }
}
