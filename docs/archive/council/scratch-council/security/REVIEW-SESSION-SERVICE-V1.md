# Review de segurança — Session Service skeleton V1

Data: 2026-09-12  
Alvo: commit `f7547c5ae812ac73eab08075032844db014db35c`  
Branch/worktree: `wave3/session-runtime-skeleton-2026-09-12` / `/home/claude/src/worktrees/wave3-session-runtime-skeleton-2026-09-12`  
Commit: `feat(runtime): add session service contract skeleton`

## Escopo e método

Revisão estática read-only via SSH no worker `claude@192.168.1.78`, usando `~/.ssh/lumenva_worker`. O commit adiciona somente `apps/crm/lib/agent-engine/session/session-service.ts` (130 linhas). Não executei build, testes ou o código; não fiz merge nem alterei worktrees.

## Veredito

**PASS — sem achado crítico no skeleton.**

O arquivo é explicitamente apenas uma superfície de tipos TypeScript. Não contém implementação, chamadas de rede, persistência, logging, leitura de ambiente, criação de cliente, tratamento de exceções ou efeitos colaterais. Portanto não há secret hardcoded, log de dado sensível ou falha óbvia de tratamento de erro neste commit.

## Evidências

### Secrets e leakage

- Scan do arquivo por padrões de chave/segredo (`sk-`, `api_key`, `secret`, `token`, `password`, `Bearer`) não encontrou credenciais nem literais sensíveis.
- Não há `process.env`, headers, URLs, SDKs de provider ou chamadas `fetch`.
- Não há `console.*`, `logger.*` ou outro caminho de emissão de dados.
- Os campos `facts`, `decisions`, `promises`, `artifacts`, `errors` e `blockers` são apenas tipos (`string[]`); o skeleton não os serializa nem registra.

### Erros e invariantes declarados

O contrato declara códigos para `STALE_VERSION`, `SESSION_NOT_FOUND`, `TENANT_MISMATCH`, `INVALID_EXECUTION_EPOCH` e `IDEMPOTENCY_CONFLICT` (linhas 110–120). Também carrega `organization_id`, `execution_epoch`, `state_version` e `idempotency_key` nas estruturas de comando/snapshot (linhas 74–98). Isso é uma boa fronteira declarativa, mas não é prova de enforcement.

### Limite importante

O próprio comentário do arquivo diz que persistência, optimistic concurrency e idempotência pertencem à camada de implementação (linhas 1–6). Assim, este PASS cobre apenas o skeleton de tipos. A implementação futura ainda precisa validar tenant/actor/capability/policy, aplicar concorrência otimista e idempotência de forma atômica, redigir dados sensíveis e mapear erros sem leakage.

`idempotency_key` aparece como string no snapshot (linha 82). Não é um secret hardcoded, mas a implementação deve decidir retenção, hashing/redação e controle de acesso antes de persistir ou expor esse valor.

## Classificação

- Secret hardcoded: **não encontrado**.
- Log de dado sensível: **não encontrado**.
- Tratamento de erro óbvio ausente: **não aplicável ao commit**, pois não há runtime; códigos de erro estão declarados.
- Enforcement real de tenancy, concorrência, idempotência e redaction: **NOT_PROVEN**, fora do escopo deste skeleton.

## SELF-CHECK

PASS — inspeção read-only, commit exato confirmado, nenhum merge, nenhum efeito externo, nenhum segredo exposto, sem build/teste pesado.

## Adendo — commits Fornalha/Lótus (2026-09-12)

Alvos revisados estaticamente:

- Fornalha `0f4dea20823a117a29c577e5c1775cab17ea59f3` (`ToolLoopLock`), na branch `wave3/session-runtime-skeleton-2026-09-12`.
- Fornalha `a371c914e9f8e57206df53c043b9a1c040c2b0f9` (`Memory Gate`), na mesma branch.
- Lótus `e29d1568ca6080968451df6a34f4900597fce3c3` (`resolve superseding records`), em `memory-kernel/context-compiler-2026-09-12`.

Nenhum dos três commits contém secret hardcoded, logging ou chamada de provider.

### Fornalha — ToolLoopLock

`claimToolLoopLock()` e `completeToolLoopLock()` validam epoch, expiração, ocupação, limite de iterações e ownership, falhando com erros explícitos (`session-service.ts:165-212`). Os testes cobrem epoch obsoleto, lock ocupado, expiração e limite.

