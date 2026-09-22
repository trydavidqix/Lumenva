# Plano Único — Integração Permanente Maestri ↔ Codex Cloud

Status: PLANEJADO  
Branch de implementação: `feat/f1-identity-mapping`  
Environment Codex Cloud: `trydavidqix/Lumenva`  
ENV_ID: `6aa57726ade881919b0e02786359a0c3`

## Objetivo

Eliminar os stubs do caminho Maestri → Codex Cloud e transformar o Cloud em um executor assíncrono real, rastreável e permanente. O Maestri deve submeter tarefas, persistir o identificador remoto, acompanhar o lifecycle, capturar resultado/erro sem depender do navegador e retomar automaticamente a orquestração.

Fluxo canônico:

```text
OWNER
  → CLAUDE/LUMEN CEO
  → CTO CODEX via Maestri
  → Codex Cloud
  → watcher/event bridge
  → resultado persistido
  → Maestri
  → Claude/Codex continua
  → GitHub
  → VPS quando autorizado
```

## Problemas confirmados

1. `packages/operating-core/src/cloud-fabric/codex-adapter.ts` ainda retorna sucesso simulado.
2. `apps/social-brain-mcp/src/tools/maestri.ts` ainda cria `stub-job-id` e `maestri.jobs.get` devolve resultado fictício.
3. O lifecycle real de uma task Cloud não é persistido pelo Maestri.
4. Quando a task termina ou falha, o Maestri não recebe um evento de conclusão e acaba dependendo de consulta manual/browser.
5. Dispatch por branch não pode depender apenas da branch implícita do processo local. O ref deve ser explícito e validado antes da submissão.
6. O erro observado `Provided git ref feat/f1-identity-mapping does not exist` deve ser tratado como erro de preflight/dispatch, com evidência suficiente para diagnóstico sem abrir a UI do Codex.

## Invariantes permanentes

- Nunca retornar sucesso simulado para uma execução Cloud real.
- Toda execução deve possuir `job_id` local e, após submissão, `cloud_task_id` remoto.
- Toda execução deve registrar repo, branch/ref explícito, base SHA, ENV_ID, timestamps e estado.
- Antes do dispatch, confirmar que o ref remoto existe.
- O dispatch deve sempre fornecer explicitamente a branch/ref selecionada ao Codex Cloud; não depender silenciosamente do HEAD de outro terminal/worktree.
- Não usar browser/computer-use como mecanismo primário para descobrir erro de task.
- Estado persistido/event log é fonte de verdade; scrollback de terminal não é.
- Reiniciar Maestri/terminal não pode perder jobs em andamento.
- Resultado final deve ser consumido uma única vez de forma idempotente.
- Nenhum secret/token deve ser persistido em job, evento, relatório ou log.
- Falha de Cloud deve virar estado `FAILED` com erro estruturado; nunca falso `COMPLETED`.
- Aplicar diff/merge/deploy continua sujeito às políticas existentes de revisão/autorização.

## Modelo de estado

Manter os estados existentes:

```text
QUEUED
PREPARING
WORKING
COMPLETED
FAILED
CANCELLED
```

Sem criar um estado WAITING apenas para representar polling. `WORKING` significa que existe execução remota ativa.

Transições válidas:

```text
QUEUED → PREPARING
PREPARING → WORKING
PREPARING → FAILED
WORKING → COMPLETED
WORKING → FAILED
QUEUED/PREPARING/WORKING → CANCELLED
```

Estados terminais não podem regressar.

## Modelo CloudJob

Estender `CloudJob` preservando compatibilidade:

```ts
cloud_task_id?: string;
environment_id?: string;
remote_ref?: string;
result?: ExecutionResult;
error?: {
  code?: string;
  message: string;
  raw?: string;
};
completed_at?: Date;
consumed_at?: Date;
```

Persistir também a versão/forma do comando usada no dispatch quando útil para auditoria, sem credenciais.

## CodexAdapter real

Substituir o stub por uma interface assíncrona explícita:

```ts
submit(contract, context)
  -> { cloudTaskId, state }

getStatus(cloudTaskId)
  -> queued | working | completed | failed | cancelled

getResult(cloudTaskId)
  -> {
       summary,
       diff,
       branch,
       sha,
       filesChanged,
       tests,
       exitCodes,
       evidence
     }
```

