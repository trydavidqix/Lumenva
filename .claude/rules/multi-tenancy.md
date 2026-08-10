# Multi-tenancy — DeskcommCRM

> Regra modular compartilhada. Em caso de conflito, `CLAUDE.md` da raiz vence.

## Invariante principal

Toda tabela tenant-aware possui `organization_id uuid not null references organizations(id) on delete cascade` e é protegida por RLS conforme a doutrina do repositório.

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
- preserve RBAC e audit da superfície que chamou a operação.

## Queries cruzadas

Toda query que cruza tabelas tenant-aware deve preservar o mesmo tenant explicitamente. Não confie apenas em uma FK indireta ou em nome/slug para inferir organização.

## Auth e RBAC

- No backend, use `getUser()`.
- Não use `getSession()` como prova server-side.
- Roles canônicas: `viewer < agent < manager < admin`.
- Permissão deve ser aplicada no servidor, mesmo quando a UI esconde a ação.

## Testes obrigatórios quando tenancy muda

Uma alteração que toca tabela, policy, RPC, rota admin ou filtro de tenant deve provar pelo menos:

1. usuário da org A acessa os próprios dados;
2. usuário da org B não acessa dados da org A;
3. service role continua filtrando a org explicitamente;
4. RBAC não é enfraquecido.

Use `pnpm test:db`/invariantes quando schema ou RLS forem afetados.
