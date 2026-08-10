# Database Migrations — DeskcommCRM

> Regra modular compartilhada. Em caso de conflito, `CLAUDE.md` da raiz vence.

## Regra da tripla

Toda mudança de schema precisa sair junta em:

1. migration versionada em `supabase/migrations/<timestamp>_<NNNN>_<slug>.sql`;
2. apêndice idempotente correspondente em `supabase/baseline.sql`;
3. linha em `supabase/migrations/MANIFEST.md`.

Se o contrato de tipos mudou, regenere `lib/database.types.ts` pelo fluxo canônico do projeto; não edite manualmente esse arquivo gerado.

## Por que o baseline é obrigatório

O produto é self-host. Instalação/atualização de clones depende do `baseline.sql`; uma migration que não aparece no baseline não chega corretamente aos self-hosters.

## Regras de migration

- Nunca edite migration já aplicada; crie forward-fix.
- Prefira operações idempotentes (`if not exists`, `create or replace`, guards explícitos).
- Data migration não hardcode IDs de um tenant específico.
- Corrija/backfill dados incompatíveis antes de criar constraint que os reprovaria.
- Trigger Postgres nunca faz HTTP; escreva em `event_log` e deixe worker executar side effect.
- Antes de escolher `NNNN`, verifique colisões relevantes com branches/worktrees existentes quando o fluxo exigir.

## Funções em `public`

Função nova em `public` deve remover as duas origens amplas de `EXECUTE` antes de conceder acesso mínimo:

```sql
revoke execute on function public.fn_x(...) from public, anon;
grant execute on function public.fn_x(...) to <role_necessaria>;
```

Não trate `revoke from public` e `revoke from anon` como equivalentes; o projeto exige ambos quando aplicável.

## Validação

Mudança de schema/RLS exige, conforme aplicável:

- aplicação da migration;
- baseline fresh install em Postgres descartável;
- reaplicação/update idempotente do baseline;
- `pnpm test:db`;
- teste de isolamento entre tenants;
- inspeção de invariantes relevantes.

`pnpm gov:verify` sozinho não prova alteração de schema porque não cobre `test:db`.