**Risco aberto (race condition, médio):** a função faz check e devolve uma cópia (`session-service.ts:176-194`); o comentário chama a operação de “atomicamente” segura apenas porque presume um lock store atômico no caller. Dois workers que leiam o mesmo lock antes de persistir podem ambos passar o check e reclamar o slot. O commit não fornece compare-and-swap, transação ou versão esperada. Não é fail-open dentro da função pura, mas o contrato de persistência precisa tornar a escrita condicional/atômica antes de qualquer uso real.

### Fornalha — Memory Gate

`evaluateMemoryGate()` rejeita `null`/`undefined`, tipos malformados, strings vazias, autoridades não finitas/negativas e exige igualdade de owner/scope e autoridade suficiente (`memory-gate.ts:22-53`). O teste cobre política ausente, `NaN`, infinito, owner e scope divergentes.

Não foi observada lógica fail-open no gate. **Limite:** owner, scope e authority são strings/número fornecidos ao gate; não há validação de actor/capability, versão de policy ou vínculo externo de identidade. Isso é `NOT_PROVEN` como enforcement de segurança sistêmica, não um bypass demonstrado neste commit.

### Lótus — dedup/supersession

`resolveSupersession()` rejeita namespace divergente e escolhe deterministicamente por `observedAt`, depois `confidence`, retornando clones (`supersession.ts:12-30`). Não há secret nem log.

**Risco aberto (race condition, médio):** a resolução é cálculo puro; não há operação atômica que grave o vencedor ativo e marque o perdedor como `superseded`. Duas chamadas concorrentes podem produzir resultados conflitantes ou reativar uma versão sem CAS/transação no repositório. Também não há validação de timestamps/record IDs vazios, portanto dados malformados podem ser ordenados, embora isso não constitua fail-open de autorização por si só.

### Veredito do adendo

**PASS com dois riscos de integração `NOT_PROVEN`:** nenhum secret hardcoded e nenhuma falha fail-open óbvia; ToolLoopLock e supersession exigem persistência atômica/CAS para eliminar races antes de produção. O Memory Gate falha fechado nos casos testados, mas não substitui autenticação/autorização de origem.

SELF-CHECK: PASS — somente leitura no worker; nenhum merge, build ou teste executado.

## Verificação das correções de race (2026-09-12)

Foram revisados, sem execução, os commits corretivos:

- Fornalha `8d1e12e8b3a0bd712a961460753afab6e7c6a191` — `ToolLoopLockStore` com compare-and-swap e teste `tool-loop-lock.test.ts`.
- Lótus `330b17a397ee678d6410aa45b72f4b0721f6d828` — `createSupersessionCoordinator` e teste `supersession-race.test.ts`.

### ToolLoopLock

O novo teste inicia duas claims via `Promise.allSettled` contra o mesmo `ToolLoopLockStore` e exige exatamente um `fulfilled`, um `rejected` com `TOOL_LOOP_BUSY` e `iteration: 1` no estado final (`tool-loop-lock.test.ts:33-46`). Isso corresponde ao cenário de dois workers disputando o mesmo slot.

O store faz a leitura, calcula a substituição e executa CAS síncrono no mesmo turno do event loop (`session-service.ts:214-267`). Para o store em memória e concorrência JavaScript single-process, a correção fecha o race observado. **Limite:** não prova atomicidade de um store externo/distribuído; o adapter de produção ainda precisa oferecer CAS/transação equivalente. Também permanecem as validações opcionais de `executionEpoch` e `Date` inválido já apontadas no adendo anterior.

### Supersession

O novo teste dispara duas resoluções concorrentes para o mesmo par, bloqueia o primeiro callback de commit e verifica que apenas uma gravação ocorre (`supersession-race.test.ts:20-52`). O coordenador serializa por chave de record IDs, mantém o lock até o callback terminar e reutiliza o resultado já committed (`supersession.ts:33-70`). Isso testa corretamente o interleaving que antes permitia dois commits no mesmo processo.

**Limite importante:** o lock é um `Map<string, Promise<void>>` local ao objeto e a memória `committed` também é local. Processos/instâncias diferentes, reinício ou múltiplos workers não compartilham esse lock; a serialização persistente continua `NOT_PROVEN`. A chave usa somente os dois `recordId`; isso é seguro apenas se `recordId` for globalmente único e imutável.

### Veredito final

**PASS CONDICIONAL:** os novos testes exercitam o cenário de concorrência correto e fecham as races dentro das implementações em memória/single-process. **NOT_PROVEN para produção distribuída:** falta evidência de CAS/transação no armazenamento real de ToolLoopLock e de serialização/unique constraint no repositório de memória. Não há novo secret hardcoded nem fail-open demonstrado.

