# Revisão de segurança consolidada — Consent Memory Gate e Boundary Eval

Data: 2026-09-13  
Método: inspeção read-only via SSH no worker, por commit e arquivos alterados. Não foram executados testes, build, merge ou efeitos live.

## Commits revisados

- Fornalha / integração Wave 3+11: `482b092ddd36af5f8b71f29e382b7503e0545454` — `feat(wave11): gate contact memory by consent`.
- Prisma / Wave 14/16: `d777893a76ab0cf4025aa9f3baa85989c32ab3f0` — `test(psycheos): add real business boundary eval`.

## Consent Memory Gate — Fornalha

Arquivos: `apps/crm/lib/integrations/consent-memory-gate.ts` e `consent-memory-gate.test.ts`.

**Veredito: PASS local contra fail-open; enforcement sistêmico e durabilidade NOT_PROVEN.**

- `consent-memory-gate.ts:27-28` nega entradas ausentes e exige consentimento ativo para a combinação tenant, sujeito, canal e propósito antes de qualquer autorização.
- `:29-31` nega owner/scope ausentes ou divergentes e authorities não finitas/insuficientes.
- `:32` só retorna `ALLOW` após todas as verificações; não há caminho de sucesso por exceção ou consentimento ausente.
- Testes `consent-memory-gate.test.ts:10-23` cobrem consentimento presente, ausência, revogação, canal diferente e propósito diferente.
- `ConsentRegistry.canContact` (`consent-registry.ts:48-50`) compara `organization_id`, `subject_ref`, `channel`, `purpose` e `status === "GRANTED"`; não há cruzamento tenant silencioso.

Limites:

- O gate é uma função pura e o registry é um `Map` em memória (`consent-registry.ts:18-19`). Não prova que todo write real passe por ela, nem durabilidade/atomicidade entre processos.
- `source_refs`/`evidence_refs` podem estar vazios no registro de consentimento; este commit não exige evidência documental mínima. Isso é **NOT_PROVEN**, não um bypass de consentimento ativo.
- Não há validação explícita de formato/whitespace para todos os identificadores, mas valores malformados não fabricam uma correspondência no registry e tendem a negar.

## Boundary Eval — Prisma

Arquivos: `apps/crm/lib/psycheos/boundary-eval.ts` e `boundary-eval.test.ts`.

**Veredito: PASS no comportamento observado, mas FAIL como prova forte de independência emocional. O eval é estreito/tautológico.**

- `boundary-eval.ts:14` recebe `PadState` como `_affectState`, mas o argumento não é usado; a fórmula em `:21-22` depende apenas de `PricingInput`.
- `:15-20` rejeita preço base/quantidade inválidos e desconto fora de `[0,100]`, retornando `DENY`.
- `runBoundaryEval` (`:25-39`) compara a mesma função com dois ledgers, ambos `lambda: 0`, usando um único estado calmo e um único evento intenso (`:26-31`).
- O teste `boundary-eval.test.ts:7-16` compara os dois resultados e fixa `21330`; `:18-25` verifica que o helper retorna `PASS` e os mesmos campos.

Por que a prova não é suficiente:

- O teste cobre apenas um input e uma alteração de affect; não cobre estados negativos, extremos, múltiplas dimensões, diferentes `lambda`, nem vários preços/descontos/quantidades.
- `runBoundaryEval` chama o mesmo cálculo em ambos os lados. Uma implementação que ignorasse o ledger por engano, retornasse constante para esse único fixture ou aplicasse uma influência emocional que não alterasse esse caso ainda poderia passar.
- O eval não compara com uma implementação/oráculo de preço independente, não testa mutação de `PadState`, e não demonstra uma fronteira de produção onde emoção seja impossível de alcançar o cálculo.
- Portanto, o teste prova apenas que este fixture retorna preço/policy iguais; não prova a propriedade geral “emoção não afeta preço”.

## Secrets e logging

Busca textual read-only nos quatro arquivos alterados por `sk-`, `api[_-]?key`, `secret`, `password`, `Bearer`, `console.` e `logger.` não encontrou secret hardcoded nem logging sensível.

## Veredito consolidado

- Consent Memory Gate: **PASS local / NOT_PROVEN sistêmico**. Fail-closed correto nos caminhos testados; falta provar integração obrigatória, persistência e evidência documental.
- Boundary Eval: **FAIL como evidência de boundary geral**. O cálculo atual é independente do affect, mas o teste é limitado e não demonstra robustez contra variações nem separação real de camadas.
- Secrets: **nenhum encontrado**.

Classificação geral: **BLOQUEADO para declarar a boundary emocional comprovada** até ampliar o eval com múltiplos estados/input cases e um oráculo independente ou teste de mutação que falhe quando affect influencia preço. O Consent Memory Gate pode seguir como componente provider-free, condicionado à integração obrigatória e persistência verificável.

SELF-CHECK: PASS — SHAs e arquivos confirmados, revisão read-only, sem testes/build/merge/efeito externo e sem exposição de segredos.
