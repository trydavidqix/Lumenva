# Revisão consolidada — Retrieval, Wake Replay e ToolLoopLock

Data: 2026-09-13  
Método: leitura read-only no worker e execução independente dos testes; PostgreSQL descartável usado nas integrações, com remoção garantida.

## 1. Cartógrafa — redaction de metadata/citations (`deeb79ab`)

**PASS.** `searchKnowledge.ts:95` redige cada hit antes de retornar. `redactValue` percorre recursivamente strings, arrays e objetos (`:146-162`), aplicando a mesma redação de email, CPF e telefone ao `content` e a todo `metadata` (`:164-173`). `citationsFromHits` chama novamente `redactKnowledgeHit` antes de construir snippet e metadata (`:187-198`). Não existe flag ou parâmetro de opt-out.

Teste real: `search-knowledge-redaction.test.ts` — **1 arquivo, 2 testes PASS, `TEST_EXIT=0`**. Cobriu PII em content, metadata e citation. Nenhum secret hardcoded encontrado.

## 2. Fornalha — Wake actors e replay dispatch (`88f4ebd2`)

**PASS.** `event-wake.ts:40-52` verifica schema, HMAC, actor existente/habilitado e capability independente de `actor_capabilities` do payload; tenant/policy/worker capability e allowlist são checados antes de `WAKED`. Actor ausente ou capability não autorizada resulta em `REJECTED`, não em fila permissiva.

`dispatchWakeEvent` (`:63-67`) só executa o callback quando o resultado é `WAKED`. `wakeEventPersisted` usa o claim PostgreSQL antes do dispatch (`:55-60`); `INSERT ... ON CONFLICT (organization_id,idempotency_key) DO NOTHING RETURNING` garante que replay não obtenha claim. Teste real com PostgreSQL descartável: **1 arquivo, 1 teste PASS, `TEST_EXIT=0`**; dois dispatches concorrentes produziram um `WAKED`, um `DUPLICATE`, `executions === 1`, e replay após novo store não reexecutou. Container removido.

## 3. Telar — ToolLoopLock CAS (`cf5d1913`)

**PASS-CONDICIONAL.** O teste real contra PostgreSQL descartável passou: `postgres-tool-loop-lock.test.ts` — **1 arquivo, 1 teste PASS, `TEST_EXIT=0`**; `Promise.allSettled` com duas instâncias confirmou um fulfilled, um rejected, `iteration=1` e `version=1`; container removido.

O UPDATE é atômico e condiciona `active_tool_call_id IS NULL`, epoch, expiração e limite (`postgres-tool-loop-lock.ts:8-17`), e `complete` exige owner/epoch (`:19-22`). Porém o commit anunciado como CAS não usa `version = X` na cláusula `WHERE`; apenas incrementa `version`. A tabela/migration tem coluna version, mas não há comparação explícita de versão (`:9`, migration `0164:1-6`). O teste usa duas instâncias no mesmo processo/pool, não dois processos independentes. A exclusão mútua atual funciona pelo UPDATE condicional, mas a garantia CAS/version e concorrência multi-processo ainda não estão provadas.

Não foram encontrados secrets hardcoded nem logging sensível nas três peças.

## Veredito consolidado

- Cartógrafa: **PASS** — redação non-opt-out cobre content, metadata e citations, com teste real.
- Fornalha: **PASS** — actor/capability independente do payload e replay não reexecuta, confirmado em PostgreSQL real.
- Telar: **PASS-CONDICIONAL** — lock atômico e concorrência básica passam, mas falta `version = expected` no WHERE e prova com processos independentes se o contrato exige CAS explícito.

SELF-CHECK: PASS — código real lido, testes executados, PostgreSQL descartável removido e nenhum segredo exposto.
