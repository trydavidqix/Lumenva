# Lumenva Local Agent Runtime — Master Plan

> Branch alvo: `lumenva-command-center`
> Status inicial: PLANNED
> Fonte de verdade complementar: este documento estende `docs/LUMENVA_COMMAND_CENTER_PLAN.md` sem substituí-lo.
> Regra: não mergear automaticamente em `main`.

## 1. Objetivo

Adicionar ao Lumenva Command Center um **Local Agent Runtime** persistente, local-first, capaz de executar trabalho de engenharia no PC host 24/7 com isolamento, rastreabilidade e roteamento inteligente de modelos.

O objetivo não é recriar outro orquestrador nem substituir o Core existente. O Runtime será o **executor operacional** abaixo do Command Center/Core, reutilizando:
- Job Engine
- Event Bus
- Scheduler
- Resource Router
- Session Runtime
- Context Engine / MCG
- Approval/Policy layer
- Capability Registry
- History/Evidence/Trace
- MCP/CLI surfaces
- Worktree isolation

Arquitetura:

```
Owner / ChatGPT / Command Center
          |
          v
   Lumenva Core / Maestri bridge
          |
          v
 Local Agent Runtime
   |      |       |
   |      |       +--> Model Router -> Gemini / Claude / Codex / outros
   |      +----------> Context Engine / MCG
   +-----------------> Local Executor
                         |
                         +--> Filesystem
                         +--> Git/worktrees
                         +--> Tests/build/lint/typecheck
                         +--> Services/logs
                         +--> Browser later
```

## 2. Decisão arquitetural

### Reutilizar, não duplicar

Não criar um segundo Job Engine, Router, Event Bus ou sistema de approvals.

Mapeamento:

| Necessidade nova | Reusar |
|---|---|
| lifecycle de job | `packages/operating-core` Job Engine |
| sessão/retry/locks | Session Runtime |
| escolha de executor/modelo | Resource Router + Model Router |
| contexto mínimo | Context Engine / MCG |
| execução local | novo Local Executor |
| isolamento Git | Worktree Manager do Command Center |
| política de risco | Risk Router / Approval Engine |
| observabilidade | Trace + Evidence + HistoryStore |
| ponte externa | MCP/CLI/Lumenva Link |

## 3. Invariantes

1. Desktop fechado não mata o Runtime.
2. Renderer nunca recebe shell arbitrário.
3. Todo job de código usa workspace/worktree isolado.
4. Nenhum merge automático em `main`.
5. Executor não é verifier.
6. Comandos determinísticos não chamam LLM.
7. Modelo só recebe contexto mínimo compilado.
8. Toda mutação gera evidence/trace.
9. Secrets nunca entram em prompt, logs ou git.
10. Operações R3/R4 exigem approval conforme política.
11. Falha/restart deve permitir resume por checkpoint.
12. Limites de iteração, timeout e orçamento são fail-closed.

## 4. Componentes

### 4.1 Local Runtime Daemon

Processo independente do Desktop.

Responsabilidades:
- consumir jobs do Core;
- manter heartbeat;
- executar tool calls locais;
- emitir eventos;
- persistir checkpoints;
- sobreviver a restart;
- reportar capabilities/health.

Estados:
`OFFLINE -> IDLE -> CLAIMED -> RUNNING -> WAITING_APPROVAL -> VALIDATING -> DONE|FAILED|BLOCKED`.

### 4.2 Local Executor

Ferramentas estruturadas iniciais:

Read-only R0:
- `fs.read`
- `fs.search`
- `git.status`
- `git.diff`
- `git.log`
- `logs.read`
- `service.health`
- `port.check`

Workspace edit R1:
- `fs.write`
- `fs.patch`
- `git.branch`
- `git.worktree.create`
- `git.worktree.remove`
- `test.run`
- `lint.run`
- `typecheck.run`
- `build.run`

R2+:
- dependency install/update
- service restart
- config mutation
- commit creation
- networked actions

Evitar `powershell(command)` genérico como API primária.

### 4.3 Command Runner Boundary

Internamente pode usar PowerShell/ConPTY/process spawn, mas sempre com:
- cwd allowlist;
- executable allowlist;
- env allowlist/redaction;
- timeout;
- output cap;
- exit code;
- cancellation;
- trace id;
- risk classification.

### 4.4 Worktree Manager

Por job de engenharia:
1. resolve repo/base SHA;
2. cria worktree;
3. registra branch/path/SHA;
4. executa apenas dentro dele;
5. produz diff;
6. mantém até aprovação/cleanup.

Nunca reutilizar working tree sujo entre jobs independentes.

### 4.5 Context Engine integration

Pipeline:
```
task
-> repo metadata
-> git status/diff
-> failing command/output
-> code search
-> relevant files
-> constraints/decisions
-> compact context pack
-> model
```

