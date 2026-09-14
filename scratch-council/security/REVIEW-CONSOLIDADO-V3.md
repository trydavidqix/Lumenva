# Review consolidado V3

Data: 2026-09-12  
Escopo: Registry V2 (Vértice), Freshness check (Cartógrafa), reconstrução de projeção (Lótus), Action Bus (Fornalha) e evals de regressão (Prisma). Revisão estática read-only via SSH no worker; nenhum teste, build, merge ou efeito externo executado.

## Registry V2 — Vértice (`aa96cbfb`)

**PASS:** chave canônica `trim → Unicode NFKC → lowercase` é usada em `register()` e `get()`. Duplicatas exatas, case variants, whitespace e full-width são rejeitadas antes de `set()`. Testes cobrem esses casos. Sem secret/log sensível. Limites: registry local em memória e validação runtime de objeto/tamanho/conteúdo incompleta.

## Freshness — Cartógrafa (`0fc13088`)

**PASS CONDICIONAL:** ausência ou timestamp inválido resulta em `stale`; `maxAgeDays` inválido lança e o card não é mutado. `now` inválido também não produz `current`. Sem secret/log. Limite: timestamp futuro é aceito como `current`; se o contrato exigir revalidação não futura, falta rejeitar/`unknown` e teste correspondente.

## Reconstrução de projeção — Lótus (`6881dc54`)

**FAIL — projeção pode expor memória não vigente.** `rebuildMemoryProjection()` exclui apenas `rejected`, `redacted` e `superseded` (`projection.ts:29-35`). Assim `draft`, `frozen` e `expired` entram na projeção, enquanto o `context-compiler` consumidor aceita somente `active` e não expirado. Reconstrução e consumo podem divergir, expondo estado expirado ou não aprovado. Os testes não cobrem esses lifecycles.

Timestamps inválidos também são ordenados lexicograficamente (`createdAt ?? observedAt`) sem rejeição; supersession pode ser aplicada em ordem incorreta. Sem secret/log sensível.

## Action Bus — Fornalha (`6eacc13a`)

**FAIL / BLOCKED:**

- Duas execuções concorrentes com a mesma `idempotency_key` podem passar `receipts.get()` antes de qualquer `set()` e executar o adapter duas vezes; idempotência não é atômica.
- `permission_level`, `risk_level`, `approval_id`, `assignment_id`, `timeout_ms` e `retry_policy` são aceitos mas não enforceados.
- Replay retorna evidência antes de validar vínculo com `action_id`, organization, assignment ou worker; chave reutilizada pode causar leakage/confusão de autorização.
- `payload_redacted` é somente nome de campo; `result` arbitrário é persistido sem redaction/limite.
- Não há actor/origem/autenticidade do envelope e o armazenamento é somente `Map` local.

O teste cobre capability ausente e replay sequencial nominal, mas não concorrência, approval/risk, reuse cross-action ou leakage.

## Evals de regressão — Prisma (`53afc117`, com correção `d70bcc14`)

**NOT_PROVEN como regressão sistêmica:** caps de trust e rejeição de `kind` desconhecido estão cobertos, e o runner retorna dez casos com status. Porém vários casos são tautológicos ou exercitam apenas o mesmo objeto em memória:

- boundary compara duas decisões constantes, sem componente real de decisão;
- persistência lê duas vezes o mesmo ledger, sem model swap/persistência;
- handoff repete a mesma leitura, sem reconstrução;
- truth não chama componente de evidence/truth;
- não há concorrência nem store distribuído.

Sem secret hardcoded/log sensível. Consumidores devem tratar qualquer `FAIL` como gate bloqueante; o runner continuar após uma falha não pode ser interpretado como PASS global.

## Veredito consolidado

**BLOCKED / NÃO PROMOVER.** Registry V2 e Freshness têm comportamento nominal seguro com limites; os evals Prisma são úteis como smoke local, mas não provam os contratos sistêmicos. Permanecem bloqueadores críticos: Action Bus sem idempotência atômica e sem enforcement de approval/risk/actor; Projection rebuild incluindo `draft`/`frozen`/`expired`; timestamps sem validação; e cobertura de regressão insuficiente para os cenários que os nomes prometem.

Correções mínimas: filtrar Projection para `active` não expirado e rejeitar timestamps inválidos; serializar/deduplicar Action Bus atomicamente e vincular replay à identidade completa, com actor/approval/risk e redaction; substituir evals tautológicos por testes contra componentes reais, persistência/reconstrução e concorrência.

SELF-CHECK: PASS — revisão somente leitura; nenhum segredo exposto, nenhuma execução, merge, download ou alteração remota.
