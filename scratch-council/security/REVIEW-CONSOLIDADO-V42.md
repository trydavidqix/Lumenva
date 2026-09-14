# Revisão consolidada — Wave 3 Handoff, Wave 12 Provenance e Wave 7/8 Studio Evals

Data: 2026-09-13  
Método: leitura read-only e testes independentes no worker.

## Fornalha — Wave 3 Handoff Pack

SHA `67448ad81cbb1de180a071baa4e0dcbe46a3d8bf`, worktree `wave3-session-runtime-skeleton-2026-09-12`. Redaction é sempre aplicada e `redacted` é fixo em `true`; tentativa de desligar via caller foi testada.

Resultado: **1 arquivo, 3 testes passaram, exit 0**. **PASS.**

## Fornalha — Wave 12 provenance PostgreSQL/RLS

SHA `abab8981` (`fix(wave12): persist provenance with tenant RLS`), worktree `wave12-marketing-content-2026-09-13`. Migration cria PK `(organization_id, content_id)` e RLS com `fn_user_org_ids`; store usa `ON CONFLICT (organization_id, content_id)` e leitura tenant-scoped.

Executei `content-provenance.rls.integration.test.ts` com PostgreSQL descartável, role `content_provenance_rls_test` `NOSUPERUSER NOBYPASSRLS` e env `CONTENT_PROVENANCE_DATABASE_URL`. Resultado: **1 arquivo, 1 teste passou, exit 0**; concorrência, leitura/escrita cross-tenant foram provadas. **PASS.** Container removido.

## Vértice — Wave 7/8 Studio Editor Evals/Variants

Worktree `wave7-8-studio-editor-2026-09-12`, HEAD `c15543b6` (`test(wave7): prove concurrent edit application`), com `studio-editor-evals-variants.integration.test.ts` não commitado e `studio-editor-repository.ts` modificado. O teste cria PostgreSQL descartável, persiste eval e variant mix concorrentes e verifica uma linha por chave.

Resultado: **1 arquivo, 1 teste passou, exit 0**; container removido pelo próprio teste. **PASS-CONDICIONAL** — a prova é do estado sujo local, não de SHA versionado.

## Veredito

- Wave 3 Handoff: **PASS**.
- Wave 12 Provenance/RLS: **PASS**.
- Studio Editor Evals/Variants: **PASS-CONDICIONAL** — commitar o código/teste antes de promover.

SELF-CHECK: PASS — SHAs/status conferidos, RLS real executado, testes reais registrados e nenhum segredo exposto.
