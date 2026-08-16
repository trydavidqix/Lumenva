import { beforeAll, describe, expect, it } from "vitest";

import {
  GOV_ADMIN,
  GOV_AGENT_A,
  GOV_CONTACT_1,
  GOV_MANAGER,
  GOV_ORG,
  GOV_VIEWER,
  countAs,
  lastLine,
  seedGov,
  sql,
  writeCountAs,
} from "./gov-helpers";

/**
 * Fase 7 (LangGraph), Task 2 — o que a migration 0119 promete, cobrado no banco
 * que o CLONE recebe (supabase/baseline.sql, não a migration isolada — mesma
 * disciplina de meta-templates-rls.test.ts / reactivation-schema.test.ts).
 *
 * Sob prova:
 *  1. a tabela nasce no baseline com RLS ligada e a policy correta;
 *  2. isolamento nas duas direções: SELECT (org B não vê org A) e o lado
 *     `with check` (org B não escreve COM o organization_id de org A);
 *  3. papel: viewer/agent NÃO leem nem escrevem — leitura E escrita exigem
 *     manager+ (a task pede exatamente isso, não só write). `decided_by`
 *     fica coberto pela MESMA policy — não existe caminho de escrita nesta
 *     tabela abaixo de manager, então "manager decide" já é a prova de que a
 *     coluna de aprovação está sob o mesmo gate, sem precisar de uma policy
 *     de coluna à parte;
 *  4. anon não tem GRANT nem policy — permission denied, não 0 linhas
 *     silencioso (mesmo padrão de gov-6-assignee-kind.test.ts);
 *  5. os dois UNIQUE por org (thread_id, side_effect_key): duplicar rejeita
 *     (23505/nome da constraint), e o MESMO side_effect_key em OUTRA org
 *     convive — a chave é de idempotência de side effect POR TENANT, não
 *     global, senão dois workflows paralelos em orgs diferentes colidiriam
 *     por coincidência de valor;
 *  6. workflow_type e status fora do vocabulário fechado rejeitam (CHECK);
 *  7. decided_by/decided_at andam juntos (um sem o outro rejeita);
 *  8. a linha nasce em modo shadow/draft vazio — a feature entra OFF/SHADOW
 *     por default (docs da fase: nenhum side effect real ainda).
 */

const WF_ORG_B = "0119bbbb-0000-4000-8000-000000000001";
const WF_MANAGER_B = "0119bbbb-1111-4000-8000-000000000001";
const WF_CONTACT_B = "0119bbbb-2222-4000-8000-000000000001";

function seedOrgB(): void {
  sql(`
    insert into auth.users (id, email) values
      ('${WF_MANAGER_B}', 'wf-manager-b@invariant.test')
      on conflict do nothing;
    insert into public.organizations (id, slug, legal_name, display_name) values
      ('${WF_ORG_B}', 'wf-inv-b', 'Workflow Runs Inv B', 'WF Inv B')
      on conflict do nothing;
    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${WF_MANAGER_B}', '${WF_ORG_B}', 'manager', now())
      on conflict do nothing;
    insert into public.contacts (id, organization_id, display_name)
      values ('${WF_CONTACT_B}', '${WF_ORG_B}', 'Workflow Runs Inv Contact B')
      on conflict do nothing;
  `);
}

/** Colunas mínimas de uma linha — só o que é NOT NULL sem default. */
const COLS = "(organization_id, workflow_type, thread_id, contact_id, side_effect_key)";

function values(org: string, contact: string, threadId: string, sideEffectKey: string): string {
  return `('${org}', 'commercial_proposal', '${threadId}', '${contact}', '${sideEffectKey}')`;
}

function erroDe(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    // execFileSync joga o stderr do psql em `stderr`; a mensagem do Error só traz o exit.
    const err = e as { stderr?: Buffer | string; message?: string };
    return String(err.stderr ?? "") + String(err.message ?? "");
  }
  throw new Error("a operação passou — a trava não existe neste banco");
}

beforeAll(() => {
  seedGov();
  seedOrgB();
});

