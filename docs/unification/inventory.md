# Inventário de Fontes e Ownership (Task 01)

Este inventário documenta o repositório canônico e as fontes externas descritas no plano unificador `2026-10-09-lumenva-crm-social-dropshipping-jules.md`.

## Acesso e Auditoria de SHAs

Conforme o catálogo da API Jules e sessões de auditoria reportadas (read-only), o acesso foi confirmado para todas as origens (4/4) nos SHAs exatos. A impossibilidade de uso de shell HTTPS na VM não anula a visibilidade e auditoria remota via integrações de leitura atestadas a seguir.

| Repositório | SHA Observado (`main`) no plano | Acesso e Evidência | Disposition Inicial |
| --- | --- | --- | --- |
| `trydavidqix/Lumenva` (Destino) | `3fbe74a3ff7b7a99538d1e53aa55688294b7ba99` | **OK** | Já contém CRM, Content OS, social web/worker/mcp e social-brain. |
| `trydavidqix/Lumenva-Legacy` | `6e9dbbd901445cfbec53955981a7dab6d644b9da` | **Lido (Sessão `14851053568012610551`)** | `PORT_DELTA`: CRM legados com teste sem regressão. |
| `trydavidqix/lumenva-social` | `54c3b32c934462277320874fc3630882d2855f39` | **Lido (Sessão `12310966753527398928`)** | `ADAPT`/`DEFER` parcial. Adaptação de single-user para modelo do destino. |
| `trydavidqix/lumenva-social-brain` | `80a877bde72bd6a27a5d20ff2f6231a7e0f72995` | **Lido (Sessão `1837988116472469594`)** | `RECONCILE/KEEP_DESTINATION`: reconciliar apps existentes sem duplicar. |
| `trydavidqix/Drop` | `9259af5f4ec49cbc58f2d0f9b1e2776c8c07deec` | **Lido (Sessão `2938439532013398920`)** | `IMPLEMENT`: usar contratos, estado read-only inicial, ausência de runtime. |

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
As validações configuradas na branch base (`.github/workflows/ci.yml`) são as únicas observadas, e espelham a última run reportada pelo sistema. Validações não devem ser rodadas via máquina local VM Jules.

**Run `36399564348`, Branch `main`, SHA `3fbe74a...`:**

- **Job `verify`:**
  - `pnpm typecheck`: **FAIL** herdado (Erro `TS2345` em `apps/website/next.config.ts(66,29)` devido a mismatch de tipos Next 16.3.5 vs 16.3.2). Dependências / toolchain *não devem ser alteradas* nesta Task 01.
  - `pnpm lint`: Executado no CI
  - `pnpm lint:channels`: Executado no CI
  - `pnpm test:harness && pnpm harness:check`: Executado no CI
  - `pnpm test:unit`: Executado no CI
  - `pnpm test:shell`: Executado no CI
- **Job `invariants`:**
  - `pnpm test:db`: Executado no CI com ambiente efêmero para DB isolado.