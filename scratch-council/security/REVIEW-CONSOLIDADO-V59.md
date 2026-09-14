# Re-revisão — Wave 11 Secret Proxy + webhook replay RLS

Data: 2026-09-13  
Worktree: `/home/claude/src/worktrees/wave11-consent-registry-2026-09-12`  
SHA: `256ef7ee293c62c9ca332f717cc3d386e4cac5f8`

## Evidência

- A migration `20260913040000_0167_wave11_replay_secret_proxy.sql` agora habilita RLS nas duas tabelas, cria policies `FOR ALL TO authenticated` com `USING` e `WITH CHECK` via `fn_user_org_ids()`, revoga privilégios de `PUBLIC` e concede apenas `SELECT, INSERT` a `authenticated`.
- O teste existente `webhook-secret-proxy.integration.test.ts` foi executado com `WAVE11_DATABASE_URL` em PostgreSQL descartável: **3/3 passou**, exit `0`; a prova de dois processos mostrou exatamente um `processed:true` e um `processed:false`.
- O teste cobre autorização actor/operação do Secret Proxy e idempotência de replay, mas usa conexão administrativa para essas operações; não executa leitura cross-tenant com role `authenticated`.
- Não há teste de RLS dedicado no commit `256ef7ee` (o commit altera somente a migration). Portanto, embora a policy SQL esteja corretamente desenhada, a alegação “zero vazamento cross-tenant provado” não foi reproduzida pelo teste executado.
- Nenhum segredo real foi usado, hardcoded ou logado.

**Veredito: PASS-CONDICIONAL.** O gap de ausência de RLS foi corrigido no schema e a prova funcional/replay passa. Para PASS definitivo, adicionar/executar teste com role `NOSUPERUSER NOBYPASSRLS` e `app.org_ids` que confirme leitura vazia e escrita `42501` entre tenants para ambas as tabelas.

<self-check>PASS — migration e teste foram verificados independentemente; policy presente não foi confundida com prova cross-tenant executada.</self-check>
