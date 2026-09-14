# Revisão de segurança consolidada — Reverse Design, Freshness Engine e No-progress Watchdog

Data: 2026-09-13  
Método: inspeção read-only via SSH no worker, por SHA/ref, sem build, testes, merge, deploy ou efeitos live. Nenhum segredo foi impresso.

## Commits revisados

- Crisol / Wave 8 (`wave8/asset-intelligence-2026-09-13`): `76dbeb4b1ab579c21064659c1cde587cf0c2f773` — `feat(wave8): add reverse design layer reuse`.
- Cartógrafa / Wave 12 (ref disponível: `wave12/marketing-content-2026-09-13`): `d1ed3eb32845ccf92676d8c7053f5e554a0db04a` — `feat(marketing): add content freshness engine`.
- Lótus / Wave 15 (ref disponível: `wave15/resource-router-2026-09-13`): `6778128583598413a5ded7d1434aef2fe52e92f0` — `feat(runtime): add no-progress watchdog rerouting`.

## 1. Reverse Design — Crisol

Arquivos: `apps/crm/lib/asset-intelligence/reverse-design.ts` e teste correspondente.

**Veredito: PASS limitado ao contrato de sugestão; enforcement de autorização/licença permanece NOT_PROVEN.**

- `reverse-design.ts:7-10` documenta que correspondência de tag é apenas hipótese e não concede reuse, licença ou aprovação.
- `:15-22` filtra por igualdade exata de `semantic_tag` e anexa `source_manifest_id`; não há execução de cópia nem mutação do manifesto.
- O teste `reverse-design.test.ts:36-43` confirma que somente tags pedidas são sugeridas e que tags não pedidas não entram.
- O tipo devolve a camada inteira, incluindo `provenance` (`layer-manifest.ts:14-20`), portanto consumidores devem tratar a sugestão como dado não autorizado até validar propriedade/consentimento fora desta função.
- Não há `organization_id`/tenant no `LayerManifest` ou na sugestão (`layer-manifest.ts:22-28`); isolamento entre tenants não é demonstrado por esta superfície.

## 2. Freshness Engine — Cartógrafa

Arquivos: `apps/crm/lib/knowledge/freshness-engine.ts`, `content-provenance.ts` e testes.

**Veredito: FAIL por freshness futura tratada como current; sem secret hardcoded.**

- `freshness-engine.ts:14-15` rejeita `maxAgeDays` negativo, infinito ou não numérico.
- `:17-25` marca como `current` quando `nowMs - generatedMs < maxAgeDays * DAY_MS`; não exige `generatedMs <= nowMs`.
- Uma data `generatedAt` futura produz diferença negativa e satisfaz a condição, ficando `current` (fail-open de freshness). O teste `freshness-engine.test.ts:17-29` cobre apenas conteúdo antigo/recente; não cobre timestamp futuro, timestamp inválido ou relógio inválido.
- Timestamp inválido cai em `stale` por `Number.isFinite(generatedMs)` (`:19-24`), comportamento fail-closed correto para esse caso.
- `ContentProvenanceTracker` rejeita IDs/skill/source vazios e confidence fora de `[0,1]` (`content-provenance.ts:17-25`), mas mantém ledger apenas em memória (`:14-15`); durabilidade/integridade externa não são provadas.

## 3. No-progress Watchdog — Lótus

Arquivos: `apps/crm/lib/memory/no-progress-watchdog.ts` e teste correspondente; roteador em `resource-router.ts`.

**Veredito: PASS no limiar e seleção fail-closed do roteador; NOT_PROVEN quanto a enforcement persistente do watchdog.**

- `no-progress-watchdog.ts:21-25` conta somente a sequência final de observações sem progresso; qualquer observação com progresso zera a sequência efetiva.
- `:30-39` mantém `ON_TRACK` antes de três ciclos e tenta rotear apenas para o worker atual.
- `:42-51` após três ciclos retorna `AT_RISK` e exclui o worker atual; falha do roteador vira `route: null`, sem inventar destino.
- O `resource-router.ts:27-43` aceita somente worker saudável, com carga/capacidade finitas, capacidade disponível e todas as capabilities; sem apto, lança erro. O watchdog captura esse erro e sinaliza risco, não sucesso falso.
- Testes `no-progress-watchdog.test.ts:17-40` cobrem limiar de três ciclos, realocação para outro worker e ausência de worker alternativo.
- O watchdog não persiste contagem, não grava estado de reroute e não impede chamadas repetidas com as mesmas observações. A garantia sistêmica de que um reroute não seja duplicado ou que a observação seja autêntica permanece NOT_PROVEN.

## Secrets e logging

Busca textual read-only nos arquivos alterados por `sk-`, `api[_-]?key`, `secret`, `password`, `Bearer`, `console.` e `logger.` não encontrou secret hardcoded nem logging sensível.

## Veredito consolidado

- Reverse Design: **PASS limitado** — sugestão não concede autorização, mas tenant/licença/proveniência precisam ser enforced pelo consumidor.
- Freshness Engine: **FAIL** — timestamp futuro é aceito como `current`; corrigir exigindo `generatedMs <= nowMs` e adicionar teste regressivo.
- No-progress Watchdog: **PASS local / NOT_PROVEN sistêmico** — limiar e fallback sem worker apto são corretos, mas não há persistência/idempotência de reroute.

Classificação geral: **BLOQUEADO para promoção sem correção do Freshness Engine**. O watchdog pode avançar apenas como componente provider-free bounded, condicionado a uma boundary persistente/idempotente. Reverse Design não deve ser tratado como autorização de reuse.

SELF-CHECK: PASS — três SHAs/ref confirmados, revisão read-only, sem execução de testes/build e sem alteração remota.
