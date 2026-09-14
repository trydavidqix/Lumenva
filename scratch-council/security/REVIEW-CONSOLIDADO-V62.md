# Review Consolidado V62 — Wave 6 Client Portal Flow

Data: 2026-09-13  
Escopo: revisão read-only da peça `client-portal-flow` do Telar no worker.

## Identidade e evidência

- Worktree: `/home/claude/src/worktrees/wave6-studio-comercial-2026-09-12`
- SHA observado: `2a3810552943d741304e60c1a7f4a698620c98b1` (`feat(wave6): add durable client portal decisions`)
- `git status --short`: há um arquivo não commitado, `apps/crm/lib/studio/client-portal-token-store-rls.integration.test.ts`.
- `maestri check Telar`: indisponível nesta sessão (`No connection to 'Telar'`); não foi possível confirmar um SHA posterior chamado `client-portal-flow`.

## Testes executados

1. `apps/crm/lib/studio/client-portal-flow.integration.test.ts`, com PostgreSQL Docker descartável e `STUDIO_DATABASE_URL` configurada: **PASS**, 1 arquivo / 1 teste, exit 0. O teste comprovou inserção, idempotência básica por `(organization_id, decision_id)` e rejeição de organização diferente.
2. `apps/crm/lib/studio/client-portal-token-store-rls.integration.test.ts`: **PASS**, 1 arquivo / 1 teste, exit 0. O próprio teste subiu e removeu PostgreSQL descartável; com role `authenticated`, comprovou visibilidade apenas da organização autorizada e rejeição de escrita cross-tenant contra a migration `20260913150000_0166_studio_client_portal_tokens.sql`.

## Achados

### Pontos fechados

- Tokens persistem em PostgreSQL; a migration usa hash SHA-256 em formato hexadecimal, escopo limitado por `CHECK`, expiração/revogação e `single_use`.
- A migration habilita RLS e aplica `fn_user_org_ids()` em `USING` e `WITH CHECK`; o teste real com role não-superuser comprovou isolamento no token store.
- O fluxo usa `tokenStore.consume` antes da decisão e falha com `client_portal_denied` quando o token não é aceito.
- A decisão tem chave primária composta `(organization_id, decision_id)` e `ON CONFLICT DO NOTHING`, evitando duas linhas para o mesmo identificador dentro do tenant.

### Gaps que impedem PASS pleno

1. **Redação não demonstrada:** `client-portal-flow.ts:4` grava `input.comment` diretamente no campo chamado `comment_redacted`. Não há redactor, normalização de PII ou prova de que o caller só fornece texto já redigido. O nome da coluna não é enforcement.
2. **Decisions sem RLS na migration:** `20260913050000_0168_client_portal_decisions.sql` cria `studio_client_decisions`, mas não habilita RLS, não cria policy e não concede acesso tenant-scoped. O teste principal cria uma tabela manualmente com conexão administrativa e portanto não prova isolamento de decisões.
3. **Teste principal fail-open:** `client-portal-flow.integration.test.ts:5` retorna silenciosamente quando `STUDIO_DATABASE_URL` não existe. Assim, a execução sem banco aparece verde sem executar persistência, idempotência ou tenant check.
4. **Idempotência versus token single-use:** `submit` consome o token antes de consultar/reutilizar uma decisão existente. Um retry do mesmo `decisionId` pode ser negado pelo consumo single-use antes de alcançar o `ON CONFLICT`; o contrato de retry idempotente precisa ser definido e testado com token de uso único.
5. **Validação de entrada incompleta:** o fluxo valida apenas `decisionId`, `actorRef`, `receiptId` e que `evidenceRefs` é array. A decisão, escopo, IDs, referências de evidência e limites de tamanho dependem de checks externos ou do banco; não há validação explícita no boundary.

## Veredito

**PASS-CONDICIONAL — Wave 6 client-portal-flow.**

Há prova local real de PostgreSQL para o fluxo e prova real de RLS para o token store, sem secret hardcoded observado. Ainda não é PASS de segurança consolidado: aplicar RLS/policy ao store de decisões, impor redação de `comment` (ou provar um boundary redactor obrigatório), tornar o teste fail-closed quando a URL estiver ausente e esclarecer/testar retry com token `single_use`.

Wave 9 continua sendo a única Wave sem qualquer peça em PASS real histórico, conforme o consolidado V61; aguardo a entrega para revisão independente.

SELF-CHECK: PASS