Registrar:
- chunks selecionados;
- motivo;
- hashes;
- chars/tokens;
- cache hit/miss;
- provenance.

### 4.6 Model Router integration

Classes:
- DETERMINISTIC -> zero LLM
- TINY -> modelo barato/local
- LIGHT -> modelo rápido
- NORMAL -> modelo padrão
- HEAVY -> reasoning forte
- CODE_SPECIALIST -> Codex
- CRITICAL -> builder + verifier independente

O Router deve considerar:
- capacidade;
- custo/quota;
- latência;
- reliability;
- contexto;
- risco;
- disponibilidade.

### 4.7 Agentic Loop

```
PLAN
-> ACTION
-> EXECUTE
-> OBSERVE
-> VALIDATE
-> if fail: DIAGNOSE -> PATCH -> repeat
-> DONE/BLOCKED
```

Defaults iniciais:
- max_iterations: 20
- max_same_failure: 3
- max_model_retries: 3
- hard timeout por step
- hard budget por job

ToolLoopLock existente deve ser reaproveitado/fortalecido, não duplicado.

### 4.8 Verification

Perfis:
- QUICK: targeted tests
- STANDARD: targeted + lint/typecheck
- FULL: tests + lint + typecheck + build
- CRITICAL: FULL + reviewer independente

Completion nunca depende apenas de texto do modelo.

### 4.9 Approval Engine

R0: automático.
R1: automático dentro de worktree.
R2: execução controlada + evidence/review.
R3: owner approval.
R4: owner approval + verifier independente.

Ações destrutivas, produção, secrets e auth ficam bloqueadas por default.

### 4.10 Persistent state

Persistir pelo Core/HistoryStore:
- job
- steps
- attempts
- tool calls
- model calls
- checkpoints
- approvals
- artifacts
- evidence
- git refs
- errors
- final verification

Após reboot:
`recover -> verify lease/lock -> resume from checkpoint`.

### 4.11 API local tipada

Mínimo:
- `POST /jobs`
- `GET /jobs/:id`
- `POST /jobs/:id/cancel`
- `POST /jobs/:id/approve`
- `POST /jobs/:id/resume`
- `GET /runtime/health`
- `GET /runtime/capabilities`
- `GET /events` / websocket

Renderer fala com Core; nunca com OS diretamente.

### 4.12 MCP / Secure Tunnel

O MCP é uma **surface**, não o runtime.

Fluxo futuro:
```
ChatGPT/compatible client
-> Secure MCP Tunnel
-> Lumenva MCP
-> Core policy
-> Local Runtime
```

As mesmas tools precisam obedecer a policy/approval independente da surface.

### 4.13 Browser Runtime — fase posterior

Adicionar depois da V1:
- Playwright
- profile isolado
- DOM/screenshot evidence
- localhost smoke/E2E
- browser-specific approval boundaries

Não bloquear V1 por browser automation.

## 5. V1 end-to-end

Caso obrigatório:

> "Corrige todos os testes quebrados deste projeto."

Fluxo:
1. criar job;
2. identificar repo;
3. criar worktree;
4. executar baseline de teste;
5. guardar stdout/stderr + exit code;
6. localizar arquivos relevantes;
7. compilar context pack;
8. escolher modelo;
9. produzir patch;
10. aplicar patch;
11. reexecutar teste;
12. iterar com limites;
13. lint/typecheck/build conforme profile;
14. produzir diff;
15. gerar evidence bundle;
16. marcar DONE ou BLOCKED;
17. nunca mergear automaticamente.

## 6. Fases de implementação

### Phase LR0 — Audit & contracts
- mapear peças existentes;
- definir interfaces entre Core e Runtime;
- nenhuma duplicação de sistemas.
Gate: contratos tipados e architecture test.

### Phase LR1 — Runtime daemon
- lifecycle;
- heartbeat;
- capability advertisement;
- graceful shutdown/recovery.
Gate: processo independente + restart test.

### Phase LR2 — Local Executor read-only
- fs/git/logs/health.
Gate: R0 end-to-end sem LLM.

### Phase LR3 — Worktree + mutation
- worktree manager;
- patch/write;
- command runner.
Gate: job altera somente worktree.

### Phase LR4 — Validation engine
- test/lint/typecheck/build profiles.
Gate: completion derivado de exit codes/evidence.

### Phase LR5 — Context Engine bridge
- context pack;
- dedupe/cache/provenance.
Gate: modelo recebe apenas seleção rastreável.

### Phase LR6 — Model Router bridge
- deterministic bypass;
- provider adapters;
- quota/cost/reliability routing.
Gate: deterministic task = 0 model calls.

### Phase LR7 — Agentic loop
- observe/diagnose/patch/retry;
- ToolLoopLock;
- failure fingerprint.
Gate: broken-test fixture auto-repaired.

