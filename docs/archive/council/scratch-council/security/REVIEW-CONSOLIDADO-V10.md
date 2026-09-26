# Revisão de segurança consolidada — Freshness Engine Wave 13 e Watchdog+permissão Wave 14

Data: 2026-09-13  
Método: inspeção read-only via SSH no worker, por SHA e arquivos dos commits. Não foram executados testes, build, merge ou efeitos live.

## Commits revisados

- Lótus / Wave 13 (`wave13/hermes-source-registry-2026-09-12`): `077d931c2fd42734e0e07b2660e4ae44be93cf3f` — `feat(memory): add source freshness engine`.
- Prisma / Wave 14 (`wave14-15/evals-autonomy-2026-09-12`): `5cd7531cdda444427ef9fb60eeabccb09a89600b` — `feat(wave14): gate watchdog reroute by permission`.

## Freshness Engine — Wave 13

**Veredito: PASS contra fail-open de freshness; nenhum secret hardcoded encontrado.**

- `apps/crm/lib/memory/freshness-engine.ts:12-15` converte timestamp inválido ou fora do limite de Date em `null`.
- `:21-24` trata `now` e `maxAgeMs` inválidos como não utilizáveis, sem exceção que resulte em `fresh`.
- `:26-35` só retorna `fresh` quando timestamp observado é finito, não está no futuro (`observedMs <= nowMs`) e está dentro da janela; qualquer outra condição retorna `stale`.
- O teste `apps/crm/lib/memory/freshness-engine.test.ts:33-40` cobre timestamp futuro e inválido, exigindo `stale`; `:25-31` cobre janela fresh/stale e `:42-46` confirma que a entrada não é mutada.
- `source-registry.ts:27-47` rejeita campos obrigatórios, tipo de fonte inválido e protocolos de URI não HTTP(S); não há fallback permissivo.

Limites não classificatórios: o engine retorna cópias com status, mas não persiste em datastore; a prova de integração/durabilidade do registry continua NOT_PROVEN. `maxAgeMs` aceita qualquer número finito não negativo, inclusive janelas muito grandes, comportamento de política que deve ser definido pelo contrato.

## Watchdog + permissão — Wave 14

**Veredito: PASS local contra fail-open de permissão; nenhum secret hardcoded encontrado.**

- `apps/crm/lib/psycheos/no-progress-watchdog.ts:40-63` valida `jobId`, ciclo inteiro crescente, trata replay do mesmo ciclo de forma idempotente e sinaliza `AT_RISK` somente após três ciclos sem progresso.
- `:66-76` valida `requesterId`, nega `P4` sem aprovação, nega níveis diferentes de `P2`/`P3`, exige capability explícita `workforce.reroute` e só então retorna `ALLOW`.
- O tipo fixa `processAction: "CONTINUE"` (`:7-14`, `:22-27`); o watchdog não mata nem promove reroute automaticamente ao detectar risco.
- Testes `no-progress-watchdog.test.ts:39-60` cobrem negação sem permission/capability e permissão apenas para `P2` com capability; `:30-37` cobre isolamento por job e replay de ciclo.

Não identifiquei caminho de sucesso para permission level inválido, capability ausente ou requester vazio. Entradas nulas/malformadas geram erro ou negação, não `ALLOW`.

Limites de boundary: `requesterId` e `capabilities` são fornecidos pelo chamador e não são cruzados com um registry/autenticação externa; o predicado prova autorização declarada, não identidade criptograficamente autenticada. O estado `jobs` é um `Map` em memória (`:37-38`), portanto restart/distribuição e concorrência entre processos permanecem NOT_PROVEN.

## Secrets e logging

Busca textual read-only nos arquivos alterados por `sk-`, `api[_-]?key`, `secret`, `password`, `Bearer`, `console.` e `logger.` não encontrou secret hardcoded nem logging sensível.

## Veredito consolidado

- Freshness Engine Wave 13: **PASS** — timestamps futuros/inválidos falham fechados e os testes cobrem esses cenários.
- Watchdog+permissão Wave 14: **PASS local / NOT_PROVEN sistêmico** — níveis/capability inválidos negam; identidade/autenticidade e estado distribuído ainda não são provados.
- Secrets: **nenhum encontrado**.

Nenhum bloqueio crítico foi encontrado nos critérios solicitados. Para promoção de produção, ainda é necessário integrar requester/capabilities a uma fonte de identidade confiável e persistir o estado do watchdog com semântica concorrente definida.

SELF-CHECK: PASS — SHAs confirmados, escopo read-only respeitado, sem testes/build/merge/efeito externo e sem exposição de segredos.
