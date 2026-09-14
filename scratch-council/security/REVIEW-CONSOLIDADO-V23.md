# Revisão consolidada — Wave 11 Consent e Wave 13 Hermes Registry

Data: 2026-09-13  
Método: leitura read-only no worker e execução independente dos testes; PostgreSQL descartável usado nas integrações.

## 1. Fornalha — Consent Registry / Memory Gate (`52166070`)

**BLOCKED.** A implementação persistente usa SQL parametrizado, unique `(organization_id, consent_id)` e `canContact` exige `status='GRANTED'`, `granted_at <= now()` e `retention_until > now()` (`consent-registry.ts:58-99`), portanto revogado/expirado nega no caminho normal. O gate assíncrono nega ausência de reader, consentimento falso e falha nas demais políticas (`consent-memory-gate.ts:35-49`).

O teste independente com PostgreSQL descartável falhou: a migration `20260913110000_contact_consents.sql` habilita RLS e cria policy para o role `authenticated`, mas esse role/helper `fn_user_org_ids()` não existem num banco novo sem o baseline. Mesmo com helper mínimo, o teste conectou como superuser `postgres`, que ignora RLS; o caso cross-tenant esperado como `42501` foi aceito e o Vitest terminou com `Test Files 1 failed (1)`, `Tests 1 failed (1)`, `TEST_EXIT=1`.

Assim, concorrência de dois `register` foi iniciada pelo teste, mas a prova de isolamento RLS não é válida: o usuário de teste não está sujeito à policy. A migration também não é autocontida fora do ambiente Supabase que fornece role/helper. A correção necessária é executar com role não-superuser autenticado e claims reais (ou harness equivalente), além de garantir baseline/roles no provisionamento.

Não foram encontrados secrets hardcoded nem logging sensível.

## 2. Telar — Hermes Source Registry (`b9c3911c`)

**PASS-CONDICIONAL.** `source-registry.ts:30-40` valida campos obrigatórios e URI HTTP(S); a chave inclui organização, URI e versão. A implementação PostgreSQL (`:52-70`) valida o nome de tabela (`/^\\w+$/`), usa parâmetros, chave composta `(organization_id, source_id)` e `ON CONFLICT` para idempotência; `list` filtra por `organization_id`. `freshness-engine.ts:6-14` trata timestamps inválidos/futuros como `stale`.

Execução independente: container PostgreSQL descartável, teste `source-registry.test.ts` + `freshness-engine.test.ts`; **2 arquivos, 9 testes PASS, `TEST_EXIT=0`**, incluindo `Promise.all` concorrente, reconstrução por novo read e freshness. Container removido no teardown.

Limite honesto: a migration `0163` não declara RLS e não houve prova multi-processo/produção. O isolamento observado é filtro SQL por tenant e PK composta; RLS/provisionamento precisam ser adicionados/verificados antes de tratar como garantia de banco compartilhado.

Não foram encontrados secrets hardcoded nem logging sensível.

## Veredito final

- Consent Registry / Memory Gate: **BLOCKED** — persistência e expiração estão implementadas, mas a integração real falhou no ambiente novo e não prova RLS porque usa superuser; falta harness com role/claims sujeitos à policy.
- Hermes Source Registry: **PASS-CONDICIONAL** — unit + concorrência PostgreSQL descartável passaram; falta RLS e prova multi-processo/produção.

SELF-CHECK: PASS — código, migrations, testes e saídas reais registrados; containers descartáveis removidos; nenhum segredo exposto.