`execute()` só deve permanecer como façade se puder cumprir corretamente o contrato. Não bloquear indefinidamente um turno do Claude esperando Cloud.

### Preflight obrigatório

Antes de criar a task:

1. Resolver repo e branch/ref a partir do contrato.
2. Validar branch/ref no remoto.
3. Capturar SHA remoto.
4. Confirmar ENV_ID configurado.
5. Registrar `PREPARING`.
6. Submeter usando branch/ref explicitamente.
7. Capturar `cloud_task_id`.
8. Registrar `WORKING`.

Se o ref não existir, falhar localmente com `GIT_REF_NOT_FOUND` e NÃO gastar uma tentativa Cloud.

Para Lumenva, o environment canônico atual é:

```text
repo: trydavidqix/Lumenva
environment_id: 6aa57726ade881919b0e02786359a0c3
```

A configuração deve viver em configuração operacional validada, não duplicada em vários arquivos de código.

## CloudJobStore

Criar uma abstração persistente, por exemplo:

```ts
interface CloudJobStore {
  create(job: CloudJob): Promise<void>;
  get(jobId: string): Promise<CloudJob | null>;
  update(jobId: string, patch: Partial<CloudJob>): Promise<CloudJob>;
  listActive(): Promise<CloudJob[]>;
}
```

Usar a fonte persistente já adotada pelo runtime do Maestri. Não introduzir banco paralelo só para esta feature.

## CloudJobWatcher

Criar worker/watch loop independente do turno interativo.

Responsabilidades:

1. Recuperar jobs `WORKING`.
2. Consultar status remoto com backoff limitado.
3. Em conclusão, buscar resultado/diff/evidências disponíveis.
4. Persistir estado terminal antes de emitir evento.
5. Emitir `cloud.job.completed`, `cloud.job.failed` ou `cloud.job.cancelled`.
6. Ser idempotente após restart.
7. Não emitir conclusão duplicada.
8. Registrar erro de polling sem transformar automaticamente o job em FAILED por uma falha transitória de rede.

Polling deve ter intervalo configurável e backoff; não usar loop apertado.

## Event bridge / retomada automática

Após persistir estado terminal:

```text
CloudJobWatcher
  → event log
  → cloud.job.completed / cloud.job.failed
  → Loop Controller / Maestri
  → identifica parent task/thread
  → entrega resultado estruturado
  → Claude CEO ou Codex retoma a decisão
```

O agente não deve precisar perguntar repetidamente `jobs.get`.

Cada job precisa de correlação suficiente para voltar ao fluxo correto, por exemplo `parent_task_id`, `correlation_id` ou equivalente já existente no runtime.

## MCP Maestri

### maestri.jobs.create

Remover `stub-job-id`.

Retornar no mínimo:

```json
{
  "jobId": "...",
  "cloudTaskId": "...",
  "state": "WORKING",
  "repo": "trydavidqix/Lumenva",
  "branch": "feat/f1-identity-mapping",
  "baseSha": "..."
}
```

Para `dry_run`, executar preflight e mostrar destino/ref resolvido sem criar task remota.

### maestri.jobs.get

Remover resultado fictício. Ler `CloudJobStore`.

Retornar estado real, erro estruturado e resultado quando disponível.

### maestri.tasks.dispatch

Integrar ao mesmo caminho real; não criar um segundo mecanismo Cloud.

## Tratamento do erro de git ref

O caso observado deve produzir algo semelhante a:

```json
{
  "state": "FAILED",
  "error": {
    "code": "GIT_REF_NOT_FOUND",
    "message": "Remote ref is unavailable to the selected Codex Cloud dispatch."
  },
  "repo": "trydavidqix/Lumenva",
  "branch": "feat/f1-identity-mapping",
  "expectedSha": "...",
  "cloudTaskId": "..."
}
```

Se o preflight comprovar que a branch existe mas o Cloud ainda rejeitar o ref, preservar as duas evidências no relatório. Não concluir automaticamente que o Environment está preso em `main`.

## Configuração permanente

Centralizar configuração Codex Cloud:

```text
provider = codex-cloud
repo = trydavidqix/Lumenva
environment_id = 6aa57726ade881919b0e02786359a0c3
explicit_branch = required
preflight_remote_ref = required
watcher = enabled
resume_on_completion = enabled
browser_error_scrape = disabled-as-primary-path
```

