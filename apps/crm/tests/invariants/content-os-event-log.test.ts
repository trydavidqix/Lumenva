import { afterAll, describe, expect, it } from "vitest";

import { sql } from "./gov-helpers";

const ORG = "dddddddd-0000-4000-8000-000000000017";
const EVENT_ID = "dddddddd-eeee-4000-8000-000000000017";

describe("Content OS event_log persistence", () => {
  afterAll(() => {
    sql(`delete from public.event_log where id = '${EVENT_ID}';`);
  });

  it("inserts a canonical two-segment event and rejects a three-segment name at the SQL constraint", () => {
    sql(`
      insert into public.organizations (id, slug, legal_name, display_name)
      values ('${ORG}', 'content-os-event-log', 'Content OS Event Log', 'Content OS Event Log')
      on conflict (id) do nothing;
      insert into public.event_log
        (id, organization_id, event_type, entity_kind, entity_id, payload, metadata)
      values
        ('${EVENT_ID}', '${ORG}', 'content.signal_collected', 'content', '${EVENT_ID}',
         '{"organization_id":"${ORG}","entity_id":"${EVENT_ID}"}'::jsonb,
         '{"request_id":"dddddddd-dddd-4ddd-8ddd-dddddddddd17"}'::jsonb);
    `);

    expect(
      sql(`select event_type from public.event_log where id = '${EVENT_ID}';`),
    ).toBe("content.signal_collected");

    expect(() =>
      sql(`
        insert into public.event_log
          (organization_id, event_type, entity_kind, entity_id)
        values ('${ORG}', 'content.signal.collected', 'content', '${EVENT_ID}');
      `),
    ).toThrow(/event_type_format|violates check constraint/);
  });
});
