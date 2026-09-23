# F8 — Matriz de infraestrutura GCP-only

**Status:** gate F8-C0; contrato de infraestrutura sem dado/auth. Sem valores de credencial, sem deploy, sem provisionamento e sem alteração de RLS/RBAC.

## 1. Fronteira

F8 padroniza CI, Secret Manager wiring, Artifact Registry, Cloud Logging/trace, Scheduler e Cloud Tasks. Sem dados, auth, RLS, RBAC, schema, migration ou cutover de usuário neste gate. O objetivo é gerar configuração verificável em dry-run e contratos testáveis; a ativação real é F8-H1 e depende do Owner.

## 2. Matriz de ambientes

| Ambiente | Execução | Banco/dado | Secrets | Artefato | Jobs | Rollback |
|---|---|---|---|---|---|---|
| Local | Node/pnpm, fake GCP e emuladores quando disponíveis | fixture/local; nenhum dado real | `.env.example`/placeholder | build local, sem push | dry-run | apagar flag local/config |
| CI | GitHub Actions com OIDC/fake ou credencial efêmera aprovada | Postgres de teste; sem dado real | nomes/contratos, nunca valores em log | Artifact Registry em dry-run no gate | contract tests, sem job real | reexecutar workflow e restaurar config |
| Staging | Cloud Run/Cloud SQL conforme decisão futura | tenant sintético | Secret Manager com IAM mínimo | registry não-prod | Scheduler/Tasks não destrutivos | flag off + versão anterior |
| Produção | somente após F8-H1 | fora do escopo C0 | provisionamento Owner | rollout controlado | janela e retry definidos | rollback de serviço/config, sem apagar dados |

Todo ambiente tem `environment`, `project`, `region`, `service_account`, `artifact_repository` e nomes lógicos de secrets explicitamente separados. Valores de credencial não aparecem nesta matriz.

## 3. Identidade e least privilege

Contas de serviço são separadas por função: runtime web, worker, CI publisher, scheduler/task invoker e observabilidade. Cada uma recebe somente o papel mínimo para a operação; nenhuma conta de request recebe owner/editor, acesso amplo ao Secret Manager, `BYPASSRLS` ou permissão de administrar IAM.

Matriz mínima a validar antes de ativação:

| Ator | Pode | Não pode |
|---|---|---|
| CI publisher | build e publicar imagem no repositório alvo quando aprovado | ler secrets de runtime ou dados |
| Runtime | ler somente secrets explicitamente necessários e emitir logs | criar IAM, publicar imagem ou listar secrets |
| Worker | executar fila/Task autorizada e ler seus secrets | aceitar tenant do payload sem validação ou administrar scheduler |
| Scheduler/Task invoker | invocar endpoint/handler com identidade de serviço | ler banco diretamente ou alterar IAM |
| Owner/admin de infraestrutura | provisionar e revisar IAM | ser usado como identidade genérica de request |

## 4. Componentes e contratos

### CI e Artifact Registry

- Workflow verifica Node/pnpm, typecheck, unit/invariants e test:db conforme `.claude/rules/testing-verification.md`.
- Build é determinístico, imagem recebe digest/tag imutável e publicação tem dry-run separado de push.
- Artifact Registry usa repositório por ambiente, limpeza/retention definida e rollback por digest anterior.
- Nenhum workflow imprime token, `gcloud auth` materializada ou conteúdo de Secret Manager.

### Secret Manager wiring

O código recebe somente nomes lógicos como `LUMENVA_SECRET_<NAME>`/mapping de ambiente; o valor é resolvido em runtime pelo adapter autorizado. Testes usam placeholder e verificam: ausência falha explicitamente, nome inválido não faz fallback silencioso, segredo nunca é logado e o processo não grava arquivo local. Criar o secret, valor, IAM e rotação real é F8-H1.

### Cloud Logging e trace

Logs estruturados carregam `request_id`, `organization_id` quando houver contexto, fase, resultado e latência. Redaction remove Authorization, tokens, cookies, API keys, bodies sensíveis e PII antes do sink. Retention, sink e alertas são nomes/contratos no C0; valores de projeto e retenção de produção só após revisão Owner.

### Scheduler e Cloud Tasks

Handlers são idempotentes, autenticados por identidade de serviço, validam tenant/contexto e aceitam retry sem duplicar efeito. O contrato local usa fake queue/emulador/dry-run. Scheduler só cria chamada em ambiente configurado; Cloud Tasks possui nome/dedupe, deadline, backoff e DLQ documentados. Nenhum job real é criado neste gate.

## 5. Rollback e critérios F8-C1

Rollback é: desabilitar flag/config do componente, voltar ao workflow/imagem/digest anterior e pausar Scheduler/Tasks sem apagar evidência. Cada componente precisa provar dry-run, configuração ausente, permissão excessiva rejeitada, redaction e retry/idempotência.

F8-C1, Codex-only, revisa IAM least privilege, Secret Manager, workflows, registry, logging, scheduler/tasks e confirma que não houve toque em dado/auth/RLS/RBAC. F8-H1 vem por último: APIs, service accounts/roles, secrets, registry, sinks/retention, jobs e deploy reais somente com ação explícita do Owner.

## 6. Subtarefas e dependências

`F8-C0 → F8-J1/J2/J3/J4/J5 em paralelo → F8-J6 → F8-C1 → F8-H1`.

| Tarefa | Allowlist | Saída |
|---|---|---|
| F8-J1 | `.github/workflows/**` relevante e testes de contrato CI | workflows verificáveis, sem deploy |
| F8-J2 | `packages/platform/gcp/secrets/**`, `tests/unit/gcp-secrets-contract.test.ts`, `docs/runbooks/gcp-secrets.md` | wiring placeholder |
| F8-J3 | `.github/workflows/publish-image.yml`, scripts de build/publicação e testes permitidos | Artifact Registry dry-run |
| F8-J4 | `packages/observability/gcp-logging/**`, testes e docs próprios | logger/redaction/trace |
| F8-J5 | `packages/platform/gcp/scheduler/**`, handlers exclusivos, testes e docs | Scheduler/Tasks fake |
| F8-J6 | `docs/runbooks/gcp-only/**`, `tests/unit/f8-infra-contract.test.mjs`, configs explícitas | integração dry-run |
| F8-C1 | revisão Codex e matriz final | achados e decisão |
| F8-H1 | console/provisionamento/credenciais reais | ativação controlada |

Cada Jules instala o ambiente no sandbox, usa placeholders, resolve falhas localmente, segue RED→GREEN, verifica `git diff --name-only` contra a allowlist e reporta apenas PASS/FAIL, arquivos, evidência e blocker. Sem secret, deploy, push ou merge automático.

## 7. Regras obrigatórias

- `.claude/rules/security.md`
- `.claude/rules/audit-observability.md`
- `.claude/rules/testing-verification.md`
- `.claude/rules/api-contract.md`
- `.claude/rules/multi-tenancy.md` quando um handler carregar contexto de tenant

Este contrato não concede autoridade para criar conta externa, aprovar custo, inserir valor de credencial, alterar IAM de produção ou criar job real. Essas ações ficam no último gate humano.
