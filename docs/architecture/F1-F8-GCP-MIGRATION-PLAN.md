# Lumenva — plano F1–F8 para Google Cloud

Status: F1 identity-mapping infrastructure implemented; F2 tenant isolation
already merged. F3–F8 remain design/deployment work and are not activated by
this change.

## Gates

- Nenhum dado real, secret, deploy ou produção nesta fase.
- F1 exige mapping auditável, backfill dry-run, rollback e revisão independente.
- F2 continua sendo a autoridade de membership, `TenantContext` e RLS.
- Cada mudança futura de domínio precisa de migration, baseline idempotente,
  MANIFEST, teste de isolamento e rollback.

## Dependência

```text
F0 ambiente -> F1 identidade -> F2 tenant isolation -> F3 RBAC
                                      -> F4 MFA / F5 storage-realtime
                                      -> F6 bancos por domínio
                                      -> F7 adapters -> F8 cutover
```

Esta fase entrega apenas a ponte F1 sobre o contrato F2 existente. Não inclui
Firebase session handler, backfill real, dual-read ativo, Cloud SQL cutover,
MFA, storage, realtime, adapters ou DNS.

## Artefatos F1

- `supabase/migrations/20260922204356_0202_f1_identity_mapping_v2.sql`
- apêndice correspondente em `supabase/baseline.sql`;
- `supabase/migrations/MANIFEST.md`;
- `apps/crm/tests/invariants/f1-identity-mapping.test.ts`;
- `docs/architecture/F1-IDENTITY-TENANT-DESIGN.md`.

O protótipo de integração Maestri Codex Cloud do commit `4994efe7` não faz
parte deste plano nem desta branch.
