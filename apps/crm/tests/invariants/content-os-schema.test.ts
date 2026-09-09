import { beforeAll, describe, expect, it } from "vitest";

import { countAs, sql, tableExists } from "./gov-helpers";

const CONTENT_OS_TABLES = [
  "content_sources",
  "content_signals",
  "competitors",
  "competitor_monitors",
  "competitor_events",
  "content_opportunities",
  "content_campaigns",
  "content_ideas",
  "content_hooks",
  "content_scripts",
  "content_items",
  "content_approvals",
  "content_creators",
  "content_creator_profiles",
  "content_creator_assignments",
  "content_assets",
  "creative_jobs",
  "creative_job_assets",
  "distribution_connections",
  "publication_jobs",
  "publication_metrics",
  "content_learning_events",
] as const;

const ORG_A = "eeeeeeee-0000-4000-8000-000000000001";
const ORG_B = "eeeeeeee-0000-4000-8000-000000000002";
const USER_A = "eeeeeeee-1111-4000-8000-000000000001";
const USER_B = "eeeeeeee-1111-4000-8000-000000000002";

beforeAll(() => {
  sql(`
    insert into auth.users (id, email)
    values
      ('${USER_A}', 'content-os-rls-a@invariant.test'),
      ('${USER_B}', 'content-os-rls-b@invariant.test')
    on conflict (id) do nothing;
    insert into public.organizations (id, slug, legal_name, display_name)
    values
      ('${ORG_A}', 'content-os-rls-a', 'Content OS RLS A', 'Content OS RLS A'),
      ('${ORG_B}', 'content-os-rls-b', 'Content OS RLS B', 'Content OS RLS B')
    on conflict (id) do nothing;
    insert into public.user_organizations (user_id, organization_id, role, accepted_at)
    values
      ('${USER_A}', '${ORG_A}', 'agent', now()),
      ('${USER_B}', '${ORG_B}', 'agent', now())
    on conflict do nothing;
    insert into public.content_campaigns (organization_id, name)
    values
      ('${ORG_A}', 'Campaign A'),
      ('${ORG_B}', 'Campaign B')
    on conflict do nothing;
  `);
});

describe("Content OS Foundation schema", () => {
  it("creates every bounded-context table", () => {
    for (const table of CONTENT_OS_TABLES) {
      expect(tableExists(table), `${table} must exist`).toBe(true);
    }
  });

  it("enables RLS on every tenant-aware Content OS table", () => {
    const enabled = Number(
      sql(`
        select count(*)
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relname = any(array[${CONTENT_OS_TABLES.map((table) => `'${table}'`).join(",")}])
          and c.relrowsecurity;
      `),
    );

    expect(enabled).toBe(CONTENT_OS_TABLES.length);
  });

  it("prevents an organization member from reading another organization campaign", () => {
    const crossTenant = countAs(
      USER_A,
      `select count(*) from public.content_campaigns where organization_id = '${ORG_B}';`,
    );
    const ownTenant = countAs(
      USER_A,
      `select count(*) from public.content_campaigns where organization_id = '${ORG_A}';`,
    );

    expect(crossTenant).toBe(0);
    expect(ownTenant).toBeGreaterThanOrEqual(1);
  });
});
