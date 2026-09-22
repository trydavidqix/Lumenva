# F1 — Identity mapping compatível com F2

Status: infraestrutura implementada; backfill e dual-read permanecem desligados.

## Contrato canônico

F2 já possui `public.identity_user_mappings` e
`public.resolve_firebase_identity(text)`. A tabela é a única fonte de verdade
para a resolução runtime:

```text
Firebase session
  -> firebase_uid
  -> identity_user_mappings.firebase_uid
  -> identity_user_mappings.user_id (UUID interno/legacy)
  -> user_organizations.active membership
  -> TenantContext
```

F1 não recria nem duplica essa tabela. A migration `0202` só adiciona metadata
operacional (`email_snapshot`, timestamps e unicidade do UUID interno), protege
as chaves da mapping contra alteração e preserva os grants do resolver F2.

Email, body/query/path, frontend state e custom claims editáveis nunca são
autoridade de identidade ou membership.

## Candidatos pendentes

`identity_user_mapping_candidates` é uma fila privada de reconciliação. Ela
recebe identidades sem correspondência confirmada, colisões, usuários deletados
ou membership ausente. Candidatos:

- não são consultados por `resolve_firebase_identity`;
- não têm grants para `anon`, `authenticated`, `service_role`, `app_runtime`,
  `worker_runtime` ou `platform_admin_runtime`;
- só são legíveis por `migration_admin` para revisão offline;
- nunca concedem acesso por si mesmos.

## Backfill e auditoria

`backfill_identity_user_mappings(jsonb, uuid, boolean)` é uma função de
migration-only:

- `p_dry_run` default `true`;
- `p_run_id` torna a auditoria idempotente por identidade/ação;
- correspondências confirmadas entram na tabela canônica F2;
- pendências entram somente na tabela de candidatos;
- `identity_user_mapping_audit` é append-only;
- apenas `migration_admin` pode executar o backfill.

Não há backfill de dados reais nesta mudança. O payload deve ser produzido por
um processo de matching aprovado, com vínculo de provider verificável; email
sozinho não fecha uma correspondência.

## Segurança e rollback

- mapping, candidates, audit e flags têm RLS;
- tabelas de reconciliação não têm acesso runtime;
- `firebase_dual_read` nasce `false`;
- a resolução Firebase existente continua funcionando sem ativar dual-read;
- rollback desabilita a infraestrutura de reconciliação e preserva as linhas
  existentes, sem apagar identidades ou memberships;
- nenhuma mudança toca produção, Firebase Auth real, secrets ou tenant data.

## Relação com F2

F2 continua responsável por `TenantContext`, membership ativo, RLS
transaction-local e isolamento de tenant. F1 só fornece a ponte externa
`firebase_uid -> user_id`; não autoriza organização nem substitui a resolução
de membership.
