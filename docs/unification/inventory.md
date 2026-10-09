# Inventário de Fontes e Ownership (Task 01)

Este inventário documenta o repositório canônico e as fontes externas descritas no plano unificador `2026-10-09-lumenva-crm-social-dropshipping-jules.md`.

## Acesso e Auditoria de SHAs

Conforme o catálogo da API Jules e sessões de auditoria reportadas (read-only), o acesso foi confirmado para todas as origens (4/4) nos SHAs exatos. A impossibilidade de uso de shell HTTPS na VM não anula a visibilidade e auditoria remota via integrações de leitura atestadas a seguir.

| Repositório | SHA Observado (`main`) no plano | Acesso e Evidência | Disposition Inicial |
| --- | --- | --- | --- |
| `trydavidqix/Lumenva` (Destino) | `3fbe74a3ff7b7a99538d1e53aa55688294b7ba99` | **OK** | Já contém CRM, Content OS, social web/worker/mcp e social-brain. |
| `trydavidqix/Lumenva-Legacy` | `6e9dbbd901445cfbec53955981a7dab6d644b9da` | **Lido; SHA confirmado em checkout Jules dedicado** | `PORT_DELTA`: CRM legados com teste sem regressão. |
| `trydavidqix/lumenva-social` | `54c3b32c934462277320874fc3630882d2855f39` | **Lido; SHA confirmado em checkout Jules dedicado** | `ADAPT`/`DEFER` parcial. Adaptação de single-user para modelo do destino. |
| `trydavidqix/lumenva-social-brain` | `80a877bde72bd6a27a5d20ff2f6231a7e0f72995` | **Lido; SHA confirmado em checkout Jules dedicado** | `RECONCILE/KEEP_DESTINATION`: reconciliar apps existentes sem duplicar. |
| `trydavidqix/Drop` | `9259af5f4ec49cbc58f2d0f9b1e2776c8c07deec` | **Lido; SHA confirmado em checkout Jules dedicado** | `IMPLEMENT`: usar contratos, estado read-only inicial, ausência de runtime. |

### Detalhes da Auditoria por Fonte

#### 1. `Lumenva-Legacy`
- **Comparação Blob API (apps/crm/):** Destino possui 2.690 blobs vs 2.540 no Legacy. Destes: 2.322 caminhos idênticos, 218 iguais em nome com conteúdo diferente, 0 exclusivos do Legacy, e 150 exclusivos do destino. *(Nota: Igualdade não prova equivalência comportamental)*.
- **Paths Auditados:** Fonte CRM em `apps/crm/app/app/` (contacts, inbox, kanban, pipelines, settings), auth via `apps/crm/lib/auth/server.ts`, Supabase server `apps/crm/lib/supabase/server.ts`, testes/invariants em `apps/crm/tests/`, migrations `supabase/migrations/`, baseline `supabase/baseline.sql`.
- **Tenant:** Fonte confirma modelo multi-tenant via RLS.
- **Licença:** MIT.

#### 2. `lumenva-social-brain`
- **Evidências Auditadas:** `packages/providers/brightbean/src/publishing.contract.test.ts`, `tests/e2e/review-fixture.spec.ts`, `apps/web/app/api/approvals/[id]/approve/route.test.ts`.
- **Funcionalidades:** Contratos de publicação e aprovação que cobrem estados remotos unknown, erro upstream, e stale approval. Auths e providers atestados: BrightBean / MoneyPrinter.
- **Licença:** Nenhum `LICENSE`/notices explícitos foram encontrados no repositório.

#### 3. `lumenva-social`
- **Paths e Capacidades:**
  - Publish: `lib/publish.ts`, `app/api/publish`, `app/api/cron/publish-scheduled`, `app/posts`, `app/compose`
  - Inbox: `lib/inbox/`, `app/api/inbox/`, `app/inbox/`
  - Automations: `lib/automation/`, `app/api/automations/`
  - Contacts/Leads: `app/api/contacts/`, `app/api/leads/`
  - Conteúdo/Referências: `lib/daily-content/`, `app/api/daily-content/`, `app/daily-content/`, `lib/reference/`, `app/api/reference/`, `app/estudo/`
- **Storage/DB:** Baseada em SQLite + Drizzle (`lib/db/schema.ts`, local `lumenva-social.db`). É arquitetura `single-user`/`single-tenant` e não tem roles de usuário no schema; "account" refere-se à conta social externa. Utiliza índice `contacts_account_platform_external_idx` para deduplicação externa.
- **Side Effects:** Facebook/Meta Graph API, OpenAI, Cloudflare image APIs, Cloudflare R2, `gallery-dl` com cookies locais (scraping Instagram), opcional crawler Google Drive.
- **Licenciamento (Blocker):** Sem arquivo LICENSE na raiz. README declara que a integração Meta é um porte de Postiz (**AGPL-3.0**).
- **Testes:** Observados (mas não executados) `tests/e2e/crawl.spec.ts` e unitários (`automation`, `image-codex`, `mcp`, `webhooks`).

#### 4. `Drop`
- **Evidências Auditadas:** Tipos e contratos em `src/contracts/orders.ts`, `src/contracts/markets.ts`, `src/contracts/events.ts`. Estes são definições tipadas e *não* implementações de runtime de serviço ativo.
- **Regras Operacionais:** Fluxo `order unknown/submitted` exige reconciliação manual; autonomia padrão configurada em estado `Simulation`.
- **Limitações e Sourcing:** Funcionalidades logísticas operacionais de sourcing e unit economics documentadas nos manuais, mas ausentes de implementação testável; sem repositório com testes / CI.
- **Licença:** Sem `LICENSE` na raiz, e nenhuma autorização explícita de reuso para bibliotecas proprietárias contidas.

---

## Checks do GitHub Actions

Baseline observado no run [36399564348](https://github.com/trydavidqix/Lumenva/actions/runs/36399564348), branch `main`, SHA `3fbe74a3ff7b7a99538d1e53aa55688294b7ba99`:

- Job `verify`: **FAIL** em `Typecheck`, com `TS2345` em `apps/website/next.config.ts(66,29)` por incompatibilidade entre tipos Next 16.3.5 e 16.3.2.
- Depois da falha, `Lint`, `Channel provider leak`, `Harness consistency`, `Unit tests` e `Kit self-host (bash)` foram **SKIPPED**; esse run não comprova a execução desses gates.
- Job `invariants`: **PASS**; a etapa `RLS isolation + governance invariants` concluiu com sucesso.
- Nenhum teste ou build foi executado no Windows. Runs de PR posteriores são evidência separada e não alteram o resultado desse baseline.
