/**
 * Gate do risco #1 de `docs/current-state.md` §5: handlers de API que usam
 * `createAdminClient` (bypassa RLS) precisam filtrar `organization_id`
 * manualmente. Não havia enforcement automático — só revisão humana na
 * escrita. Rodado pelo `gov:verify`.
 *
 * O predicado mora em `lint-tenant-filter.pattern.ts` (testável sem disparar a
 * varredura) — leia lá o que este gate prova e o que NÃO prova antes de confiar
 * cegamente no verde.
 *
 * Escopo: só `app/api/**\/route.ts` — é a fronteira que recebe requisição
 * autenticada de tenant. Workers/crons/scripts rodam código de confiança já
 * escopado pelo próprio design (varredura system-wide é o contrato deles, não
 * um esquecimento) e ficam fora de propósito.
 *
 * Mesma catraca de `lint-channels.ts`: arquivo novo que casa o padrão e não
 * está em KNOWN_DEBT reprova; entrada de KNOWN_DEBT que já não casa (ou sumiu)
 * também reprova, para a lista só poder encolher.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { isTenantFilterSuspect } from "./lint-tenant-filter.pattern";

const ROOT = "app/api";

/**
 * Medido em 2026-08-20. Cada entrada foi lida individualmente — nenhuma é
 * "provavelmente ok"; todas filtram tenant por um caminho que o predicado não
 * enxerga (service role usado só para dado global, ou rota que é a única
 * superfície cross-tenant legítima por doutrina).
 */
const KNOWN_DEBT: { reason: string; files: string[] }[] = [
  {
    reason:
      "Único papel cross-tenant do contrato base (.claude/rules/multi-tenancy.md " +
      "\"Platform admin\"). `platform_admins` não é tabela tenant-aware — não tem " +
      "organization_id para filtrar. Rota é read-only por design (POST/PATCH/DELETE " +
      "devolvem 405 explícito).",
    files: ["app/api/v1/admin/platform-admins/route.ts"],
  },
  {
    reason:
      "Auto-atualização do host self-host (spec de sistema, não CRM). " +
      "`system_version`/`system_update_runs` são tabelas de instalação, não de " +
      "tenant — não têm organization_id. Autenticação é platform-admin/secret de " +
      "cron, não sessão de org.",
    files: ["app/api/v1/system/update/route.ts", "app/api/v1/system/agent/route.ts", "app/api/v1/system/version/route.ts"],
  },
  {
    reason:
      "AT-08: varredura EXPLICITAMENTE system-wide (\"Trigger NUNCA faz HTTP; este " +
      "é um cron TS que faz UPDATE via admin client (varredura system-wide, não " +
      "tenant-scoped)\" — docblock do próprio arquivo). Marca every atendente " +
      "online sem heartbeat como offline, em toda organização; não é escopo de " +
      "tenant esquecido, é o contrato do cron.",
    files: ["app/api/v1/cron/attendant-heartbeat/route.ts"],
  },
];

const DEBT = new Set(KNOWN_DEBT.flatMap((g) => g.files));

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return e.name === "route.ts" ? [p] : [];
  });
}

const offenders = walk(ROOT)
  .map((f) => f.replaceAll("\\", "/"))
  .filter((f) => isTenantFilterSuspect(readFileSync(f, "utf8")));

const novos = offenders.filter((f) => !DEBT.has(f));
const stale = [...DEBT].filter((f) => !offenders.includes(f)).sort();

if (novos.length) {
  console.error(
    "Handler usa createAdminClient + query direta sem organization_id visível no arquivo:",
  );
  for (const f of novos.sort()) console.error(`  ${f}`);
  console.error(
    "\nFiltre organization_id explicitamente na query, ou delegue a um helper que " +
      "receba o orgId como parâmetro e filtre lá (nesse caso a menção precisa " +
      "aparecer no próprio arquivo do helper, não aqui). Se a rota é " +
      "LEGITIMAMENTE global (platform admin, dado de instalação self-host, " +
      "varredura system-wide documentada), declare em KNOWN_DEBT com o motivo — " +
      "não silencie o gate sem registro.",
  );
}

if (stale.length) {
  console.error(
    "\nEntradas de KNOWN_DEBT que já não casam (ou o arquivo sumiu) — apague-as de\n" +
      "scripts/lint-tenant-filter.ts para a catraca não afrouxar:",
  );
  for (const f of stale) console.error(`  ${f}`);
}

if (novos.length || stale.length) process.exit(1);

console.info(`lint-tenant-filter: ok (${DEBT.size} arquivos de dívida conhecida, nenhum novo)`);
