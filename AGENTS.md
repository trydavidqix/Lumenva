# AGENTS.md — DeskcommCRM

> Contrato portátil para qualquer agente de código (Codex, Cursor, Copilot, Amp, Claude Code e afins).

A **doutrina completa e soberana** vive em [`CLAUDE.md`](CLAUDE.md). Leia-a antes de tocar código. Este arquivo existe para dar a outras plataformas o mínimo seguro e apontar para as fontes corretas — não para manter uma segunda cópia congelada da doutrina.

## Ordem de leitura

1. [`CLAUDE.md`](CLAUDE.md) — autoridade do repositório.
2. [`.claude/rules/`](.claude/rules/) — regras modulares por domínio.
3. [`docs/index.md`](docs/index.md) — índice e precedência documental.
4. Specs/PRDs/business-rules do domínio alterado.
5. Handoffs/current-state apenas como estado temporal, conferindo `audited_against`/data.

Se este arquivo, uma skill, agent, prompt ou artefato gerado divergir do `CLAUDE.md`, **`CLAUDE.md` vence**.

## Objetivo do projeto

DeskcommCRM é um sistema operacional de vendas open source com agentes de IA nativos, multi-nicho, WhatsApp via WAHA, multi-tenant com RLS e LGPD by-design. O produto é self-host em VPS; instalação e atualização fazem parte da experiência do usuário.

## Stack

Next.js 16 App Router · React 19 · TypeScript 6 estrito · Tailwind · Supabase/Postgres · Upstash Redis · Vercel AI Gateway · WAHA Plus · Zod · Vitest · Playwright · Sentry.

Runtime: Node >=22. Gerenciador canônico: **pnpm 9.15.9**.

## Comandos canônicos

```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm lint:channels
pnpm typecheck
pnpm test:unit
pnpm test:db
pnpm test:e2e
pnpm test:harness
pnpm harness:check
pnpm gov:verify
```

`pnpm gov:verify` não substitui `test:db` para schema/RLS nem `test:e2e`/prova visual para UI.

## Mapa de rules

| Domínio | Rule |
|---|---|
| Git/worktrees | [`.claude/rules/git-workflow.md`](.claude/rules/git-workflow.md) |
| Segurança/auth/RBAC | [`.claude/rules/security.md`](.claude/rules/security.md) |
| Tenancy/RLS | [`.claude/rules/multi-tenancy.md`](.claude/rules/multi-tenancy.md) |
| API/idempotência | [`.claude/rules/api-contract.md`](.claude/rules/api-contract.md) |
| Audit/observabilidade | [`.claude/rules/audit-observability.md`](.claude/rules/audit-observability.md) |
| LGPD | [`.claude/rules/lgpd.md`](.claude/rules/lgpd.md) |
| WhatsApp/WAHA | [`.claude/rules/whatsapp-waha.md`](.claude/rules/whatsapp-waha.md) |
| Modelagem | [`.claude/rules/data-modeling.md`](.claude/rules/data-modeling.md) |
| Migrations | [`.claude/rules/database-migrations.md`](.claude/rules/database-migrations.md) |
| Testes/QA | [`.claude/rules/testing-verification.md`](.claude/rules/testing-verification.md) |
| Documentação | [`.claude/rules/documentation.md`](.claude/rules/documentation.md) |
| Graphify | [`.claude/rules/graphify.md`](.claude/rules/graphify.md) |
| Skills/agentes | [`.claude/rules/skill-routing.md`](.claude/rules/skill-routing.md) |

## Regras críticas

### Multi-tenancy

- `organization_id` de fonte confiável; nunca do body como autoridade.
- RLS em tabela tenant-aware.
- Service role filtra `organization_id` manualmente.
- Backend usa `getUser()`, não `getSession()` como prova de identidade.
- Platform admin é o papel cross-tenant canônico e usa a representação atual `platform_admins` da Spec 01.
- Mudança de tenancy/RLS exige teste cross-tenant.

### Schema

Mudança de schema via migration nova + apêndice idempotente em `supabase/baseline.sql` + linha em `supabase/migrations/MANIFEST.md`. Tipos gerados acompanham quando o contrato muda. Nunca edite migration já aplicada.

### Segurança

- segredo/token/cookie/PII não vai para log, screenshot, teste, commit ou docs;
- API key nunca em query string;
- RBAC é server-side;
- MFA segue o contrato obrigatório de admin/platform admin;
- produção, dados reais, credenciais, operação destrutiva e custo exigem autorização explícita.

### API, side effects e audit

- trigger Postgres nunca faz HTTP;
- POSTs de criação cobertos pelo contrato base usam idempotência de 24h;
- evento/side effect reexecutável precisa de idempotência apropriada;
- mutação relevante gera audit conforme o domínio;
- audit é append-only;
- input externo usa Zod;
- borda `/api/v1/` usa `ok()`/`fail()` e códigos canônicos.

### LGPD

Anonimização é preferida quando há histórico, é irreversível e precisa respeitar cascade/consentimento/audit. Os SLAs vigentes D+7 para export e D+15 para redact ficam em `lgpd.md`/business rules.

### WhatsApp

Não contorne anti-banimento, STOP/opt-out, idempotência, multi-device ou regras de recovery. Use `whatsapp-waha.md` + PRD/Spec 03.

## Git

Antes de editar, confira branch/working tree e preserve trabalho alheio. Não faça reset destrutivo, force-push, descarte, rebase/merge arriscado ou alteração de `main` sem autorização e contexto apropriados.

## Testes e prova

Alegação não é evidência. Use o check correspondente ao raio de dano:

- tipos/lint → `typecheck`/`lint`;
- comportamento unitário → `test:unit`;
- schema/RLS → `test:db`;
- UI/jornada → `test:e2e` + evidência visual quando a doutrina exigir;
- build → `build`.

Diga explicitamente o que não foi medido. Contagens de testes e estado atual do CI pertencem a snapshots, não a este contrato.

## Documentação

Não invente regra de negócio. Consulte `docs/index.md`, specs, PRDs e business-rules antes de decidir comportamento. `current-state`, handoffs, contagens e snapshots envelhecem; valide antes de tratá-los como estado atual.

A reconciliação da doutrina modular está em [`docs/harness-doctrine-matrix.md`](docs/harness-doctrine-matrix.md).

## Skills e agentes

Skills/agents são adapters de processo e especialização. Eles não substituem `CLAUDE.md`.

- `.claude/skills/DeskcommCRM/SKILL.md` — ponte Claude para a doutrina.
- `.agents/skills/DeskcommCRM/SKILL.md` — ponte Codex para a mesma doutrina.
- `.claude/agents/` — especialistas Claude (gov-loop/triagem).
- `.codex/agents/` — especialistas Codex.

Não mantenha convenção de naming/imports/comandos congelada nessas skills. Quando a doutrina mudar, atualize a fonte canônica e os adapters somente quando necessário.

## Arquivos sensíveis

- `supabase/baseline.sql`
- `supabase/migrations/`
- `supabase/migrations/MANIFEST.md`
- `lib/database.types.ts` (gerado)
- `lib/supabase/admin.ts`
- `lib/auth/public-paths.ts`
- `.env*`
- `docker-compose.traefik.yml`
- `loop/`

Leia o runbook/spec apropriado antes de alterar.

## Regra final

Trabalhe no escopo pedido, faça a menor mudança correta, preserve comportamento existente e não transforme uma suposição plausível em regra do produto.

Antes de declarar pronto, aplique a Definition of Done atual de [`CLAUDE.md`](CLAUDE.md) e `pnpm harness:check` quando a mudança tocar instruções/harness.
