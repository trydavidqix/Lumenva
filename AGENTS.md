# AGENTS.md — DeskcommCRM

> Contrato portátil para agentes de código (Codex, Cursor, Copilot, Amp, Claude Code e afins).

A **doutrina completa e soberana** vive em [`CLAUDE.md`](CLAUDE.md). Leia-a antes de tocar código. Este arquivo existe para dar a outras plataformas o mínimo seguro e apontar para as fontes corretas — não para manter uma segunda cópia congelada da doutrina.

## Ordem de leitura

1. [`CLAUDE.md`](CLAUDE.md) — autoridade do repositório.
2. [`.claude/rules/`](.claude/rules/) — regras modulares por domínio.
3. [`docs/index.md`](docs/index.md) — índice e precedência documental.
4. [`docs/ai/README.md`](docs/ai/README.md) — **contexto rápido para agentes**: mapa do projeto, arquitetura, estado atual, riscos conhecidos e protocolo de auditoria. Use para acelerar descoberta, mas valide snapshots contra o código/fonte canônica.
5. Specs/PRDs/business-rules do domínio alterado.
6. Handoffs/current-state apenas como estado temporal, conferindo data/SHA antes de tratá-los como atuais.

Se este arquivo, uma skill, agent, prompt ou artefato gerado divergir do `CLAUDE.md`, **`CLAUDE.md` vence**.

## Objetivo do projeto

DeskcommCRM é um sistema operacional de vendas open source com agentes de IA nativos, multi-nicho, WhatsApp via WAHA, multi-tenant com RLS e LGPD by-design. O produto é self-host em VPS; instalação e atualização fazem parte da experiência do usuário.

## Stack

Next.js App Router · React · TypeScript estrito · Tailwind · Supabase/Postgres · Upstash Redis · Vercel AI Gateway · WAHA Plus · Zod · Vitest · Playwright · Sentry.

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

## Regras críticas

### Multi-tenancy

- `organization_id` vem de fonte confiável; nunca do body como autoridade.
- RLS protege tabela tenant-aware.
- Service role filtra `organization_id` manualmente.
- Backend usa `getUser()`, não `getSession()` como prova de identidade.
- Mudança de tenancy/RLS exige teste cross-tenant.

Detalhe: [`.claude/rules/multi-tenancy.md`](.claude/rules/multi-tenancy.md).

### Schema

Mudança de schema via:

1. migration nova;
2. apêndice idempotente em `supabase/baseline.sql`;
3. linha em `supabase/migrations/MANIFEST.md`.

Tipos gerados acompanham quando o contrato muda. Nunca edite migration já aplicada.

Detalhe: [`.claude/rules/database-migrations.md`](.claude/rules/database-migrations.md).

### Segurança

- segredo/token/cookie/PII não vai para log, screenshot, teste, commit ou docs;
- API key nunca em query string;
- RBAC é server-side;
- produção, dados reais, credenciais, operação destrutiva e custo exigem autorização explícita.

Detalhe: [`.claude/rules/security.md`](.claude/rules/security.md).

### API, side effects e audit

- trigger Postgres nunca faz HTTP;
- evento/side effect reexecutável precisa de idempotência apropriada;
- mutação relevante gera audit conforme o contrato do domínio;
- input externo usa Zod;
- borda `/api/v1/` usa `ok()`/`fail()` e códigos canônicos.

Detalhes:

- [`.claude/rules/api-contract.md`](.claude/rules/api-contract.md)
- [`.claude/rules/audit-observability.md`](.claude/rules/audit-observability.md)
- [`.claude/rules/lgpd.md`](.claude/rules/lgpd.md)
- [`.claude/rules/whatsapp-waha.md`](.claude/rules/whatsapp-waha.md)
- [`.claude/rules/data-modeling.md`](.claude/rules/data-modeling.md)

## Git

Antes de editar, confira branch/working tree e preserve trabalho alheio. Não faça reset destrutivo, force-push, descarte, rebase/merge arriscado ou alteração de `main` sem autorização e contexto apropriados.

Detalhe: [`.claude/rules/git-workflow.md`](.claude/rules/git-workflow.md).

## Testes e prova

Alegação não é evidência. Use o check correspondente ao raio de dano:

- tipos/lint → `typecheck`/`lint`;
- comportamento unitário → `test:unit`;
- schema/RLS → `test:db`;
- UI/jornada → `test:e2e` + evidência visual quando a doutrina exigir;
- harness/instruções → `test:harness` + `harness:check`;
- build → `build`.

Diga explicitamente o que não foi medido.

Detalhe: [`.claude/rules/testing-verification.md`](.claude/rules/testing-verification.md).

## Documentação

Não invente regra de negócio. Consulte `docs/index.md`, specs, PRDs e business-rules antes de decidir comportamento. `current-state`, handoffs, contagens e snapshots envelhecem; valide antes de tratá-los como estado atual.

Detalhe: [`.claude/rules/documentation.md`](.claude/rules/documentation.md).

## Skills e agentes

Skills/agents são adapters de processo e especialização. Eles não substituem `CLAUDE.md`.

- `.claude/skills/DeskcommCRM/SKILL.md` — ponte Claude para a doutrina.
- `.agents/skills/DeskcommCRM/SKILL.md` — ponte Codex para a mesma doutrina.
- `.claude/agents/` — especialistas Claude.
- `.codex/agents/` — especialistas Codex.

Não mantenha convenção de naming/imports/comandos congelada nessas skills. Quando a doutrina mudar, atualize a fonte canônica e os adapters somente quando necessário.

Detalhe: [`.claude/rules/skill-routing.md`](.claude/rules/skill-routing.md).

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

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