### Phase LR8 — Approval/Risk
- R0-R4;
- pause/resume;
- fail-closed.
Gate: R3/R4 impossível sem approval.

### Phase LR9 — Persistence/recovery
- checkpoints;
- lease;
- crash recovery.
Gate: kill/restart/resume test.

### Phase LR10 — Command Center UI
- jobs;
- runtime health;
- live events;
- approvals;
- diffs/evidence.
Gate: UI é projection do Core, não fonte de verdade.

### Phase LR11 — MCP/Link surface
- expose safe tools through existing bus;
- preserve policy semantics.
Gate: CLI/API/MCP retornam mesma policy decision.

### Phase LR12 — Browser automation
- Playwright;
- UI validation.
Gate: browser evidence attached to trace.

## 7. Estrutura sugerida

A localização final deve respeitar a estrutura real descoberta durante implementação, mas a separação lógica é:

```
packages/
  operating-core/
  local-runtime/
    src/
      daemon/
      executor/
      commands/
      worktrees/
      validation/
      recovery/
      contracts/

apps/
  command-center/
    ... UI/projections ...

packages ou módulos existentes:
  context/
  router/
  policies/
  evidence/
  mcp/
```

Se uma capacidade já existir em outro caminho, reutilizar em vez de criar estes diretórios literalmente.

## 8. Eventos novos

- `runtime.started`
- `runtime.heartbeat`
- `runtime.offline`
- `job.claimed`
- `job.step.started`
- `job.step.finished`
- `command.started`
- `command.finished`
- `validation.started`
- `validation.finished`
- `patch.applied`
- `approval.requested`
- `approval.resolved`
- `job.checkpointed`
- `job.resumed`

Compatibilizar com eventos existentes antes de adicionar nomes duplicados.

## 9. Evidence bundle mínimo

Para jobs de código:
- repo;
- base SHA;
- branch;
- worktree;
- comandos;
- exit codes;
- tests before/after;
- files changed;
- diff hash;
- model/provider se houve;
- tool calls;
- approvals;
- timestamps;
- final verification status.

## 10. Segurança

- nenhum admin by default;
- subprocess sem shell quando possível;
- allowlists;
- path canonicalization;
- symlink escape protection;
- env redaction;
- secret patterns;
- output truncation;
- command timeout;
- process tree kill;
- network policy;
- immutable audit/evidence;
- approval token bound a exact action/hash.

## 11. Non-goals V1

- controlar desktop GUI arbitrariamente;
- substituir Computer Use;
- merge automático;
- deploy produção;
- secrets management novo;
- browser 24/7;
- criar outro Maestri;
- criar outro banco de memória.

## 12. Critérios de sucesso V1

PASS somente se:
1. Runtime continua ativo sem Desktop.
2. Job sobrevive a restart.
3. Código é modificado apenas em worktree.
4. Task determinística não chama LLM.
5. Broken-test fixture pode ser diagnosticada, corrigida e validada.
6. Falha repetida termina em BLOCKED, não loop infinito.
7. Diff + comandos + exit codes aparecem no trace/evidence.
8. R3/R4 ficam bloqueados sem approval.
9. Nenhum secret é persistido em event/evidence.
10. Nenhum merge em main ocorre automaticamente.

## 13. Ordem prática imediata

1. Auditar os módulos reais atuais do `lumenva-command-center`.
2. Criar contratos Core <-> Local Runtime.
3. Implementar daemon + health/capabilities.
4. Implementar Executor R0.
5. Implementar Worktree Manager e Validation.
6. Criar fixture E2E de broken tests.
7. Só então integrar Model Router/Context Engine.
8. Depois approvals/recovery/UI/MCP/browser.

## 14. Observações da auditoria inicial

Já existem no repositório elementos que devem ser reaproveitados:
- `packages/operating-core` com Job Engine e event-log adapter;
- Session Runtime com `session-service.ts`, `memory-gate.ts`, `dispatch-router.ts` e `handoff-pack.ts`;
- ToolLoopLock já modelado;
- Resource Router e persistência/idempotência associada;
- contratos de approval/evidence;
- módulos MCP/CLI no Operating Core;
- arquitetura do Command Center já define Core separado do Desktop, PTY, worktree, Context Engine/MCG, Risk Router, Capability Registry, HistoryStore e Lumenva Link.

Pontos de cautela observados em auditorias existentes:
- partes históricas do Session Runtime foram classificadas como skeleton/single-process e precisam de persistência/CAS real antes de serem tratadas como robustas;
- alguns gates históricos ficaram pendentes de execução real;
- o novo Runtime não deve assumir que documentação histórica = estado comprovado do HEAD.

## 15. Regra de execução

Antes de cada fase:
- confirmar branch/SHA;
- inspecionar implementação existente;
- reutilizar antes de criar;
- implementar em fatias;
- rodar gates;
- registrar evidence;
- não mergear `main`.
