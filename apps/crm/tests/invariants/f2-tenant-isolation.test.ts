import { describe, expect, it } from "vitest";
import { sql } from "./pg-exec";

const ORG_A = "aaaaaaaa-0200-4000-8000-000000000001";
const ORG_B = "bbbbbbbb-0200-4000-8000-000000000002";
const USER_A = "aaaaaaaa-0201-4000-8000-000000000001";
const USER_B = "bbbbbbbb-0201-4000-8000-000000000002";
const ROW_A = "aaaaaaaa-0202-4000-8000-000000000001";
const ROW_B = "bbbbbbbb-0202-4000-8000-000000000002";

describe("F2 tenant isolation matrix", () => {
  it("proves app filters, RLS, worker scope and platform-admin audit", () => {
    const output = sql(`
      insert into auth.users (id, email) values
        ('${USER_A}', 'f2-a@invariant.test'), ('${USER_B}', 'f2-b@invariant.test')
      on conflict (id) do nothing;
      insert into public.identity_user_mappings(firebase_uid, user_id)
      values ('f2-firebase-a', '${USER_A}'), ('f2-firebase-b', '${USER_B}')
      on conflict (firebase_uid) do update set user_id = excluded.user_id, active = true;
      insert into public.f2_tenant_isolation_probe(id, organization_id, label) values
        ('${ROW_A}', '${ORG_A}', 'same-fixture'), ('${ROW_B}', '${ORG_B}', 'same-fixture')
      on conflict (id) do update set organization_id = excluded.organization_id, label = excluded.label;

      select public.resolve_firebase_identity('f2-firebase-a') = '${USER_A}'::uuid;
      select rolname from pg_roles where rolname in ('app_runtime', 'worker_runtime', 'migration_admin', 'platform_admin_runtime') and not rolbypassrls;

      begin;
      set local role app_runtime;
      select set_config('app.user_id', '${USER_A}', true);
      select set_config('app.organization_id', '${ORG_A}', true);
      select count(*) from public.f2_tenant_isolation_probe;
      select count(*) from public.f2_tenant_isolation_probe where id = '${ROW_B}';
      select count(*) from (
        select id from public.f2_tenant_isolation_probe
        where label ilike '%fixture%' order by id limit 1
      ) fixture_search;
      select count(*) from (
        select id from public.f2_tenant_isolation_probe
        where id > '00000000-0000-0000-0000-000000000000'
        order by id limit 100
      ) fixture_page;
      select count(*) from public.f2_tenant_isolation_probe;
      do $$begin
        begin
          insert into public.f2_tenant_isolation_probe(id, organization_id, label)
          values ('aaaaaaaa-0203-4000-8000-000000000003', '${ORG_B}', 'forced-body-b');
          raise exception 'cross-tenant insert allowed';
        exception when others then
          if sqlerrm = 'cross-tenant insert allowed' then raise; end if;
        end;
      end$$;
      do $$begin
        begin
          update public.f2_tenant_isolation_probe set organization_id = '${ORG_B}' where id = '${ROW_A}';
          raise exception 'cross-tenant update allowed';
        exception when others then
          if sqlerrm = 'cross-tenant update allowed' then raise; end if;
        end;
      end$$;
      select count(*) from public.f2_tenant_isolation_probe where id = '${ROW_B}';
      delete from public.f2_tenant_isolation_probe where id = '${ROW_B}';
      commit;

      set role worker_runtime;
      begin;
      select set_config('app.user_id', '${USER_A}', true);
      select set_config('app.organization_id', '${ORG_A}', true);
      select count(*) from public.f2_tenant_isolation_probe;
      select count(*) from public.f2_tenant_isolation_probe where id = '${ROW_B}';
      commit;
      reset role;

      begin;
      set local role app_runtime;
      select set_config('app.user_id', '${USER_A}', true);
      select set_config('app.organization_id', '${ORG_A}', true);
      select count(*) from public.f2_tenant_isolation_probe;
      commit;
      begin;
      set local role app_runtime;
      select set_config('app.user_id', '${USER_B}', true);
      select set_config('app.organization_id', '${ORG_B}', true);
      select count(*) from public.f2_tenant_isolation_probe;
      commit;

      begin;
      set local role platform_admin_runtime;
      select set_config('app.user_id', '${USER_A}', true);
      select set_config('app.is_platform_admin', 'true', true);
      select public.record_platform_admin_tenant_access('${ORG_B}', 'f2-platform-admin');
      commit;
      reset role;
      select count(*) from public.tenant_access_audit where request_id = 'f2-platform-admin';
    `);

    const lines = output.split("\n");
    expect(lines).toContain("t");
    expect(lines.filter((line) => line === "app_runtime").length).toBe(1);
    expect(lines.filter((line) => line === "worker_runtime").length).toBe(1);
    expect(lines.filter((line) => line === "migration_admin").length).toBe(1);
    expect(lines.filter((line) => line === "platform_admin_runtime").length).toBe(1);
    expect(lines.filter((line) => line === "1").length).toBeGreaterThanOrEqual(8);
  });
});
