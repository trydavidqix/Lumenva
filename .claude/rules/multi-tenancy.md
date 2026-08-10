# Multi-tenancy — DeskcommCRM

> Regra modular compartilhada. Em caso de conflito, `CLAUDE.md` da raiz vence. PRD/Spec 01 e business rules T-xx definem o contrato exato.

## Invariante principal

Toda tabela tenant-aware possui `organization_id uuid not null references organizations(id) on delete cascade` e é protegida por RLS conforme a doutrina do repositório.

Exceções são tabelas realmente globais declaradas como tal pela arquitetura; não remova `organization_id` de dado de tenant para simplificar query.

## Origem da organização

`organization_id` deve ser resolvido de fonte confiável, como:

- sessão/cookie validado;
- JWT validado;
- segredo de webhook que mapeia para tenant;
- token/path já vinculado ao tenant.

Nunca trate `organization_id` vindo do request body como autoridade de tenancy.

## RLS

- Use o helper/padrão canônico `fn_user_org_ids()` quando aplicável.
- Toda tabela nova tenant-aware precisa de política de isolamento coerente com o padrão do projeto.
- Não desative RLS para simplificar implementação.
- Mudanças em RLS exigem prova com dois tenants reais de teste, não apenas inspeção estática.

## Service role

Service role bypassa RLS. Ao usar `createAdminClient()` ou equivalente:

- filtre `organization_id` manualmente em toda query tenant-aware;
- não reutilize ID de organização não confiável;
- preserve RBAC/ownership da superfície;
- registre bypass/audit quando o contrato exigir.

## Queries, logs e métricas

Toda query que cruza tabelas tenant-aware deve preservar o mesmo tenant explicitamente. Não confie apenas em FK indireta, nome ou slug para inferir organização.

Logs/métricas de domínio também carregam `organization_id` quando não são globais, conforme T-08. Isso não autoriza usar um ID vindo de fonte não confiável apenas para preencher telemetria.

## Platform admin

O único papel de usuário cross-tenant do contrato base é o **platform admin**.

A Spec 01 resolveu uma divergência histórica: a representação canônica é a tabela `platform_admins`, não uma coluna `is_platform_admin` em `auth.users`.

- platform admin pode atravessar tenants somente pelos helpers/policies/rotas explicitamente desenhados para isso;
- ações cross-tenant deixam audit/acting-as apropriado;
- inclusão/remoção de platform admin é operação administrativa controlada, não self-service;
- não use platform-admin como desculpa para desabilitar RLS globalmente.

## Auth e RBAC

- No backend, use `getUser()`.
- Não use `getSession()` como prova server-side.
- Roles tenant canônicas: `viewer < agent < manager < admin`.
- Permissão deve ser aplicada no servidor, mesmo quando a UI esconde a ação.
- MFA e detalhes de platform admin ficam em `.claude/rules/security.md`.

## Testes obrigatórios quando tenancy muda

Uma alteração que toca tabela, policy, RPC, rota admin ou filtro de tenant deve provar pelo menos:

1. usuário da org A acessa os próprios dados;
2. usuário da org B não acessa dados da org A;
3. service role continua filtrando a org explicitamente;
4. RBAC não é enfraquecido;
5. qualquer exceção cross-tenant de platform admin está limitada ao caminho previsto.

Use `pnpm test:db`/invariantes quando schema ou RLS forem afetados.

## Fontes

- `docs/prd/01-prd-platform-base.md`
- `docs/specs/01-spec-platform-base.md`
- `docs/business-rules/00-business-rules-catalog.md` T-01…T-08