SELF-CHECK: PASS — revisão estática read-only; nenhum merge, build ou teste executado.

## Verificação final do HandoffPack corrigido (2026-09-12)

Alvo: commit Fornalha `42fd6cba` (`fix(runtime): redact and advance handoff state`) e seus testes.

### Resultado

**As duas falhas originais foram corrigidas no código e agora têm testes direcionados:**

- `createHandoffPack()` aplica `redact()` ao goal, listas de contexto, referências de origem e evidências quando `redacted: true` (`handoff-pack.ts:43-76`). O teste injeta `api_key=super-secret-value`, exige `api_key=[REDACTED]` e verifica que o valor original não aparece no JSON (`handoff-pack.test.ts:22-26`).
- `reconstructSessionState()` agora aplica `pack.to_execution_epoch ?? base.execution_epoch` (`handoff-pack.ts:81-99`). O teste cria pack com destino 4 e exige estado reconstruído no epoch 4 (`handoff-pack.test.ts:28-31`). Isso cobre diretamente a transição que o teste anterior não cobria.

### Limites residuais

- A redaction é regex baseada em nomes (`api_key`, `token`, `secret`, `password`, `credential`, `bearer`) e não é uma garantia geral de PII/segredo. Conteúdo sensível com outro formato pode passar; `redacted: false` continua permitindo conteúdo cru por decisão do caller. Para transporte não confiável, o boundary deve impor redaction, não apenas aceitar a flag.
- O teste de reconstrução ainda usa o mesmo `state` como base e origem para a igualdade completa; o novo assertion de epoch é correto, mas uma prova completa deveria reconstruir sobre base distinta e alterar vários campos do pack para confirmar cada cópia.
- Isso não altera os riscos já registrados de CAS/serialização distribuída em ToolLoopLock e supersession, nem prova enforcement sistêmico de actor/capability.

### Veredito consolidado final da Wave 3

**HandoffPack: PASS CONDICIONAL.** As duas correções solicitadas fecham os buracos demonstrados em redaction de segredo conhecido e avanço de epoch, com testes que exercitam esses cenários. Permanecem limites de cobertura da regex e da fidelidade completa antes/depois.

**Wave 3 inteira: NÃO PROMOVER ainda.** O conjunto fica `PASS CONDICIONAL / BLOCKED` para próxima fase até haver (1) redaction obrigatória/mais robusta no boundary de transporte, (2) teste de reconstrução com base distinta e assertions de todos os campos relevantes, e (3) prova de persistência atômica/CAS em stores reais para ToolLoopLock e supersession. O DispatchRouter corrigido (`66c18914`) mantém actor e disponibilidade fail-closed no predicado.

SELF-CHECK: PASS — revisão read-only; nenhum merge, build ou teste executado.

## Adendo — Dispatch Router Fornalha (2026-09-12)

Alvo: commit `82c120e7` (`feat(runtime): add fail-closed dispatch router`), com `dispatch-router.ts` e `dispatch-router.test.ts`.

### O que está coberto

- A rota nega mismatch entre `task.organization_id` e `policy.organization_id` (`dispatch-router.ts:32-33`).
- Exige capability textual não vazia e lista de workers (`:35-41`).
- Filtra workers pelo mesmo tenant e pela capability requerida (`:43-49`).
- Nega quando não há worker capaz (`:50-52`) e quando nenhum candidato passa pela lista de policy (`:54-62`).
- Seleção determinística por `worker_id`/`agent_id` (`:57-65`).
- Os testes cobrem capability ausente, tenant mismatch, policy mismatch e seleção determinística (`dispatch-router.test.ts:18-43`).

### Achados

**FAIL — disponibilidade está fail-open.** `DispatchWorker.available` é opcional (`:9-15`) e o filtro aceita qualquer valor ausente porque testa `worker.available !== false` (`:45-46`). Um worker com disponibilidade desconhecida/malformada pode ser roteado. Para negar por padrão, o predicado deveria exigir `worker.available === true` (ou validar a origem/status antes da decisão). O teste não cobre `available: undefined` nem estado desconhecido.

