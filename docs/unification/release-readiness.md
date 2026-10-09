# Relatório de Prontidão - Lumenva CRM, Social e Dropshipping

## Task 13: Sourcing, custo e margem sem checkout

**Estado Atual:** `BLOCKED_BASELINE`

A lógica intrínseca e pura da Task 13 foi finalizada, testada e validada (passagem na suíte unitária de `dropshipping/sourcing` garantida via hook `vertical`). O sistema corretamente valida `calculateEconomics` contra falsificação de provenance (fixado localmente em `estimated`), processa margens exatas e rejeita timestamps/currencies inválidas.

No entanto, as suítes de teste de integração e canônicas ativas na `main` estão impedindo o *green flag* da integração plena desta task.

### Bloqueios Globais Fora de Escopo (`BLOCKED_BASELINE`)

As seguintes falhas não foram causadas pelas modificações introduzidas pela Task 13, mas pertencem a domínios protegidos fora da *allowlist* da atual sessão. Logo, nenhuma intervenção foi feita nestes arquivos:

1. **RBAC Matrix / Team Revoke / Role Change (`tests/unit/rbac-matrix.test.ts`, `team-revoke.test.ts`, `team-role-change.test.ts`)**
   - Causam falhas repetitivas de `AssertionError: expected 500 to be 409` e outras tipagens por ausência do mock funcional/schema correto do supabase ou incompatibilidades na resolução.
2. **Auth Falha Alto (`tests/unit/auth-falha-alto.test.ts`)**
   - Asserções mal sucedidas com `cookieStore.get is not a function`, indicando vazamento ou erro em helpers/config de autenticação injetada (Firebase proxy).
3. **MCP Read Governance (`tests/unit/mcp-read-governance.test.ts`)**
   - Problemas na extração das shapes dos *get_conversations* ou identidades não resolvidas corretamente resultando em asserções falhas (`expected null to be 'Alice'`).
4. **Auth Rate Limiting (`app/actions/auth/signInWithPassword.test.ts`)**
   - Lógica de falha/rate limits estourando fora da quantidade esperada na simulação.
5. Outras inconstâncias menores em migrations (`baseline-unique-index-idempotency.test.mjs`).

### Resolução Pendente
A integração da Task 13 fica em suspenso na respectiva branch aguardando o reparo global da branch principal e de seus *workflows* base (por parte da engenharia raiz da plataforma), de forma que todos os *checks* possam eventualmente ser liberados na PR.
