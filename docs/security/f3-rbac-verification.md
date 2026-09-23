# F3 RBAC — matriz final e verificação de segurança

Data: 2026-09-23
Base: `feat/f3-rbac` após Tasks 1–5; Task 6 não altera schema.

## Contrato verificado

Papéis humanos: `viewer < agent < manager < admin`, resolvidos por
`user_organizations` e `fn_user_role_in_org`. `ai_operator` é ator interno MCP,
fora de memberships. O único bypass cross-tenant é `platform_admins`, com MFA
quando `mfa_required` exige AAL2.

## Matriz de rotas

| Superfície           | Boundary verificado                         |               Mínimo |   Platform admin | Audit de mutação |
| -------------------- | ------------------------------------------- | -------------------: | ---------------: | ---------------: |
| Team/invite          | `requireRole`                               |                admin |              não |      rota normal |
| API tokens           | `requireRole`                               |                admin |              não |              sim |
| Conversations/media  | `requireRole` antes do admin client/storage |                agent |              não |      rota normal |
| Contacts             | `requireRole` na escrita                    |                agent |              não |              sim |
| Leads                | `requireRole`                               |                agent |              não |              sim |
| Pipelines/stages     | `requireRole`                               |              manager |              não |              sim |
| Settings/routing     | `requireRole`                               |              manager |              não |              sim |
| Nuvemshop disconnect | `requireRole`                               |                admin | opt-in explícito |              sim |
| Audit                | `requireRole`                               |              manager | opt-in explícito |          leitura |
| LGPD approve         | `requireRole`                               |                admin | opt-in explícito |              sim |
| System update        | `requirePlatformAdminApi`                   | platform admin + MFA | caminho dedicado |              sim |

O teste `apps/crm/tests/invariants/f3-rbac-route-matrix.test.ts` mantém essa
matriz como contrato estático e prova que a autorização aparece antes do
`createAdminClient()` nas superfícies que o utilizam. Também rejeita flags
`user.is_platform_admin` diretamente em rotas e ranks locais duplicados.

## Invariantes de banco

Com `TEST_DB_CONTAINER` ativo, o mesmo teste executa:

1. vetor independente para viewer, agent, manager e admin;
2. admin em uma segunda organização, sem herdar o papel da primeira;
3. membership revogada e organização ausente falham fechado;
4. ID de lead de outra organização retorna lista vazia;
5. `organization_id` forçado no INSERT é bloqueado;
6. UPDATE não move lead entre organizações.

O seed é sintético, idempotente e usa duas organizações isoladas. Sem Postgres
efêmero no Windows, a execução local confirmou os 3 contratos estáticos e
marcou os 3 SQL como skipped pelo guard explícito do harness; o CI/invariants
precisa executar a variante completa via `pnpm test:db`.

## Achados corrigidos nesta revisão

- `requireRole(..., { allowPlatformAdmin: true })` deixou de confiar apenas no
  snapshot `AuthUser.is_platform_admin`; agora consulta `resolvePlatformAdmin`,
  que valida linha ativa em `platform_admins` e AAL2 quando exigido.
- Falha do RPC de role, lookup de token MCP e erros de tokens/audit/LGPD não
  devolvem mais `error.message` do banco ao cliente; respostas são genéricas.
- `contacts/_handler.ts` usa `ROLE_RANK`/`isHumanRole` canônicos, sem tabela
  local de precedência.

Cada ponto teve RED reproduzível e GREEN após o menor fix: `require-role`
13/13, role/MCP 5/5 e matriz estática 3/3 localmente.

A varredura Codex Security `e7bb8ba6-3d10-42fb-961d-7025cddce58a` revisou o
head anterior à Task 6 e encontrou exatamente estes quatro pontos; o patch
atual contém as correções e os testes de regressão correspondentes. O resultado
da varredura é evidência histórica do RED, não uma aprovação do head final.

## SQL/migrations

Task 6 não cria migration. A ACL de `platform_admins` permanece a mudança
versionada da Task 5 (`0203`), com apêndice idempotente em `baseline.sql` e
linha no `MANIFEST.md`; não foi editada aqui.

## Limitações e gates restantes

- A validação Postgres real depende do job CI `invariants`/`vertical`; o ambiente
  Windows não tem `TEST_DB_CONTAINER`/pgvector disponível.
- `system/version` mantém leitura mínima para sessão autenticada, mas só revela
  estado operacional após resolver `platform_admins` ativo + MFA.
- A revisão independente não pôde ser executada: o runtime tentou o modelo
  fixo `gpt-5.4`, indisponível nesta conta. A revisão foi feita sequencialmente
  pelo executor e os achados acima foram testados; o CI real continua sendo o
  gate obrigatório.
