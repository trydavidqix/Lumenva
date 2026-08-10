# Matriz de preservação da doutrina do harness

Baseline histórico: `CLAUDE.md` de `main@4fa4ca9a7042b88d6de35e411e4375213fb26d93`.

Objetivo: provar que a modularização do harness não apaga silenciosamente obrigações válidas. `ESTÁVEL` significa que a regra continua normativa; `SNAPSHOT` significa estado temporal que não deve virar regra eterna; `DIVERGENTE` significa que uma fonte canônica posterior/mais específica resolveu o ponto de forma diferente do texto histórico.

Precedência usada nesta reconciliação: `CLAUDE.md` como autoridade de harness; para decidir se uma regra histórica ainda descreve o produto, `docs/specs/` > `docs/prd/` > `docs/business-rules/` > handoffs/snapshots, conforme `docs/index.md`. Código/testes atuais foram usados como evidência de implementação quando necessário.

| Regra/grupo do `CLAUDE.md` original | Classificação | Fonte atual consultada | Destino no harness modular | Estado / reconciliação |
|---|---|---|---|---|
| `CLAUDE.md` é autoridade; `AGENTS.md` é contrato portátil | ESTÁVEL | `docs/index.md`, harness atual | `CLAUDE.md`, `AGENTS.md`, skills | Preservada |
| Stack: Next/React/TS/Supabase/WAHA/Upstash/Zod/Sentry | ESTÁVEL | `package.json`, specs | `CLAUDE.md` | Preservada sem congelar patch versions não necessárias |
| Preferência de provider/modelo de IA específica no texto histórico | SNAPSHOT | `package.json`, runtime/config atuais | specs/config do domínio | Não é doutrina eterna do harness |
| Toda tabela tenant-aware tem `organization_id` + RLS | ESTÁVEL | Business rule T-01, Spec/PRD 01 | `.claude/rules/multi-tenancy.md` | Preservada |
| Service role filtra `organization_id` manualmente; nunca confia no body | ESTÁVEL | T-02, Spec/PRD 01 | `multi-tenancy.md`, `security.md` | Preservada |
| Query cruzada mantém escopo do tenant | ESTÁVEL | T-01/T-08, Spec 01 | `multi-tenancy.md` | Preservada |
| Teste cross-tenant obrigatório quando tenancy/RLS muda | ESTÁVEL | T-01/T-02, CI/doctrine | `multi-tenancy.md`, `testing-verification.md` | Preservada |
| Mensagens/webhooks usam idempotência tenant-aware e tratam `23505` | ESTÁVEL | W-05, PRD/Spec 03 | `api-contract.md`, `whatsapp-waha.md` | Preservada |
| POST de criação aceita `Idempotency-Key` com TTL 24h | ESTÁVEL | PRD 01 §3.8, Spec 01 trade-off | `api-contract.md` | Restaurada explicitamente |
| Trigger Postgres nunca faz HTTP; side effect sai por event/worker | ESTÁVEL | PRD/Specs 01/03/06 | `CLAUDE.md`, `database-migrations.md` | Preservada |
| `/api/v1/`, JSON `snake_case`, UUID v4, ISO-8601 UTC, `_cents` + currency | ESTÁVEL | PRD 01 §3.8 | `api-contract.md` | Restaurada explicitamente |
| `ok()`/`fail()`, cursor HMAC, cookie/bearer, rate-limit headers, `X-Request-Id` | ESTÁVEL | PRD/Spec 01 | `api-contract.md` | Restaurada explicitamente |
| API key nunca em query string | ESTÁVEL | PRD/Spec 01, security | `CLAUDE.md`, `security.md`, `api-contract.md` | Preservada |
| Plaintext de bearer mostrado uma vez; hash persistido | ESTÁVEL | PRD/Spec 01 | `security.md`, `api-contract.md` | Restaurada explicitamente |
| Backend usa `getUser()`, nunca `getSession()` como prova de identidade | ESTÁVEL | PRD 01 | `CLAUDE.md`, `security.md`, `multi-tenancy.md` | Preservada |
| Roles `viewer < agent < manager < admin` | ESTÁVEL | PRD/Spec 01 | `CLAUDE.md`, `security.md`, `multi-tenancy.md` | Preservada |
| Super-admin representado por coluna `is_platform_admin` | DIVERGENTE | Spec 01 §1.4/§2.3 resolve `platform_admins` como tabela separada | `security.md`, `multi-tenancy.md` | Texto histórico não restaurado literalmente; autoridade atual é `platform_admins` |
| Super-admin é único papel cross-tenant e mudança é controlada/auditada | ESTÁVEL | PRD 01 §3.4, Spec 01, T-04 | `security.md`, `multi-tenancy.md` | Preservada com representação atual |
| MFA TOTP obrigatório para `admin` e platform admin | ESTÁVEL | PRD 01 §3.1/§3.4 | `security.md` | Restaurada explicitamente |
| `user_pipeline_access` fora do MVP | ESTÁVEL | PRD 01 §3.3 | `security.md` | Preservada como decisão de escopo, não schema |
| Toda mutação relevante gera `api_audit_log` | ESTÁVEL | PRD/Spec 01 | `audit-observability.md` | Restaurada explicitamente |
| Audit append-only; sem edição/deleção normal | ESTÁVEL | PRD/Spec 01, L-10 | `audit-observability.md` | Restaurada explicitamente |
| Audit fire-and-forget; falha alerta e não bloqueia mutação principal | ESTÁVEL | PRD 01 §3.5 | `audit-observability.md` | Restaurada explicitamente |
| Audit p99 <=500ms | ESTÁVEL | PRD 01 §3.5/§4.2 | `audit-observability.md` | Restaurada como requisito documentado |
| Retenção audit 5 anos; hot 90d + cold S3 | ESTÁVEL | PRD 01 §3.5/§4.3, business rule L-10 | `audit-observability.md` | Restaurada explicitamente |
| LGPD prefere anonimização a delete | ESTÁVEL | PRD 01 §3.6, L-01 | `lgpd.md` | Restaurada explicitamente |
| Anonimização é irreversível | ESTÁVEL | PRD 01 §3.6, L-04, Spec 02 | `lgpd.md` | Restaurada explicitamente |
| Export D+7 dias úteis; redact D+15 dias úteis | ESTÁVEL | L-02/L-03, PRD 01 | `lgpd.md` | Restaurada explicitamente |
| Audit actions LGPD e cascade de contact/conversations/messages/activities | ESTÁVEL | PRD 01 §3.6, Specs 01/06 | `lgpd.md` | Restaurada explicitamente |
| Consentimento granular marketing/transactional/profiling | ESTÁVEL | PRD 01 §3.6, L-05 | `lgpd.md` | Acrescentada porque é fonte atual e pertence ao mesmo contrato |
| WAHA Plus e engine NOWEB default; WEBJS só quando necessário | ESTÁVEL | PRD/Spec 03 | `whatsapp-waha.md` | Restaurada explicitamente |
| WAHA server recebe SHA512 da API key; cliente usa plaintext em `X-Api-Key` | ESTÁVEL | Spec 03 §2.2/§4.3 | `whatsapp-waha.md` | Restaurada explicitamente |
| Webhook WAHA usa HMAC-SHA512 timing-safe | ESTÁVEL | PRD/Spec 03 | `whatsapp-waha.md`, `security.md` | Restaurada explicitamente |
| Throttle 1msg/1.2s + jitter <=800ms; campanha 1/5s | ESTÁVEL | PRD 03 §3.7, W-01 | `whatsapp-waha.md` | Restaurada explicitamente |
| Warm-up 7–14 dias, limites diários, spinning e janela 7h–22h | ESTÁVEL | PRD 03 §3.7, W-06/W-07 | `whatsapp-waha.md` | Restaurada explicitamente |
| STOP regex histórica sem `CANCELAR` | DIVERGENTE | PRD 03 atual e W-02 incluem `CANCELAR` | `whatsapp-waha.md` | Usada versão atual mais restritiva/completa |
| Mídia outbound sempre Storage, nunca inline | DIVERGENTE | Business rule W-08 permite inline <1MB, enquanto PRD/Spec descrevem Storage como caminho canônico | `whatsapp-waha.md` | Regra modular distingue caminho canônico (Storage) da exceção W-08; não afirma proibição absoluta sem qualificação |
| `message.any`, `fromMe`, grupos sem CRM binding | ESTÁVEL | PRD 03 §3.9, W-09/W-10 | `whatsapp-waha.md` | Restaurada explicitamente |
| `recover-stuck-messages`: `sending` >5m -> failed; não toca `queued`; não reenvia; avisa Central | ESTÁVEL | W-12 + rota/teste atuais | `whatsapp-waha.md` | Preservada no nível vigente de implementação |
| DIRC antes de campo novo | ESTÁVEL | doutrina original + modelagem vigente | `data-modeling.md` | Restaurada explicitamente |
| 5 tabelas core CRM | ESTÁVEL | Spec 02 §1.1 | `data-modeling.md` | Restaurada explicitamente |
| `position_in_stage numeric` / fractional indexing | ESTÁVEL | P-05, Spec 02 | `data-modeling.md` | Restaurada explicitamente |
| `external_id` nullable em outbound `sending` | ESTÁVEL | Spec 03 schema | `data-modeling.md`, `whatsapp-waha.md` | Restaurada explicitamente |
| `type` como text + check, não enum, com exceção para vocabulário aberto | ESTÁVEL | schema/doctrine atual | `data-modeling.md` | Preservada com exceção explícita |
| `tags text[]` + GIN, `custom_fields` declarativo, `vocabulary` por pipeline | ESTÁVEL | Spec 02, P-07 | `data-modeling.md` | Restaurada explicitamente |
| Anti-patterns: FK, duplicação, evento sem consumer, cascade fantasma, trigger HTTP, service role sem tenant, `getSession`, key em query, bearer plaintext, `console.log` | ESTÁVEL | specs/doctrine/código | `CLAUDE.md`, `data-modeling.md`, `security.md` | Preservados |
| Comando Docker exato e validação HTTP 307 pós-deploy | ESTÁVEL operacional | `docs/runbooks/deploy.md` | `CLAUDE.md` aponta ao runbook; regra detalhada fica no runbook | Não duplicada no harness para evitar drift operacional |
| Caminho normal de deploy via CI/GHCR; build ad-hoc na VPS é exceção | ESTÁVEL operacional | `docs/runbooks/deploy.md` | `CLAUDE.md` + runbook | Preservada por ponteiro explícito |
| QA visual: browser real, banco fresh via baseline, side effect real quando risco está no egress | ESTÁVEL | doutrina/testes atuais | `testing-verification.md` | Preservada |
| Contagens de invariantes/E2E e quais checks eram obrigatórios numa data | SNAPSHOT | `docs/current-state.md`, `docs/harness-audit.md` | documentação de estado | Não promovida a rule |
| Higiene de branch: atualizar com main, não resetar/forçar, respeitar worktree sujo | ESTÁVEL | doutrina Git original | `git-workflow.md` | Preservada |
| Migration versionada + baseline idempotente + MANIFEST | ESTÁVEL | doutrina, self-host | `CLAUDE.md`, `database-migrations.md` | Preservada |
| Migration portável, forward-fix, backfill antes de constraint | ESTÁVEL | doutrina de migrations | `database-migrations.md` | Preservada |
| Função `public`: revogar `PUBLIC` e `anon` antes do grant mínimo | ESTÁVEL | doutrina + invariant | `database-migrations.md` | Preservada |
| Lista de nomes/skills instaladas em determinada estação | SNAPSHOT | instalação local | `skill-routing.md` apenas para política de roteamento | Não tratada como contrato eterno |
| DoD original itens 1–14 | ESTÁVEL por intenção | `CLAUDE.md`, doctrine/testes | `CLAUDE.md` | Mantido semanticamente; comandos normalizados para `pnpm` |
| `harness:check`, inspeção de diff/Git e declaração do não medido | ESTÁVEL (novo harness) | spec de convergência | `CLAUDE.md` DoD | Mantidos como extensões de segurança da reorganização |

## Conclusão da reconciliação

Nenhum grupo normativo válido do baseline fica sem destino. As diferenças deliberadas mais importantes são:

1. **Super-admin:** a Spec 01 resolve a representação como tabela `platform_admins`; o texto histórico que tratava `is_platform_admin` como decisão final não é restaurado literalmente.
2. **STOP:** a fonte atual inclui `CANCELAR`; a rule usa a versão atual.
3. **Mídia WAHA:** o caminho canônico continua Storage/URL, mas a business rule W-08 documenta exceção para payload pequeno; a rule evita uma proibição absoluta que conflitaria com essa fonte.
4. **Snapshots:** contagens, SHAs, conjunto atual de E2E e estado de branch protection permanecem em documentos de estado/auditoria e não no contrato permanente do harness.