**FAIL — actor não é validado antes do roteamento.** `DispatchTask` não tem `actor_id`/identidade do chamador, e `DispatchPolicy` só contém tenant e IDs permitidos (`:3-20`). A função valida capability declarada na task, mas não autentica nem autoriza o actor que a solicitou. Portanto “capability validada” é apenas capability do worker; actor/capability do solicitante permanecem `NOT_PROVEN`. O teste também não apresenta cenário de actor ausente, mismatch ou capability não autorizada do actor.

**PASS parcial — sem worker apto conhecido.** Quando a lista é vazia, malformed, sem capability ou sem match de policy, a decisão é `DENY`; porém a omissão de `available` impede chamar o conjunto inteiro de fail-closed.

### Veredito

**BLOCKED / FAIL para release:** o router não satisfaz integralmente fail-closed porque `available` ausente é tratado como disponível, e não há validação de actor antes do roteamento. Corrigir o default de disponibilidade, adicionar actor/authorization input (ou uma fronteira de autorização explícita anterior) e testes negativos correspondentes. Nenhum secret hardcoded ou logging sensível encontrado.

SELF-CHECK: PASS — inspeção estática read-only; nenhum merge, build ou teste executado.

## Adendo — Handoff Pack e veredito consolidado da Wave 3 (2026-09-12)

Alvo Handoff Pack: commit Fornalha `73a32373` (`feat(runtime): add session handoff pack`), com `handoff-pack.ts` e `handoff-pack.test.ts`. A correção de autoridade do Dispatch Router também foi considerada no commit `66c18914`.

### Handoff Pack

**FAIL — o pack pode transportar dados sensíveis sem redaction efetiva.** `createHandoffPack()` copia integralmente `goal`, `constraints`, `facts`, `decisions`, `promises`, `artifacts`, `errors`, `blockers`, `verification`, `source_refs` e `evidence_refs` (`handoff-pack.ts:43-65`). O campo `redacted` é apenas copiado de input; não há sanitização, allowlist, remoção de PII/segredos ou validação de que o conteúdo já foi redigido. Um caller que passe `redacted: true` ainda pode inserir conteúdo cru.

**FAIL — o teste não prova redaction.** O único cenário usa dados genéricos, define `redacted: false` e não insere PII/segredo nem verifica que conteúdo sensível foi removido. Portanto não há evidência de que o pack seja seguro para transporte.

**FAIL — reconstrução “fiel” está subtestada e ignora a transição de epoch.** O teste chama `reconstructSessionState(state, pack)` usando o mesmo `state` como base e espera igualdade (`handoff-pack.test.ts:30-43`). Como a implementação começa com `...clone(base)` (`handoff-pack.ts:73-87`), campos que não forem realmente reconstruídos podem permanecer iguais por acidente. Além disso, `to_execution_epoch` é aceito no pack (`:34-37`, `:48`), mas nunca é aplicado ao estado reconstruído; o resultado mantém `execution_epoch` do `base` (3), apesar de o pack declarar destino 4. O teste apenas verifica a metadata do pack e não afirma o epoch/versão/identidade do estado após handoff.

### Dispatch Router após correção de actor

O commit `66c18914` tornou `actor_id`, `actor_capabilities`, `policy.actor_id` e `allowed_actor_capabilities` obrigatórios na decisão e exige `worker.available === true` antes de rotear (`dispatch-router.ts:36-64`). Isso fecha os dois achados anteriores no predicado estático; os testes do commit original precisam ser atualizados para o novo contrato, mas a lógica revisada é fail-closed nesses pontos.

### Veredito consolidado da Wave 3

- SessionService skeleton: `PASS` apenas como superfície de tipos; enforcement runtime `NOT_PROVEN`.
- ToolLoopLock: `PASS CONDICIONAL` em memória/single-process; persistência distribuída/CAS real `NOT_PROVEN`.
- MemoryGate: `PASS` como função isolada fail-closed; cobertura sistêmica de actor/capability/policy `NOT_PROVEN`.
- DispatchRouter: `PASS CONDICIONAL` após `66c18914`; actor e disponibilidade agora negam por padrão, mas integração/autorização externa continua a provar.
- HandoffPack: **FAIL/BLOCKED** — redaction não implementada e teste de reconstrução não prova antes/depois real; `to_execution_epoch` é ignorado.

**Decisão:** não promover a Wave 3 para a próxima fase. Corrigir o Handoff Pack com redaction real (não apenas flag), reconstrução que aplique explicitamente o epoch de destino e teste com bases distintas, conteúdo sensível e assertions de ausência/transformação; depois repetir o gate consolidado.

SELF-CHECK: PASS — revisão read-only; nenhum merge, build ou teste executado.
