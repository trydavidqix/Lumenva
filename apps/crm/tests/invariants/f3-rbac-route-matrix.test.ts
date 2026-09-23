import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

import type * as GovHelpersModule from "./gov-helpers";

type GovHelpers = typeof GovHelpersModule;

let gov: GovHelpers | undefined;

const OTHER_ORG = "cccccccc-0000-4000-8000-000000000002";
const OTHER_USER = "cccccccc-1111-4000-8000-000000000099";
const OTHER_PIPELINE = "cccccccc-5555-4000-8000-000000000099";
const OTHER_STAGE = "cccccccc-5555-4000-8000-000000000099";
const OTHER_LEAD = "cccccccc-6666-4000-8000-000000000099";
const GOV_ORG = "cccccccc-0000-4000-8000-000000000001";
const GOV_VIEWER = "cccccccc-1111-4000-8000-000000000001";
const GOV_AGENT_A = "cccccccc-1111-4000-8000-000000000002";
const GOV_MANAGER = "cccccccc-1111-4000-8000-000000000004";
const GOV_ADMIN = "cccccccc-1111-4000-8000-000000000005";
const GOV_LEAD = "cccccccc-6666-4000-8000-000000000001";
const dbAvailable = Boolean(process.env.TEST_DB_CONTAINER);

type RouteCase = {
  name: string;
  file: string;
  minimum?: "viewer" | "agent" | "manager" | "admin";
  platformAdmin?: boolean;
  audited?: boolean;
  platformGuard?: boolean;
  noRawDatabaseError?: boolean;
};

const ROUTE_MATRIX: ReadonlyArray<RouteCase> = [
  { name: "team", file: "app/api/v1/team/invite/route.ts", minimum: "admin" },
  {
    name: "tokens",
    file: "app/api/v1/settings/api-tokens/route.ts",
    minimum: "admin",
    noRawDatabaseError: true,
  },
  {
    name: "conversations/media",
    file: "app/api/v1/conversations/[id]/media/route.ts",
    minimum: "agent",
  },
  { name: "contacts", file: "app/api/v1/contacts/route.ts", minimum: "agent" },
  { name: "leads", file: "app/api/v1/leads/route.ts", minimum: "agent" },
  { name: "pipelines/stages", file: "app/api/v1/pipelines/route.ts", minimum: "manager" },
  { name: "settings", file: "app/api/v1/settings/routing/route.ts", minimum: "manager" },
  {
    name: "integrations",
    file: "app/actions/integrations/disconnectNuvemshop.ts",
    minimum: "admin",
    platformAdmin: true,
    audited: true,
  },
  {
    name: "audit",
    file: "app/api/v1/audit/route.ts",
    minimum: "manager",
    platformAdmin: true,
    noRawDatabaseError: true,
  },
  {
    name: "LGPD",
    file: "app/api/v1/privacy/requests/[id]/approve/route.ts",
    minimum: "admin",
    platformAdmin: true,
    audited: true,
    noRawDatabaseError: true,
  },
  {
    name: "system update",
    file: "app/api/v1/system/update/route.ts",
    platformGuard: true,
    audited: true,
  },
];

