# Re-revisão final — Wave 11 RLS puro

Data: 2026-09-13  
Worktree: `/home/claude/src/worktrees/wave11-consent-registry-2026-09-12`  
SHA: `fbfe6f11bbc9c53627211642805b2e8ca0286195`

## Evidência

- O teste dedicado `wave11-rls-pure.integration.test.ts` cria PostgreSQL Docker descartável, role `authenticated` com `NOSUPERUSER NOBYPASSRLS`, função `fn_user_org_ids()`, aplica a migration `0167` e concede apenas os privilégios mínimos.
- Insere dados do tenant A via conexão administrativa, muda a sessão autenticada para `app.org_ids = 'org-b'` e verifica as duas tabelas (`integration_webhook_receipts` e `integration_secrets`).
- Leitura cross-tenant retorna zero linhas; tentativas de inserir em A pelo tenant B falham com `42501` em ambas as tabelas.
- Execução independente: **1/1 teste passou**, exit `0`; container foi removido no teardown.
- Nenhum segredo real foi usado, hardcoded ou logado.

**Veredito: PASS.** O gap anterior está fechado: RLS efetivo e isolamento cross-tenant foram provados sob role não-superuser, não apenas inferidos da policy SQL.

<self-check>PASS — teste dedicado executado com PostgreSQL real descartável e resultado confirmado.</self-check>
