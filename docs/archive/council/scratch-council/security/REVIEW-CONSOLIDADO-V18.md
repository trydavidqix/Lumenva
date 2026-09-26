# Revisão consolidada — Wave 13/15, Wave 16 e Wave 10

Data: 2026-09-13  
Método: revisão read-only dos commits no worker; sem merge, deploy ou efeitos externos.

## Commits auditados

- Lótus: `981c32ea` — reconstrução de projeção via Memory Gateway.
- Prisma: `8fe74970` — repair/forgiveness de trust com cap.
- Telar: `32138e34` — receipt imutável de entrega.

## Reconstrução via Memory Gateway — `981c32ea`

**PASS parcial.** `gateway-projection.ts` valida `subject`/`scope`, deduplica backends, lê todos via `Promise.all`, filtra registros fora do escopo e namespace inválido e aplica supersession. Falha de qualquer backend rejeita a operação; não há fallback silencioso para dados incompletos. O teste confirma leitura de ambos os backends e remoção do registro superseded.

Limite: `ProjectionQuery` não contém `organization_id`; o isolamento entre tenants precisa existir no gateway/backend chamador. Lista vazia de backends resulta em projeção vazia, sem erro explícito, o que deve ser tratado pela camada de contrato se “nenhum backend” for estado inválido.

## Repair/forgiveness — `8fe74970`

**PASS.** `repairTrust` rejeita trust fora de `[-1,1]`, tempo inválido e contador de breaches inválido; não recupera quando há nova quebra (`breachesSinceLastRepair > 0`). A recuperação é limitada por `recoveryPerSecond <= 0.002` e `maxRecoveryFraction <= 0.2`, e o resultado é clampado. O teste cobre recuperação gradual, cap, bloqueio após breach e tempo negativo.

Não há secret ou logging sensível. Observação residual: opções `NaN` não são explicitamente rejeitadas; a aritmética produz `NaN`, que não aumenta trust, mas seria melhor falhar fechado com `RangeError`.

## Receipt imutável de entrega — `32138e34`

**BLOCKED.** O gate é consultado antes da criação normal e exige estado `APPROVED`/`PACKAGED`; porém `receipt.ts:23-24` devolve imediatamente um receipt existente pelo ID, antes de revalidar tenant, plano, artifact, actor ou gate. Um chamador que reutilize/conheça um `delivery_receipt_id` pode obter o receipt anterior através de uma chamada com contexto diferente. O mapa é global e `getDeliveryReceipt(receiptId)` também não exige tenant/actor.

Além disso, `Object.freeze` congela apenas o objeto externo (`receipt.ts:29-35`): `artifact_refs` e `evidence_refs` continuam arrays mutáveis por referência, portanto a alegação de imutabilidade profunda não é verdadeira. O hash não cobre actor, approval, evidence refs nem artifact ref, apenas plano/tenant/canal/hash do artifact/data de criação.

O teste cobre gate ausente e `Object.isFrozen(receipt)`, mas não tenta mutar os arrays, reutilizar o mesmo ID com outro tenant/contexto ou verificar que a validação é repetida. Portanto não prova imutabilidade nem idempotência segura.

## Secrets

Não foram encontrados secrets hardcoded nos três commits auditados.

## Veredito final

**BLOCKED consolidado.** Memory Gateway e repair/forgiveness não apresentam fail-open crítico no caminho testado. O receipt de entrega ainda possui bypass de revalidação por ID e imutabilidade apenas superficial; corrigir lookup com tenant/contexto, congelar arrays/cópias profundas e adicionar testes de reutilização/mutação antes de promover.

SELF-CHECK: PASS — SHAs, trechos, riscos e limites documentados; revisão somente leitura.