describe("0119 · ai_workflow_runs chega ao clone", () => {
  it("a tabela nasce no baseline com RLS ligada e a policy de tenant", () => {
    expect(
      sql(`select count(*) from information_schema.tables
            where table_schema='public' and table_name='ai_workflow_runs'`),
    ).toBe("1");
    expect(sql(`select relrowsecurity from pg_class where relname='ai_workflow_runs'`)).toBe("t");
    expect(
      sql(`select policyname from pg_policies
            where schemaname='public' and tablename='ai_workflow_runs' order by 1`),
    ).toBe("tenant_isolation_ai_workflow_runs_all");
  });

  it("manager da org A cria o run na própria org e lê de volta", () => {
    const threadId = "11111111-0000-4000-8000-000000000001";
    expect(
      writeCountAs(
        GOV_MANAGER,
        `insert into public.ai_workflow_runs ${COLS} values ${values(GOV_ORG, GOV_CONTACT_1, threadId, "wf-side-effect-001")}`,
      ),
    ).toBe(1);
    expect(
      countAs(
        GOV_MANAGER,
        `select count(*) from public.ai_workflow_runs where thread_id = '${threadId}';`,
      ),
    ).toBe(1);
  });

  it("viewer e agent NÃO leem workflow runs da própria org (leitura é manager+, não só write)", () => {
    for (const userId of [GOV_VIEWER, GOV_AGENT_A]) {
      expect(
        countAs(
          userId,
          `select count(*) from public.ai_workflow_runs where organization_id = '${GOV_ORG}';`,
        ),
      ).toBe(0);
    }
  });

  it("viewer NÃO escreve workflow run", () => {
    const threadId = "11111111-0000-4000-8000-000000000002";
    expect(
      writeCountAs(
        GOV_VIEWER,
        `insert into public.ai_workflow_runs ${COLS} values ${values(GOV_ORG, GOV_CONTACT_1, threadId, "wf-side-effect-002")}`,
      ),
    ).toBe(0);
  });

  it("agent NÃO escreve workflow run (write é manager+, não agent+)", () => {
    const threadId = "11111111-0000-4000-8000-000000000003";
    expect(
      writeCountAs(
        GOV_AGENT_A,
        `insert into public.ai_workflow_runs ${COLS} values ${values(GOV_ORG, GOV_CONTACT_1, threadId, "wf-side-effect-003")}`,
      ),
    ).toBe(0);
  });

  it("manager DECIDE o run (decided_by/decided_at) — a coluna de aprovação está sob o mesmo gate manager+", () => {
    const threadId = "11111111-0000-4000-8000-000000000004";
    writeCountAs(
      GOV_MANAGER,
      `insert into public.ai_workflow_runs ${COLS} values ${values(GOV_ORG, GOV_CONTACT_1, threadId, "wf-side-effect-004")}`,
    );
    const updated = writeCountAs(
      GOV_MANAGER,
      `update public.ai_workflow_runs
         set status = 'approved', decided_by = '${GOV_MANAGER}', decided_at = now()
       where thread_id = '${threadId}'`,
    );
    expect(updated).toBe(1);
  });

  it("admin (papel acima de manager) também lê/escreve — fn_role_at_least é >=", () => {
    const threadId = "11111111-0000-4000-8000-000000000005";
    expect(
      writeCountAs(
        GOV_ADMIN,
        `insert into public.ai_workflow_runs ${COLS} values ${values(GOV_ORG, GOV_CONTACT_1, threadId, "wf-side-effect-005")}`,
      ),
    ).toBe(1);
  });

  it("membro (manager) da org B NÃO vê os runs da org A", () => {
    expect(
      countAs(
        WF_MANAGER_B,
        `select count(*) from public.ai_workflow_runs where organization_id = '${GOV_ORG}';`,
      ),
    ).toBe(0);
  });

  it("membro (manager) da org B NÃO escreve COM o organization_id da org A (o lado `with check`)", () => {
    const threadId = "11111111-0000-4000-8000-000000000006";
    expect(
      writeCountAs(
        WF_MANAGER_B,
        `insert into public.ai_workflow_runs ${COLS} values ${values(GOV_ORG, GOV_CONTACT_1, threadId, "wf-side-effect-006")}`,
      ),
    ).toBe(0);
    // 0 mesmo para quem bypassa RLS — separa "foi barrado" de "foi gravado e o
    // SELECT é que não enxerga".
    expect(sql(`select count(*) from public.ai_workflow_runs where thread_id = '${threadId}'`)).toBe(
      "0",
    );
  });

  it("anon não enxerga NENHUMA linha — RLS ligada + policy só `to authenticated` = 0 linhas", () => {
    // O baseline concede ALL ON TABLES a `anon` por default privilege
    // (`ALTER DEFAULT PRIVILEGES ... GRANT ALL ON TABLES TO anon`, mesmo
    // padrão de toda tabela nova do schema — não é falha desta migration).
    // A fronteira real é a policy ser `to authenticated`: para `anon` não há
    // policy aplicável, e RLS ligada sem policy aplicável nega TODA linha —
    // a query passa (tem GRANT), só que devolve 0, nunca "permission denied".
    const out = sql(`
      set role anon;
      select count(*) from public.ai_workflow_runs;
    `);
    expect(lastLine(out)).toBe("0");
  });

  it("thread_id duplicado NA MESMA org rejeita — a chave é (organization_id, thread_id)", () => {
    const threadId = "11111111-0000-4000-8000-000000000001"; // já inserido acima
    const erro = erroDe(() =>
      sql(
        `insert into public.ai_workflow_runs ${COLS} values ${values(GOV_ORG, GOV_CONTACT_1, threadId, "wf-side-effect-duplicate-thread")};`,
      ),
    );
    expect(erro).toContain("ai_workflow_runs_thread_unique");
  });

  it("side_effect_key duplicado NA MESMA org rejeita — idempotência do side effect real", () => {
    const erro = erroDe(() =>
      sql(
        `insert into public.ai_workflow_runs ${COLS} values ${values(GOV_ORG, GOV_CONTACT_1, "11111111-0000-4000-8000-000000000099", "wf-side-effect-001")};`,
      ),
    );
    expect(erro).toContain("ai_workflow_runs_side_effect_unique");
  });

  it("o MESMO side_effect_key em OUTRA org convive — uniqueness é por org, não global", () => {
    sql(
      `insert into public.ai_workflow_runs ${COLS} values ${values(WF_ORG_B, WF_CONTACT_B, "11111111-0000-4000-8000-000000000100", "wf-side-effect-001")};`,
    );
    expect(
      sql(`select count(*) from public.ai_workflow_runs where side_effect_key = 'wf-side-effect-001'`),
    ).toBe("2");
  });

  it("workflow_type fora do vocabulário fechado rejeita — v1 pilota só commercial_proposal", () => {
    const erro = erroDe(() =>
      sql(`
        insert into public.ai_workflow_runs
          (organization_id, workflow_type, thread_id, contact_id, side_effect_key)
          values ('${GOV_ORG}', 'invalid_workflow', '11111111-0000-4000-8000-000000000101', '${GOV_CONTACT_1}', 'wf-side-effect-101');
      `),
    );
    expect(erro).toContain("ai_workflow_runs_workflow_type_check");
  });

  it("status fora do vocabulário do motor rejeita (CHECK)", () => {
    const erro = erroDe(() =>
      sql(`
        insert into public.ai_workflow_runs
          (organization_id, workflow_type, thread_id, contact_id, side_effect_key, status)
          values ('${GOV_ORG}', 'commercial_proposal', '11111111-0000-4000-8000-000000000102', '${GOV_CONTACT_1}', 'wf-side-effect-102', 'invalid_status');
      `),
    );
    expect(erro).toContain("ai_workflow_runs_status_check");
  });

  it("decided_by sem decided_at rejeita — decisão e decisor andam juntos", () => {
    const erro = erroDe(() =>
      sql(`
        insert into public.ai_workflow_runs
          (organization_id, workflow_type, thread_id, contact_id, side_effect_key, decided_by)
          values ('${GOV_ORG}', 'commercial_proposal', '11111111-0000-4000-8000-000000000103', '${GOV_CONTACT_1}', 'wf-side-effect-103', '${GOV_MANAGER}');
      `),
    );
    expect(erro).toContain("ai_workflow_runs_decision_coherence");
  });

  it("decided_at sem decided_by rejeita — o mesmo par, do outro lado", () => {
    const erro = erroDe(() =>
      sql(`
        insert into public.ai_workflow_runs
          (organization_id, workflow_type, thread_id, contact_id, side_effect_key, decided_at)
          values ('${GOV_ORG}', 'commercial_proposal', '11111111-0000-4000-8000-000000000105', '${GOV_CONTACT_1}', 'wf-side-effect-105', now());
      `),
    );
    expect(erro).toContain("ai_workflow_runs_decision_coherence");
  });

  it("draft_payload nasce '{}' e status nasce 'shadow' — a feature entra OFF/SHADOW por default", () => {
    const threadId = "11111111-0000-4000-8000-000000000104";
    sql(
      `insert into public.ai_workflow_runs ${COLS} values ${values(GOV_ORG, GOV_CONTACT_1, threadId, "wf-side-effect-104")};`,
    );
    expect(
      sql(
        `select status || '|' || draft_payload::text from public.ai_workflow_runs where thread_id = '${threadId}'`,
      ),
    ).toBe("shadow|{}");
  });
});
