---
name: Lumenva
description: Ponte para a doutrina viva do Lumenva. Use ao escrever, revisar ou responder perguntas sobre código, schema, tenancy, segurança, API, LGPD, WhatsApp/WAHA, modelagem, self-host, testes ou Definition of Done. Leia `CLAUDE.md` e as rules aplicáveis; esta skill não substitui a fonte da verdade.
---

# Lumenva — repo skill

> **Autoridade:** `CLAUDE.md` da raiz. Não confie em snapshots gerados, contagens antigas ou convenções copiadas para esta skill quando a doutrina atual puder ser lida diretamente.

## Abertura obrigatória

1. Leia `CLAUDE.md` antes de tocar código.
2. Leia `AGENTS.md` quando precisar do contrato portátil/visão rápida do harness.
3. Carregue as rules aplicáveis em `.claude/rules/` quando a plataforma puder lê-las; caso contrário, siga a doutrina equivalente via `CLAUDE.md`/`AGENTS.md`.
4. Consulte a spec/PRD/business-rule/doc canônico do domínio antes de inventar comportamento.
5. Se estiver reconciliando regra antiga, consulte `docs/harness-doctrine-matrix.md`.

## Rules por domínio

- Git/branches/worktrees: `.claude/rules/git-workflow.md`
- Segurança/segredos/auth/RBAC: `.claude/rules/security.md`
- Tenant/RLS/service role: `.claude/rules/multi-tenancy.md`
- API/idempotência/rate limit: `.claude/rules/api-contract.md`
- Audit/observabilidade: `.claude/rules/audit-observability.md`
- LGPD/dados pessoais: `.claude/rules/lgpd.md`
- WhatsApp/WAHA: `.claude/rules/whatsapp-waha.md`
- Modelagem de dados: `.claude/rules/data-modeling.md`
- Schema/migrations: `.claude/rules/database-migrations.md`
- Testes/QA/evidência: `.claude/rules/testing-verification.md`
- Documentação: `.claude/rules/documentation.md`
- Grafo local: `.claude/rules/graphify.md`
- Skills/agentes: `.claude/rules/skill-routing.md`

## Três invariantes que custam caro quando esquecidas

**Multi-tenancy:** `organization_id` vem de fonte confiável; RLS em tabela tenant-aware; service role filtra a organização manualmente; backend usa `getUser()`, nunca `getSession()` como prova de identidade.

**Schema:** mudança de banco via migration versionada + apêndice idempotente em `supabase/baseline.sql` + linha no `supabase/migrations/MANIFEST.md`; tipos gerados acompanham quando o contrato muda.

**Self-host:** uma mudança que funciona no ambiente do dev e quebra instalação/update fresco é bug de produto. Não torne serviço pago obrigatório, não deixe env crítica sem contrato e não confunda sonda verde com jornada real verde.

## Antes de dizer pronto

Use evidência compatível com o raio de dano. `pnpm gov:verify` não substitui `pnpm test:db` para schema/RLS nem `pnpm test:e2e`/prova visual para UX. Declare também o que não foi medido.

## Não objetivos desta skill

- não define naming convention de arquivos;
- não define estilo de imports;
- não inventa `/fix-bug`, `/add-module` ou outros comandos;
- não replica a Definition of Done inteira;
- não substitui `CLAUDE.md`, rules nem specs.