Valores sensíveis continuam fora do Git. ENV_ID não é secret, mas deve ter uma única fonte operacional.

Na inicialização do Maestri, validar configuração e capacidade da CLI. Se faltar requisito, marcar provider indisponível e produzir diagnóstico; não cair silenciosamente para stub.

## Observabilidade

Eventos mínimos:

```text
cloud.job.queued
cloud.job.preparing
cloud.job.submitted
cloud.job.poll
cloud.job.completed
cloud.job.failed
cloud.job.cancelled
cloud.job.consumed
```

Campos: `job_id`, `cloud_task_id`, provider, repo, branch, SHA, timestamps, correlation ID e erro sanitizado.

Nunca registrar prompts/diffs completos por padrão se puderem conter dados sensíveis.

## Testes

### Unitários

- transições de estado válidas/inválidas;
- parser de status/resultado;
- branch explícita;
- preflight ref existente/inexistente;
- erro Cloud;
- polling transitório;
- idempotência;
- restart com job WORKING;
- evento emitido uma única vez;
- remoção dos retornos stub.

### Integração

- dry-run resolve environment/ref;
- submit captura task ID;
- watcher observa estado terminal;
- resultado fica disponível via `maestri.jobs.get`;
- evento retoma o fluxo correto;
- task FAILED retorna motivo sem browser;
- branch inexistente falha antes do Cloud.

### Gate real

Usar uma task Cloud pequena e sem secrets sobre branch publicada. Registrar task ID, branch, SHA, status, diff/resultado e exit codes disponíveis.

Não usar produção como teste.

## Ordem de implementação

1. Criar/validar configuração única do Codex Cloud.
2. Estender `CloudJob`.
3. Implementar `CloudJobStore`.
4. Implementar preflight Git/ref.
5. Implementar `CodexAdapter.submit/getStatus/getResult`.
6. Trocar `maestri.jobs.create/get` para o caminho real.
7. Implementar `CloudJobWatcher`.
8. Conectar eventos ao Loop Controller/Maestri.
9. Fazer `maestri.tasks.dispatch` reutilizar o mesmo pipeline.
10. Adicionar testes unitários e de integração.
11. Executar gate Cloud real em branch publicada.
12. Só então remover qualquer fallback stub restante.

## Critérios de aprovação

A implementação só é APROVADA quando todos forem verdadeiros:

- nenhum caminho de produção retorna `stub-job-id`, `stub-task-id`, `src/example.ts` ou `Codex completed the task.`;
- branch/ref é explícito e validado antes do dispatch;
- task ID real é persistido;
- Maestri sobrevive a restart e continua acompanhando job ativo;
- conclusão/falha chega automaticamente ao fluxo de orquestração;
- `jobs.get` mostra estado/resultado real;
- erro da Cloud é acessível sem Chrome/browser;
- não há segredo em logs/store;
- testes unitários e integração passam;
- gate Cloud real passa ou, se falhar por causa externa, a causa é capturada de forma estruturada e reproduzível;
- nenhuma mudança é aplicada/mergeada/deployada automaticamente fora das políticas existentes.

## Relatório final obrigatório

Ao terminar a implementação, gerar um único relatório final com:

```text
MAESTRI ↔ CODEX CLOUD — RELATÓRIO FINAL

VEREDITO: APROVADO | NÃO APROVADO

Branch:
Commit/SHA:
Environment:
Cloud task usada no gate:

Preflight ref:
Submit:
Persistência:
Watcher:
Retorno automático ao Maestri:
jobs.create:
jobs.get:
tasks.dispatch:
Restart/recovery:
Testes:
Segurança/logs:

Falhas encontradas:
- ...

Evidências:
- task IDs
- SHAs
- comandos/gates e exit codes
- arquivos alterados

Pendências:
- ...

Motivo do veredito:
...
```

Não declarar APROVADO por implementação parcial. Se qualquer critério obrigatório falhar, o veredito é NÃO APROVADO com a causa exata.

## Regra de continuidade

Este documento é o plano canônico para a integração Maestri ↔ Codex Cloud nesta branch. Alterações futuras devem preservar: branch explícita, preflight, persistência, watcher, eventos, retomada automática e relatório final. Não reintroduzir dependência de browser nem stubs como caminho de sucesso.
