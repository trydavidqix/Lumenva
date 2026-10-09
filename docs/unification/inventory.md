# Inventário de Fontes e Ownership (Task 01)

Este inventário documenta o repositório canônico e as fontes externas descritas no plano unificador `2026-10-09-lumenva-crm-social-dropshipping-jules.md`.

## Acesso e Auditoria de SHAs

Conforme o catálogo da API Jules, existem conexões configuradas e sessões de auditoria alocadas para as fontes.

| Repositório | SHA Observado (`main`) no plano | Acesso e Evidência | Disposition Inicial |
| --- | --- | --- | --- |
| `trydavidqix/Lumenva` (Destino) | `3fbe74a3ff7b7a99538d1e53aa55688294b7ba99` | **OK** | Já contém CRM, Content OS, social web/worker/mcp e social-brain. |
| `trydavidqix/Lumenva-Legacy` | `6e9dbbd901445cfbec53955981a7dab6d644b9da` | Auditoria pendente na sessão Jules `14851053568012610551`. | `PORT_DELTA`: CRM legados com teste sem regressão. (Valores exatos de diff pendentes de medição). |
| `trydavidqix/lumenva-social` | `54c3b32c934462277320874fc3630882d2855f39` | **Lido (Sessão `12310966753527398928`)** | `ADAPT`/`DEFER` parcial. Código é single-user local SQLite. |
| `trydavidqix/lumenva-social-brain` | `80a877bde72bd6a27a5d20ff2f6231a7e0f72995` | Auditoria pendente na sessão Jules `1837988116472469594`. | `RECONCILE/KEEP_DESTINATION`: reconciliar apps existentes sem duplicar. |
| `trydavidqix/Drop` | `9259af5f4ec49cbc58f2d0f9b1e2776c8c07deec` | Auditoria pendente na sessão Jules `2938439532013398920`. | `IMPLEMENT`: usar contratos, estado read-only inicial. |

### Detalhes de Auditoria: `lumenva-social`

A fonte `trydavidqix/lumenva-social` (SHA `54c3b32c934462277320874fc3630882d2855f39`) foi verificada com sucesso, apresentando as seguintes capacidades e restrições:

- **Paths e Capacidades:**
  - Publish: `lib/publish.ts`, `app/api/publish`, `app/api/cron/publish-scheduled`, `app/posts`, `app/compose`
  - Inbox: `lib/inbox/`, `app/api/inbox/`, `app/inbox/`
  - Automations: `lib/automation/`, `app/api/automations/`
  - Contacts/Leads: `app/api/contacts/`, `app/api/leads/`
  - Conteúdo/Referências: `lib/daily-content/`, `app/api/daily-content/`, `app/daily-content/`, `lib/reference/`, `app/api/reference/`, `app/estudo/`
- **Storage/DB:** Baseada em SQLite + Drizzle (`lib/db/schema.ts`, local `lumenva-social.db`). É arquitetura `single-user`/`single-tenant` e não tem roles de usuário no schema; "account" refere-se à conta social externa. Utiliza índice `contacts_account_platform_external_idx` para deduplicação externa.
- **Side Effects e Integrações:** Facebook/Meta Graph API, OpenAI, Cloudflare image APIs, Cloudflare R2, `gallery-dl` com cookies locais (scraping Instagram), opcional crawler Google Drive.
- **Licenciamento (Blocker):** Não há arquivo LICENSE na raiz, mas o README declara que a integração Meta foi portada do projeto Postiz, que está sob a licença **AGPL-3.0**. O código correspondente *não* deve ser copiado diretamente para evitar conflitos de licenciamento sem análise apropriada.
- **Testes:** Foram observados (porém não executados) `tests/e2e/crawl.spec.ts`, e os testes de unidade em `tests/unit/{automation,image-codex,mcp,webhooks}.test.ts`.

Nenhuma suposição de compatibilidade multiempresa/tenant ou CRM unificado pode ser herdada deste projeto. As capacidades descritas deverão ser adaptadas seguindo as regras restritas das Tasks 06, 08 e 09 (ADAPT/DEFER), refatorando estritamente os *deltas* aplicáveis ao modelo canônico multiempresa do destino.

## Checks do GitHub Actions
As validações configuradas na branch base (`.github/workflows/ci.yml`) são as únicas a serem observadas, sem execução local no Windows.

**Run `36399564348`, Branch `main`, SHA `3fbe74a...`:**

- **Job `verify`:**
  - `pnpm typecheck`: **FAIL** herdado (`TS2345` em `apps/website/next.config.ts(66,29)`: erro de tipagem no Next 16.3.5 vs 16.3.2).
  - `pnpm lint`: Executado no CI
  - `pnpm lint:channels`: Executado no CI
  - `pnpm test:harness && pnpm harness:check`: Executado no CI
  - `pnpm test:unit`: Executado no CI
  - `pnpm test:shell`: Executado no CI
- **Job `invariants`:**
  - `pnpm test:db`: Executado no CI com base de banco efêmera.