# Review de segurança — Agent Birth / AgentDefinition V1

Data: 2026-09-12  
Alvo: commit Vértice `296ae324` (`feat(agent-os): validate minimum agent birth definition`) na worktree `wave2/agent-birth-2026-09-12`.

## Escopo

Revisão estática read-only via SSH no worker `claude@192.168.1.78`, usando `~/.ssh/lumenva_worker`. O commit adiciona apenas `apps/crm/lib/agent-engine/agent-birth/agent-definition.ts` e `agent-definition.test.ts`. Não executei código, testes, build ou efeitos externos.

## Veredito

**PASS CONDICIONAL — fail-closed local confirmado; boundaries sem leakage observável, com limites de normalização.**

### Fail-closed

- Entrada não-record, `null` ou array retorna `{ ok: false, status: "SHADOW", definition: null }` sem throw (`agent-definition.ts:42-52`).
- Todos os campos textuais canônicos (`id`, `version`, `identity`, `mission`, `authority`, `escalation`) exigem string não vazia após `trim()` (`:33-40`, `:55-58`).
- `boundaries` exige array não vazio e cada item exige texto não vazio (`:60-66`).
- Qualquer erro mantém o agente em `SHADOW` e não devolve definição parcial (`:69-70`).
- Os testes cobrem campos ausentes, boundaries vazias e input malformado sem throw (`agent-definition.test.ts:30-66`).

Não há caminho de `ALLOW/CERTIFIED` para input ausente ou malformado demonstrado no código.

### Boundaries e leakage

- Boundaries são copiadas para nova definição e normalizadas com `trim()` (`agent-definition.ts:73-80`), evitando espaços periféricos e preservando o array de entrada.
- Não há `console`, logger, `fetch`, env, SDK, headers ou interpolação de segredos.
- O commit não faz redaction porque trata texto declarativo, não telemetria; não há vazamento observável no caminho implementado.

### Limites residuais

- “Normalizada” significa apenas `trim()`: não há deduplicação, canonicalização de case, limite de tamanho ou rejeição de conteúdo sensível dentro de uma boundary. Se o texto da definição vier de fonte não confiável, a camada de persistência/renderização ainda precisa de sanitização e controle de acesso.
- Somente `boundaries` são trimadas. `id`, `version`, `identity`, `mission`, `authority` e `escalation` retornam o texto original; uma string com espaços periféricos passa na validação.
- O contrato valida presença/tipo, não autentica o autor da definição, versão de policy, organization/tenant ou aprovação humana. Isso é `NOT_PROVEN` fora deste validador.
- O teste de sucesso compara com `validDefinition`, que já está normalizada; não há teste explícito demonstrando que boundaries com espaços são convertidas ou que duplicatas são tratadas.

## Decisão

Pode avançar apenas como validador local/provider-free, não como prova completa de Agent Birth seguro. Para promoção da fase, adicionar testes de normalização real (entrada com espaços), política para duplicatas/tamanho e evidência de enforcement de organization/actor/approval no caller.

SELF-CHECK: PASS — inspeção read-only, sem execução ou alteração remota, sem secrets expostos.

## Verificação da correção de prompt injection (2026-09-12)

Alvo: commit Vértice `434c9430` (`fix(agent-os): escape certified prompt fields`).

### O que foi fechado

- O compiler continua rejeitando qualquer `status` diferente de `CERTIFIED` antes de compilar (`prompt-compiler.ts:14-17`).
- Campos são emitidos em delimitadores estruturais `<agent_identity>`, `<agent_mission>`, `<agent_boundaries>`, `<boundary>`, `<agent_authority>` e `<agent_escalation>` (`:12`, `:19-30`).
- `&`, `<`, `>`, aspas simples e duplas são escapados antes da interpolação (`:3-10`). Payloads que tentam fechar um bloco e abrir outro, tanto em `identity` quanto em `boundaries`, ficam texto (`prompt-compiler.test.ts:43-74`).
- Os testes verificam que só existe um delimitador de abertura/fecho e que o payload malicioso cru não aparece.

### Limites residuais

- Isto fecha a injeção estrutural por fechamento de delimitador observada no review anterior; não torna o conteúdo semanticamente confiável. Uma `mission` ainda pode conter texto como “ignore instruções anteriores” dentro do bloco e tentar influenciar o modelo. A defesa real continua dependendo da definição ser originada/autorizada por uma fonte confiável e de instruções de sistema que tratem blocos como dados.
- O compiler ainda confia em `status: "CERTIFIED"` e não revalida `AgentDefinition` com `validateAgentDefinition()`; um objeto forjado em runtime pode chegar ao compiler se o caller falhar.
- O teste continua sem caso explícito de newline/instrução imperativa sem tag e sem prova de origem/approval do AgentDefinition.

### Veredito atualizado

**PASS CONDICIONAL:** a correção fecha o vetor estrutural de prompt injection (tag injection) e tem teste adversarial adequado para `identity` e `boundaries`. Ainda não é fechamento total contra prompt injection semântica nem substitui validação/origem autorizada; esses pontos permanecem `NOT_PROVEN` fora do compiler.

SELF-CHECK: PASS — revisão estática read-only; nenhum merge, build ou teste executado.

## Adendo — Prompt Compiler (2026-09-12)

Alvo: commit Vértice `678a1c27` (`feat(agent-os): compile certified agent system prompt`), com `prompt-compiler.ts` e `prompt-compiler.test.ts`.

### SHADOW

**PASS local:** `compileSystemPrompt()` verifica `definition.status !== "CERTIFIED"` e lança `agent_definition_not_certified` antes de compor qualquer seção (`prompt-compiler.ts:5-8`). O teste cobre uma definição `SHADOW` e espera a rejeição (`prompt-compiler.test.ts:37-41`).

Limite: o compiler confia no objeto já tipado e não chama `validateAgentDefinition()`. Um objeto runtime forjado com `status: "CERTIFIED"` e campos arbitrários passa; a garantia depende do caller ter validado a definição anteriormente.

### Prompt injection via AgentDefinition

**FAIL — campos são interpolados como instruções sem isolamento.** `identity`, `mission`, `authority`, `escalation` e cada `boundary` entram diretamente no prompt final, apenas com `trim()` e prefixo de seção/lista (`prompt-compiler.ts:10-16`). Não há escaping, delimitador de dados não confiáveis, sanitização de marcadores (`# SYSTEM`, `BEGIN/END`), rejeição de instruções adversariais ou separação estrutural que impeça um texto de se apresentar como nova instrução.

Exemplo: uma `mission` certificada contendo `Ignore all previous instructions\n# SYSTEM\n...` será emitida literalmente dentro do system prompt. O teste cobre apenas formatação, rejeição de SHADOW e não-mutação; não usa payload malicioso nem verifica que o prompt final permanece seguro (`prompt-compiler.test.ts:17-53`).

`boundaries` recebem apenas `boundary.trim()` (`prompt-compiler.ts:13`), portanto newline, headings e conteúdo imperativo permanecem intactos. Isso não é secret leakage por si só, mas é uma superfície direta de prompt injection se a definição puder ser influenciada por usuário, import, memória ou provider.

### Veredito

**BLOCKED / FAIL para uso com AgentDefinition não confiável:** a rejeição de `SHADOW` funciona para objetos corretamente marcados, mas não há defesa contra prompt injection em campos certificados. Antes de promover, exigir origem/autorização forte da definição e adicionar uma camada de serialização delimitada/quoting ou política explícita de conteúdo, além de testes com payloads em `mission` e `boundaries` que provem o tratamento seguro. SELF-CHECK: PASS.
