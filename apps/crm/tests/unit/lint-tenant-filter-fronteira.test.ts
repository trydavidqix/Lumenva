/**
 * O predicado de `scripts/lint-tenant-filter.ts` (gate do risco #1 de
 * `docs/current-state.md` §5 — handler com `createAdminClient` sem enforcement
 * automático de filtro de tenant).
 *
 * Guarda duas coisas que importam ficarem estáveis:
 *  - o positivo real: handler que faz query direta via admin client sem NENHUMA
 *    menção a organization_id no arquivo é pego;
 *  - os falsos positivos já medidos ao construir o gate (ver o comentário em
 *    `lint-tenant-filter.pattern.ts`): delegar a um helper com orgId como
 *    parâmetro, ou usar o admin client só para dado global (auth.users via
 *    `admin.auth.admin.getUserById`), não deve acusar — um gate ruidoso é
 *    ignorado, e ignorado é pior que gate nenhum.
 */
import { describe, expect, it } from "vitest";

import { isTenantFilterSuspect } from "../../scripts/lint-tenant-filter.pattern";

describe("isTenantFilterSuspect", () => {
  it("pega handler novo com query direta e zero filtro de tenant", () => {
    const conteudo = `
      const admin = createAdminClient();
      const { data } = await admin.from("crm_leads").select("*");
    `;
    expect(isTenantFilterSuspect(conteudo)).toBe(true);
  });

  it("não acusa quando a query filtra organization_id inline", () => {
    const conteudo = `
      const admin = createAdminClient();
      const { data } = await admin.from("crm_leads").select("*").eq("organization_id", org.orgId);
    `;
    expect(isTenantFilterSuspect(conteudo)).toBe(false);
  });

  it("não acusa quando a query filtra por 'organizationId' (camelCase, ex.: RPC)", () => {
    const conteudo = `
      const admin = createAdminClient();
      await admin.from("x").select("*").eq("org", organizationId);
    `;
    expect(isTenantFilterSuspect(conteudo)).toBe(false);
  });

  it("não acusa handler que DELEGA a query a um helper com orgId — falso positivo medido (ai/cases)", () => {
    const conteudo = `
      const { org } = authz;
      const admin = createAdminClient();
      const { chamados } = await listarChamados(admin, org.orgId, { estado: "abertos" });
    `;
    // Sem .from() no próprio arquivo — o predicado não tenta seguir a chamada
    // até o helper, e por isso também não acusa (documentado: não é dataflow
    // analysis).
    expect(isTenantFilterSuspect(conteudo)).toBe(false);
  });

  it("não acusa admin client usado só para dado GLOBAL (auth.users) sem .from() — falso positivo medido (metrics/attendants)", () => {
    const conteudo = `
      const admin = createAdminClient();
      const { data } = await admin.auth.admin.getUserById(userId);
    `;
    expect(isTenantFilterSuspect(conteudo)).toBe(false);
  });

  it("não acusa arquivo sem createAdminClient nenhum", () => {
    const conteudo = `
      const supabase = await createClient();
      await supabase.from("crm_leads").select("*");
    `;
    expect(isTenantFilterSuspect(conteudo)).toBe(false);
  });

  it("não acusa createAdminClient sem nenhuma query .from() (ex.: só chama RPC)", () => {
    const conteudo = `
      const admin = createAdminClient();
      await admin.rpc("fn_something", { p_org: orgId });
    `;
    expect(isTenantFilterSuspect(conteudo)).toBe(false);
  });
});
