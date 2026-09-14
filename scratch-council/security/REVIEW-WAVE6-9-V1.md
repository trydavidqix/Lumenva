# Revisão de segurança — Wave 6 (ProjectSpec) e Wave 9 (BuildPlan)

Data: 2026-09-12  
Método: inspeção read-only via SSH no worker `claude@192.168.1.78`, sem build, testes, merge ou efeitos live.

## Escopo e commits

- Crisol / `wave6/studio-comercial-2026-09-12`: `5de09d4083ebc91be45a556b8a6df42791e762bd` (`feat(studio): add commercial ProjectSpec and client token`). Arquivos: `apps/crm/lib/studio/project-spec.ts` e `apps/crm/lib/studio/project-spec.test.ts`.
- Telar / `wave9/product-factory-2026-09-12`: `122a45cd3984452baf459a1b5256ad24c4576153` (`feat(wave9): add acyclic build plan`). Arquivos: `apps/crm/lib/product-factory/build-plan.ts` e `apps/crm/tests/unit/product-factory-build-plan.test.ts`.

## ProjectSpec — token de acesso do cliente

**Veredito: PASS no critério de token fraco/previsível; nenhum secret hardcoded ou log sensível encontrado nos arquivos revisados.**

Evidência:

- `project-spec.ts:36`: `randomBytes(32).toString("base64url")`; são 256 bits de aleatoriedade criptográfica, não derivados de `project_id`, organização, cliente ou data.
- `project-spec.ts:37,48`: o registro persiste apenas `token_hash` SHA-256; o token em claro é devolvido somente no resultado de emissão.
- `project-spec.ts:43-44`: comparação do hash com `timingSafeEqual`, precedida por verificação de comprimento.
- `project-spec.ts:41-45`: valida organização/projeto, revogação, expiração e impede elevação de scope (`COMMENT` só atende `VIEW`).
- `project-spec.test.ts:28-31`: confirma formato opaco de 43 caracteres, hash persistido, ausência do token no JSON do registro e uso válido.
- `project-spec.test.ts:33-40`: cobre expiração, revogação, cross-project e scope maior.

**Risco residual (não é previsibilidade do token):** `Date.parse` não é validado quanto a `NaN` (`project-spec.ts:35,42`). Uma data inválida pode passar pela comparação e tornar a expiração fail-open. Deve ser rejeitada explicitamente com `Number.isFinite(Date.parse(...))` antes de considerar o token válido.

**Risco residual adicional:** `single_use` é persistido (`project-spec.ts:37`), mas não é consumido nem invalidado por `canUseClientPortalToken` (`project-spec.ts:40-46`); tokens emitidos com `single_use: true` podem ser reutilizados. Requer estado de consumo/idempotência no fluxo que autoriza o token.

## BuildPlan — detecção de dependência circular

**Veredito: PASS contra fail-open na detecção de ciclos; nenhum secret hardcoded ou logging sensível encontrado nos arquivos revisados.**

Evidência:

- `build-plan.ts:53-70`: constrói o mapa de dependências e percorre todos os nós com DFS usando conjuntos separados `visiting` e `visited`.
- `build-plan.ts:57-60`: reencontro de nó em `visiting` gera erro explícito com o caminho do ciclo; a função retorna `valid: false` sempre que `errors` não está vazio (`build-plan.ts:72`).
- `build-plan.ts:46-50`: dependência desconhecida também gera erro. Embora a DFS ignore a aresta desconhecida na linha 65, o plano já permanece inválido por esse erro; não há aceitação silenciosa.
- `build-plan.ts:40-43`: IDs duplicados são rejeitados antes do resultado final.
- `product-factory-build-plan.test.ts:23-31`: teste de ciclo `build -> test -> preview -> build` exige `valid === false` e o caminho exato.
- `product-factory-build-plan.test.ts:33-44`: cobre IDs duplicados e referências desconhecidas, exigindo invalidação.

