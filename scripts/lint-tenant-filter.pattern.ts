/**
 * Predicado do gate de filtro de tenant (risco #1 de `docs/current-state.md` §5:
 * "89 dos 169 handlers usam createAdminClient... o que falta é o gate que impede
 * um handler novo de nascer errado").
 *
 * Mora em módulo separado de `lint-tenant-filter.ts` pelo mesmo motivo de
 * `lint-channels.pattern.ts`: o script varre o disco e `process.exit`a no topo
 * do módulo — importá-lo de um teste RODARIA o lint. Separar deixa o
 * reconhecimento testável sem disparar a varredura.
 *
 * ─── O que o predicado NÃO prova ────────────────────────────────────────────
 * Isto não é dataflow analysis. Não prova que uma query filtra pelo org CERTO,
 * só que o arquivo faz uma query direta via service role sem NENHUMA menção a
 * `organization_id`/`organizationId` no próprio arquivo. Um handler que delega
 * a query a um helper (`lib/escalacao/chamados.ts`, por exemplo, que recebe
 * `orgId` como parâmetro e filtra lá dentro) passa por aqui mesmo estando
 * correto — e passa de propósito: sem seguir a chamada até o helper não dá
 * para saber se ele filtra, e marcar "suspeito" todo handler que delega
 * produziria ruído demais para o gate ser levado a sério (medido: das 9
 * primeiras ocorrências sem refinar esse critério, 4 eram exatamente esse
 * falso positivo — ver commit que introduziu este arquivo).
 *
 * O que ISTO pega: o handler que escreve `.from(...)` direto com
 * `createAdminClient()` e não filtra nada visível no próprio arquivo — a
 * classe de erro mais simples e mais provável ("esqueceu o `.eq()`"), não
 * toda a superfície de risco do achado original.
 */

/** `true` quando o arquivo faz query direta via admin client sem filtro de org visível. */
export function isTenantFilterSuspect(content: string): boolean {
  const usesAdminClient = /createAdminClient/.test(content);
  const hasDirectQuery = /\.from\(/.test(content);
  const mentionsOrg = /organization_id|organizationId/.test(content);
  return usesAdminClient && hasDirectQuery && !mentionsOrg;
}
