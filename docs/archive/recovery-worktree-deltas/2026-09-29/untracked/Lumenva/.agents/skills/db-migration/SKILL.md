---
name: db-migration
description: Use when changing Supabase schema, migrations, baseline, database types, or RLS policies.
---

# Workflow de migração do banco

> Regra operacional resumida. O contrato do produto pertence à fonte canônica do domínio em `docs/index.md`.

## Regra da tripla

Toda mudança de schema precisa sair junta em:

1. migration versionada em `infra/supabase/migrations/<timestamp>_<NNNN>_<slug>.sql`;
2. apêndice idempotente correspondente em `infra/supabase/baseline.sql`;
3. linha em `infra/supabase/migrations/MANIFEST.md`.

Se o contrato de tipos mudou, regenere `lib/database.types.ts` pelo fluxo canônico do projeto; não edite manualmente esse arquivo gerado.

## Por que o baseline é obrigatório

O produto é self-host. Instalação/atualização de clones depende do `baseline.sql`; uma migration que não aparece no baseline não chega corretamente aos self-hosters.

O apêndice do baseline precisa ser **idempotente e auto-curativo** para funcionar tanto em instalação fresca quanto em update de clone existente. Se uma constraint nova reprovar dados históricos, corrija/deduplique os dados **antes** de criá-la.

## Regras de migration

- Nunca edite migration já aplicada; crie forward-fix.
- Prefira operações idempotentes (`if not exists`, `create or replace`, guards explícitos).
- Data migration não hardcode IDs de um tenant específico.
- Corrija/backfill dados incompatíveis antes de criar constraint que os reprovaria.
- Trigger Postgres nunca faz HTTP; escreva em `event_log` e deixe worker executar side effect.
- Antes de escolher `NNNN`, verifique colisões relevantes com branches/worktrees existentes quando o fluxo exigir.

## Portabilidade

Migrations precisam funcionar no fluxo de clones/self-host e em runner `psql`/Supabase correspondente, não apenas numa sessão interativa específica.

- Não dependa de estado temporário de uma ferramenta proprietária.
- Evite `create temporary table ... on commit drop` fora de uma transação explicitamente controlada pelo runner; prefira CTEs/subqueries quando o mesmo resultado for possível.
- Não adicione `BEGIN`/`COMMIT` manualmente quando o runner canônico já envolve a migration em transação.
- Data migrations precisam ser genéricas para qualquer clone; não codifique ID do tenant de desenvolvimento.
- Ao repontar FKs/deduplicar, preserve histórico e confira todas as relações afetadas.

## Funções em `public`

Função nova em `public` deve remover as duas origens amplas de `EXECUTE` antes de conceder acesso mínimo:

```sql
revoke execute on function public.fn_x(...) from public, anon;
grant execute on function public.fn_x(...) to <role_necessaria>;
```

Não trate `revoke from public` e `revoke from anon` como equivalentes. Há grants herdados/default distintos; deixar um deles vivo pode expor a RPC à anon key. O invariant `tests/invariants/hardening-definer-varredura.test.ts` vigia essa classe de falha.

## Validação

Mudança de schema/RLS exige, conforme aplicável:

- aplicação da migration no ambiente de teste apropriado;
- baseline fresh install em Postgres descartável compatível;
- reaplicação/update idempotente do baseline;
- `pnpm test:db`;
- teste de isolamento entre tenants;
- inspeção de invariantes relevantes;
- estado ANTES/DEPOIS quando a migration transforma dados e a contagem/invariante precisa ser preservada.

`pnpm gov:verify` sozinho não prova alteração de schema porque não cobre `test:db`.