Não foi executada a suíte Vitest; a conclusão é de inspeção estática do commit e dos testes declarados.

## Segredos e superfície de logging

Busca textual read-only nos dois commits e diretórios relevantes por padrões de chave (`sk-`, `api[_-]?key`, `secret`, `password`, `Bearer`, `console.` e `logger.`) não encontrou literal de credencial nem logging de token/secret.

## Veredito consolidado

- **ProjectSpec:** PASS para token criptograficamente forte, opaco e não persistido em claro; corrigir validação de data inválida e enforcement de `single_use` antes de tratar a superfície como completa.
- **BuildPlan:** PASS para fail-closed de dependências circulares, duplicadas e desconhecidas no código revisado; não há bypass silencioso observado.
- **Hardcoded secrets:** nenhum encontrado.

Classificação geral: **APROVÁVEL com ressalvas**. Não há bloqueio crítico nos critérios solicitados, mas os dois riscos residuais do ProjectSpec devem ser tratados antes de expor o portal a clientes.

SELF-CHECK: PASS — revisão read-only, commits e caminhos confirmados, sem testes/build/merge/efeito externo.

## Addendum — Repair Loop (Telar, Wave 9)

Commit revisado: `6697e53de48518c9860dcae40e4dcd895527916c` (`feat(wave9): add bounded repair loop`), no worktree `wave9/product-factory-2026-09-12`. Arquivos: `apps/crm/lib/product-factory/build-plan.ts` e `apps/crm/tests/unit/product-factory-build-plan.test.ts`.

### Limite de tentativas

**PASS apenas no limite local da chamada; FAIL como enforcement durável.**

- `build-plan.ts:45-46` exige `maxAttempts` inteiro positivo.
- `build-plan.ts:54-62` incrementa `attempts` antes de cada execução e usa `while (attempts < options.maxAttempts)`. Dentro de uma chamada, o executor não recebe mais que o limite; exceções também contam como tentativa (`:57`).
- O teste `product-factory-build-plan.test.ts:46-58` confirma sucesso na terceira tentativa com `maxAttempts: 3`, e `:60-73` confirma bloqueio após duas falhas.
- Porém, o contador é variável local (`:54`) e não é persistido no `BuildPlan`; cada nova chamada começa em zero. O plano original também não é marcado, pois a função clona os passos (`:51-52`). Um caller pode chamar novamente com o mesmo `buildPlan` ainda contendo `FAILED`, obtendo outro lote completo de tentativas. Chamadas concorrentes igualmente não compartilham orçamento.

### BLOCKED terminal

**FAIL como garantia terminal sistêmica; apenas o objeto retornado fica bloqueado.**

- Ao esgotar tentativas, `:63-65` marca o passo clonado como `BLOCKED`, `plan.status` como `BLOCKED_EXTERNAL` e retorna `status: "BLOCKED"`.
- Se exatamente esse objeto retornado for reenviado sem mutação, `:48-49` não encontra `FAILED` e lança `BuildPlan has no FAILED step`; nesse caminho, não reexecuta.
- Não existe, entretanto, guarda no início que rejeite `buildPlan.status === "BLOCKED_EXTERNAL"`, nem registro durável de bloqueio/epoch/attempt budget. Repassar a entrada original, ou alterar um passo bloqueado de volta para `FAILED`, contorna o estado terminal e permite novas execuções.

### Veredito do addendum

O loop é bounded somente por invocação e os testes cobrem os dois caminhos básicos, mas não cobrem reentrada com o mesmo plano, reexecução após `BLOCKED_EXTERNAL` ou concorrência. Antes de promover como terminal/anti-retry, é necessário persistir tentativas e bloqueio por `build_plan_id`/idempotency key e rejeitar qualquer plano já `BLOCKED_EXTERNAL` antes de executar o executor.

Classificação: **BLOQUEIO de segurança/integridade para a garantia declarada de terminalidade; sem bypass dentro de uma única chamada, mas bypass trivial entre chamadas**.