function sourceFor(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

function seedOtherTenant(): void {
  gov?.sql(`
    insert into auth.users (id, email)
      values ('${OTHER_USER}', 'f3-other-admin@invariant.test')
      on conflict do nothing;
    insert into public.organizations (id, slug, legal_name, display_name)
      values ('${OTHER_ORG}', 'f3-other', 'F3 Other Org', 'F3 Other Org')
      on conflict do nothing;
    insert into public.user_organizations (user_id, organization_id, role, accepted_at)
      values ('${OTHER_USER}', '${OTHER_ORG}', 'admin', now())
      on conflict do nothing;
    insert into public.crm_pipelines (id, organization_id, name, slug)
      values ('${OTHER_PIPELINE}', '${OTHER_ORG}', 'F3 Other Pipeline', 'f3-other')
      on conflict do nothing;
    insert into public.crm_stages (id, organization_id, pipeline_id, name, slug, position)
      values ('${OTHER_STAGE}', '${OTHER_ORG}', '${OTHER_PIPELINE}', 'Other', 'other', 1000)
      on conflict do nothing;
    insert into public.crm_leads (id, organization_id, pipeline_id, stage_id, title)
      values ('${OTHER_LEAD}', '${OTHER_ORG}', '${OTHER_PIPELINE}', '${OTHER_STAGE}', 'F3 other lead')
      on conflict do nothing;
  `);
}

beforeAll(async () => {
  if (!dbAvailable) return;
  gov = await import("./gov-helpers");
  gov.seedGov();
  seedOtherTenant();
});

describe("F3 RBAC route matrix", () => {
  it("declares one canonical role gate for every representative surface", () => {
    for (const route of ROUTE_MATRIX) {
      const source = sourceFor(route.file);
      expect(source, route.name).not.toMatch(/\buser\.is_platform_admin\b/);

      if (route.platformGuard) {
        expect(source, route.name).toContain("requirePlatformAdminApi");
      } else {
        expect(source, route.name).toMatch(
          new RegExp(`requireRole\\(\\s*["']${route.minimum}["']`),
        );
      }

      if (route.platformAdmin) {
        expect(source, route.name).toContain("allowPlatformAdmin: true");
      }
      if (route.audited) {
        expect(source, route.name).toContain("audit");
      }
      if (route.noRawDatabaseError) {
        expect(source, route.name).not.toMatch(
          /fail\([\s\S]{0,100}\b(?:error|reqErr|insErr)\.message/,
        );
      }
    }
  });

  it("executes authorization before an admin client or platform side effect", () => {
    for (const route of ROUTE_MATRIX) {
      const source = sourceFor(route.file);
      const gate = Math.min(
        ...["requireRole(", "requirePlatformAdminApi("].map((needle) => {
          const index = source.indexOf(needle);
          return index === -1 ? Number.POSITIVE_INFINITY : index;
        }),
      );
      expect(gate, `${route.name}: missing authorization gate`).toBeLessThan(
        Number.POSITIVE_INFINITY,
      );

      const adminClient = source.indexOf("createAdminClient(");
      if (adminClient !== -1) {
        expect(gate, `${route.name}: admin client before gate`).toBeLessThan(adminClient);
      }
    }
  });

  it("does not redeclare human role ordering in shared handlers", () => {
    for (const file of ["app/api/v1/contacts/_handler.ts"]) {
      expect(sourceFor(file), file).not.toMatch(/const ROLE_RANK\s*:/);
    }
  });

  const dbIt = it.skipIf(!dbAvailable);

  dbIt("resolves the four human roles independently", () => {
    const roleVector = (userId: string): string =>
      gov!.lastLine(
        gov!.sql(`
          select set_config('request.jwt.claims', '{"sub":"${userId}"}', false);
          select array_to_string(array[
            public.fn_role_at_least('${GOV_ORG}', 'viewer'),
            public.fn_role_at_least('${GOV_ORG}', 'agent'),
            public.fn_role_at_least('${GOV_ORG}', 'manager'),
            public.fn_role_at_least('${GOV_ORG}', 'admin')
          ], ',');
        `),
      );

    expect(roleVector(GOV_VIEWER)).toBe("t,f,f,f");
    expect(roleVector(GOV_AGENT_A)).toBe("t,t,f,f");
    expect(roleVector(GOV_MANAGER)).toBe("t,t,t,f");
    expect(roleVector(GOV_ADMIN)).toBe("t,t,t,t");
    expect(
      gov!.lastLine(
        gov!.sql(`
          select set_config('request.jwt.claims', '{"sub":"${OTHER_USER}"}', false);
          select coalesce(public.fn_user_role_in_org('${OTHER_ORG}'), '0');
        `),
      ),
    ).toBe("admin");
  });

  dbIt("fails closed for revoked membership and an absent organization", () => {
    gov!.sql(
      `update public.user_organizations set revoked_at = now()
       where user_id = '${GOV_AGENT_A}' and organization_id = '${GOV_ORG}';`,
    );
    try {
      expect(
        gov!.lastLine(
          gov!.sql(`
            select set_config('request.jwt.claims', '{"sub":"${GOV_AGENT_A}"}', false);
            select coalesce(public.fn_user_role_in_org('${GOV_ORG}'), '0');
          `),
        ),
      ).toBe("0");
    } finally {
      gov!.sql(
        `update public.user_organizations set revoked_at = null
         where user_id = '${GOV_AGENT_A}' and organization_id = '${GOV_ORG}';`,
      );
    }

    expect(
      gov!.lastLine(
        gov!.sql(`
          select set_config('request.jwt.claims', '{"sub":"${GOV_AGENT_A}"}', false);
          select coalesce(public.fn_user_role_in_org('${OTHER_ORG}'), '0');
        `),
      ),
    ).toBe("0");
  });

  dbIt("hides another tenant's ID and blocks forced tenant writes/moves", () => {
    expect(
      gov!.countAs(GOV_VIEWER, `select count(*) from public.crm_leads where id = '${OTHER_LEAD}';`),
    ).toBe(0);

    const forcedInsert = gov!.writeCountAs(
      GOV_AGENT_A,
      `insert into public.crm_leads (id, organization_id, pipeline_id, stage_id, title)
       values ('cccccccc-6666-4000-8000-000000000098', '${OTHER_ORG}', '${OTHER_PIPELINE}', '${OTHER_STAGE}', 'forged')
       on conflict do nothing`,
    );
    expect(forcedInsert).toBe(0);
    expect(
      gov!.sql(
        `select count(*) from public.crm_leads where id = 'cccccccc-6666-4000-8000-000000000098';`,
      ),
    ).toBe("0");

    const moved = gov!.writeCountAs(
      GOV_AGENT_A,
      `update public.crm_leads set organization_id = '${OTHER_ORG}' where id = '${GOV_LEAD}'`,
    );
    expect(moved).toBe(0);
    expect(gov!.sql(`select organization_id from public.crm_leads where id = '${GOV_LEAD}';`)).toBe(
      GOV_ORG,
    );
  });
});
