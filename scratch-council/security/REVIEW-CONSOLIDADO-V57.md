# Revisão — Wave 11 Secret Proxy e webhook replay

Data: 2026-09-13  
Worktree: `/home/claude/src/worktrees/wave11-consent-registry-2026-09-12`  
SHA: `b7bfc843b65a7f68cd345af4db81bc74c0fded44`

## Evidência executada

- `secret-proxy.ts` valida requester/ref/op, consulta por `organization_id`, `secret_ref`, operação, actor permitido e `revoked_at IS NULL`; o valor só é entregue ao callback autorizado.
- `webhook-replay.ts` usa `INSERT ... ON CONFLICT (organization_id, provider, event_id) DO NOTHING`, retornando `claimed` ou `duplicate`; `processWebhookOnce` não chama o handler em duplicata.
- Teste executado com `WAVE11_DATABASE_URL` apontando para PostgreSQL Docker descartável:
  - `webhook-secret-proxy.integration.test.ts`: **3/3 passou**, exit `0`.
  - A prova de dois processos reais mostrou exatamente um `processed:true` e um `processed:false`.
- Nenhum segredo real foi usado; o segredo do teste é sintético.

## Achado

A migration `20260913040000_0167_wave11_replay_secret_proxy.sql` cria `integration_webhook_receipts` e `integration_secrets`, mas não habilita RLS nem cria policies/grants tenant-scoped. O isolamento hoje depende apenas dos filtros SQL do proxy/replay. Um caller com acesso direto à tabela pode ler segredos ou manipular receipts de outro tenant; não há defesa de banco equivalente às demais peças Wave 11.

**Veredito: BLOCKED para release multi-tenant.** Adicionar RLS `USING`/`WITH CHECK` via `fn_user_org_ids()` e grants mínimos (ou encapsular exclusivamente em funções SECURITY DEFINER seguras), além de teste cross-tenant com role `authenticated` sem `BYPASSRLS`. A deduplicação concorrente e o gate de actor/operação passaram localmente.

<self-check>PASS — PostgreSQL real e dois processos foram executados; ausência de RLS não foi ocultada pelo teste verde.</self-check>
