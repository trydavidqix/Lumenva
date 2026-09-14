# Review consolidado V2 — TTL de memória e directional trust

Data: 2026-09-12  
Escopo: revisão estática read-only via SSH no worker `claude@192.168.1.78`, sem execução, merge ou efeitos externos.

## Lótus — TTL de memória

Alvo: `fe6624d4` (`feat(memory): enforce category TTL policy`), arquivos `apps/crm/lib/memory/memory-ttl.ts` e `memory-ttl.test.ts`.

### Passes

- `WORKING` usa TTL configurável e expira rapidamente; `EPISODIC` usa dias configuráveis.
- `SEMANTIC` e `PROCEDURAL` não expiram por idade.
- TTL negativo é limitado a zero (`Math.max(0, ...)`).
- Eventos não ativos ou de categorias não temporárias são copiados sem alteração.
- Testes cobrem expiração, itens recentes, categorias permanentes e não-mutação.

### Achados

**FAIL — `options.now` inválido pode ser fail-open.** `Date.parse(options.now)` pode resultar em `NaN` (`memory-ttl.ts:19`); a comparação `nowMs >= Date.parse(validUntil)` então é falsa (`:39`), mantendo o evento como `active` em vez de rejeitar a entrada. O teste não cobre timestamp inválido.

`observedAt` inválido tende a lançar em `toISOString()`, o que é fail-closed por exceção, mas sem erro tipado/controle explícito. Também faltam limites contra overflow de TTL/dias.

Veredito TTL: **FAIL CONDICIONAL** até validar `now`, `observedAt` e overflow de forma explícita e cobrir esses casos.

## Prisma — directional trust

Alvo: `89253115` (`feat(psycheos): add directional trust transitions`), `apps/crm/lib/psycheos/affect-ledger.ts` e testes.

### Passes

- Trust é direcional: chaveia por `subjectId → targetId`; A→B não altera B→A.
- Defaults sobem lentamente (`POSITIVE = 0.1`), caem mais rápido em quebra (`BREACH = 0.5`) e reparam gradualmente (`REPAIR = 0.05`).
- Valores são limitados a `[-1, 1]`; current/confidence inválidos são rejeitados.
- Replay do mesmo `interactionId` é deduplicado no ledger em memória.
- Testes cobrem subida lenta, queda rápida, reparo gradual, direcionalidade e replay.

### Achados

**FAIL — rates customizados permitem subida rápida demais.** O construtor aceita qualquer rate finito não negativo (`affect-ledger.ts:102-105`), sem teto. Um caller pode fornecer `positive: 100`, e `applyTrustInteraction()` leva a confiança a `1` numa única interação (`:92-94`, por clamp), violando a regra de subir devagar. Os testes só cobrem os defaults.

**FAIL — kind desconhecido cai no ramo de repair.** Em runtime, `applyTrustInteraction()` trata qualquer valor diferente de `POSITIVE`/`BREACH` como `REPAIR` (`:92-93`); não valida enum. Um evento malformado pode obter efeito positivo/recuperação em vez de ser rejeitado. Isso é fail-open de entrada.

Não há secret hardcoded, logs sensíveis ou leakage nos commits revisados.

Veredito trust: **FAIL CONDICIONAL** até limitar rates (teto explícito), validar `kind` em runtime e adicionar testes adversariais para rate excessivo e kind desconhecido.

## Veredito consolidado

**BLOCKED / NÃO PROMOVER:** ambos os commits têm bons testes de caminho nominal, mas permanecem dois gaps críticos de segurança comportamental: TTL aceita `now` inválido como ativo e directional trust permite configuração que sobe instantaneamente e interpreta kind desconhecido como repair. Corrigir e repetir o gate antes de promoção.

SELF-CHECK: PASS — somente leitura; nenhum teste, build, merge ou download executado.
