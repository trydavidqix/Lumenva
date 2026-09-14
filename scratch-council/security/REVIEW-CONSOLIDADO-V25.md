# Revisão consolidada — Operating Core Receipts e Consent Publication

Data: 2026-09-13  
Método: revisão read-only no worker e testes independentes com PostgreSQL descartável.

## 1. Vértice — Wave 1 receipts + RLS

Worktree: `/home/claude/src/worktrees/business-os-wave-1-operating-core-2026-09-11`. A migration `20260913140000_0165_operating_core_receipts.sql` e `receipt-store.ts/.test.ts` aparecem como **não rastreados** no `git status`; não estão incluídos no HEAD `f678e654` apesar de existirem no disco.

**PASS-CONDICIONAL.** A migration cria PK/unique por `(organization_id, idempotency_key)`, FK de organização, checks de status/níveis e RLS com `fn_user_org_ids()` (`:3-34`). Probe independente em PostgreSQL descartável, com role `authenticated` não-superuser e claims `org_ids`, confirmou insert do tenant permitido (`ALLOWED_INSERT_EXIT=0`) e rejeição cross-tenant por RLS (`CROSS_TENANT_INSERT_EXIT=1`, `row-level security policy`).

O store usa `ON CONFLICT (organization_id, idempotency_key)` e leituras filtradas por tenant. Falta transformar os arquivos em commit rastreado e executar o teste de integração concorrente do próprio store; a prova feita foi RLS/SQL direta.

## 2. Fornalha — consent antes de publicação (`8e636048`)

**PASS-CONDICIONAL.** `publishContentItem` só atualiza o item e cria job depois de `assertPublicationConsent` (`publication-service.ts:85-123`). Consentimento ausente, tenant divergente, status diferente de `GRANTED`, ainda não vigente, revogado ou expirado lança `PublicationConsentError`; nenhum update/job ocorre antes do gate.

Teste independente contra PostgreSQL descartável: `content-os-publication-consent.integration.test.ts` passou com **1 arquivo, 1 teste, `TEST_EXIT=0`** após criação da tabela compatível. O teste confirmou duas publicações concorrentes com consentimento já revogado, zero updates e zero jobs. A primeira tentativa contra a migration completa falhou por schema/defaults inadequados no harness descartável; a execução final usou tabela equivalente para o teste.

Limite importante: o teste chama `revoke` antes do `Promise.all`; não simula revogação ocorrendo entre leitura do consentimento e publicação. Também há uma janela TOCTOU entre `findConsent` e `updateContentItem`; para garantia forte, exigir transação/lock ou revalidação atômica no mesmo commit de publicação.

Não foram encontrados secrets hardcoded nem logging sensível nas duas peças.

## Veredito final

- Receipts/RLS Vértice: **PASS-CONDICIONAL** — RLS real provado, mas artefatos estão não rastreados e concorrência do store ainda não foi executada como teste integrado.
- Consent Publication Fornalha: **PASS-CONDICIONAL** — fail-closed revogado/expirado confirmado e teste concorrente passa, mas revogação durante a janela TOCTOU não é coberta.

SELF-CHECK: PASS — código real lido, probes/testes executados, containers removidos e nenhum segredo exposto.
