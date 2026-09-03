# Investigação profunda das branches remotas — 2026-09-02

## Escopo e método

Investigação somente leitura. Não houve merge, checkout de branch, push, delete ou alteração de refs. A árvore de trabalho já estava suja (`feat/website-form-a11y-phosphor`, com alterações e artefactos alheios), por isso a análise foi feita a partir dos objetos Git.

Para cada branch foi usado o diff solicitado, exatamente `git diff main...origin/<branch>` (merge-base até ao tip). Também foram lidos os conteúdos dos ficheiros funcionais com `git show origin/<branch>:<path>` e comparados com a árvore de `main` (`89c90510`). A comparação three-dot é a medida do trabalho que a branch acrescentou desde a sua base; a comparação da árvore atual é necessária para saber se esse trabalho entretanto foi refeito ou superado em `main`.

| Branch | Tip | Merge-base com `main` | Commits `main..branch` | Diff three-dot |
|---|---|---|---:|---:|
| `origin/agent-os-implementation-plan` | `12a2bc3227cde2cc605ecb04b4593e0349db950a` | `bdbd76703ea319dc84c85348c7a04dcf07799baf` | 107 | 69 ficheiros, +8.199/-348 |
| `origin/agent-os-phase-4-shadow-evals-planning` | `7bb5c53213dceeb77a5d578167bdcfa9283c93b` | `bdbd76703ea319dc84c85348c7a04dcf07799baf` | 195 | 112 ficheiros, +13.130/-351 |
| `origin/agent-os-verification` | `78543784215ce1e2957368fcf11d3e733eb79ab9` | `bdbd76703ea319dc84c85348c7a04dcf07799baf` | 252 | 142 ficheiros, +16.082/-655 |
| `origin/implementacao-tokens-channel-gateway` | `76dda2b17702cfd5ba847e62468b038b534cb597` | `11d5edaa3842e1593432317324b1d1ab1bf8685d` | 5 | 19 ficheiros, +1.574/-5 |

Os números acima são snapshots da investigação; não são contagem de funcionalidades prontas.

## 1. `origin/agent-os-implementation-plan`

### O que é

É a implementação inicial do Agent OS Fase 1/2, não apenas um plano. O contrato em `lib/agent-engine/contracts/agent-os.ts` define estados de execução (`running`, `waiting_approval`, `completed`, `blocked`, falhas e cancelamento), transições permitidas, níveis de autonomia, limites de passos/tools/tokens/custo/tempo, deteção de repetição e ausência de progresso, fingerprint determinístico de chamadas, contratos de tools e decisões de retry. Os testes em `lib/agent-engine/contracts/` cobrem esses contratos.

O branch também cria o kernel e as bordas de execução: policy engine (`policies/engine.ts`), approvals, runtime controls, registry/gateway de tools, seleção de modelo certificado, observabilidade (`run-recorder`, trace e provider events), adapter de execução Deskcomm e `vitest.agent-os.config.ts`. A intenção funcional é resolver identidade/tenant/agente, carregar contexto e skills limitadas, exigir policy/approval, executar um loop bounded e gravar evidência.

### O que `main` já tem

`main` já contém a mesma superfície e uma evolução posterior: `lib/agent-engine/kernel`, `policies`, `tools`, `execution`, `models`, `obs`, `autonomy`, `flywheel`, product agents e os contratos correspondentes. O histórico de `main` mostra as integrações de Fases 5, 6 e 7 e o merge final dos contratos de kernel (`89c90510`). A antiga implementação de `skills.ts` do branch foi substituída em `main` por governança e compatibilidade mais recentes.

### O que o branch tem que não está em `main`

Em termos de código de produto, nada que deva ser importado como novo: os módulos funcionais foram absorvidos, reescritos ou ampliados em `main`. O diff three-dot mostra, contudo, cinco testes antigos específicos de skills (`skill-lifecycle`, `skill-progressive-disclosure`, `skill-promotion-gate`, `skill-registry-governance`, `skill-tool-compatibility`) que não existem na árvore de `main`; os contratos equivalentes atuais estão noutras suítes/ficheiros. Isso é diferença de organização de testes, não uma capability ausente comprovada.

O branch inclui três migrations de 17/08. Duas alteram as mesmas funções de trigger com configurações contraditórias (`search_path = pg_catalog, public` em `20260817003000_0086...` e depois `search_path = ''` em `20260817154000...`). Os próprios comentários dizem que são preparação e não aplicação de produção. `main` tem a cadeia de migrations posterior e o baseline reconciliado; não se deve transportar estes ficheiros isoladamente.

### Estado na própria branch

É código substancial e os testes são determinísticos, mas não é uma entrega fechada: o plano `2026-08-17-agent-os-phase-2-agent-kernel-implementation-plan.md` mantém todos os dez tasks e passos como `[ ]`, inclusive typecheck, suite completa, build, composição final e evidência GO. Não há prova de build/deploy no branch. Além disso, a branch é um snapshot anterior à integração dos contratos de Fases 3–7; integrá-la hoje exigiria reconciliar APIs e migrations, não um merge mecânico.

### Valor e recomendação

O desenho é historicamente útil como origem/auditoria do kernel, mas a implementação já foi superada pela cadeia integrada de `main`. As migrations contraditórias e o plano sem checklist fechado aumentam o risco de ressuscitar um snapshot antigo.

**Recomendação: segura pra apagar, já obsoleta.** Preservar apenas referências históricas se forem necessárias para auditoria; não terminar de integrar este tip.

## 2. `origin/agent-os-phase-4-shadow-evals-planning`

### O que é

Apesar do nome, o tip é principalmente a continuação do branch anterior até a Fase 3 e o desenho/plano da Fase 4. Os commits finais são `feat(agent-os): add product Agent Kernel verification adapter`, `feat(agent-os): export product Kernel adapters`, documentação de Fase 3 GO e, por fim, `docs(agent-os): add Phase 4 shadow evals implementation plan`. O código funcional adicionado inclui `lib/agent-engine/kernel/*` e `lib/agent-engine/product-agents/*` (Atendimento, Sales, CRM Operator, Retention, Supervisor, Escalation, Verification), resolvers, definições, golden cases e testes unitários de wiring/roles/governance.

O documento da Fase 4 especifica quatorze tasks: contratos de eval, assertions de hard gates, datasets versionados, runner SHADOW via AgentKernel, regras por agente, quality judge, replay histórico estratificado, divergência humano/agente, métricas conservadoras, integração, adversarial gate, evidência de replay e GO final.

### O que `main` já tem

`main` contém os product agents e o kernel, além da implementação posterior da camada de evals em `lib/agent-engine/evals/` (`assertions.ts`, `contracts.ts`, `datasets.ts`, `runner.ts`, `quality-judge.ts`, `metrics.ts`, `historical-sampler.ts`, `historical-replay-command.ts`, `divergence.ts`) e testes `tests/unit/agent-evals-*.test.ts`. Também contém as Fases 5–7 integradas. Portanto, tanto o código de Fase 3 como o trabalho executável de Fase 4 existem hoje em versões posteriores.

### O que o branch tem que `main` não tem

Não há capability funcional exclusiva identificada. O artefacto exclusivo é o plano/spec de 18/08 da Fase 4 (e variações de documentação daquele snapshot). Os ficheiros de produto/kernel que o three-dot lista como adicionados já aparecem em `main`; na árvore atual, `main` ainda tem `outcome-collector`, contratos de migração e ajustes de integração que o branch não tinha.

### Estado na própria branch

O branch é funcional para a camada de kernel/product-agents, mas não é uma implementação completa da Fase 4: o plano lista explicitamente os tasks de código e de evidência como pendentes (`[ ]`), e não há no diff do tip os módulos `lib/agent-engine/evals/*` correspondentes ao plano. “Planning” é literal aqui. Não há prova final de typecheck/build/preview nem replay histórico sem mutações.

### Valor e recomendação

O plano pode servir como histórico de intenção e checklist de auditoria. Como branch de integração, foi substituído pelos evals efetivamente presentes em `main` e pelas integrações posteriores.

**Recomendação: segura pra apagar, já obsoleta.** Não integrar o snapshot; consultar o plano apenas para rastreabilidade se necessário.

## 3. `origin/agent-os-verification`

### O que é

É um snapshot técnico das Fases 5/6 sobre a base anterior: adiciona a fila de Learning Flywheel (`components/ai/Phase6LearningQueue.tsx`), alterações em `app/api/v1/ai/evolution` e rotas de propostas, hook `useEvolution`, camada de autonomia (`decision`, `evidence`, `promotion`, `risk-registry`, `store`) e a implementação do flywheel (`signals`, `clustering`, `candidates`, `eval-candidates`, `proposals`, `promotion-queue`, `rollout`, `monitoring`, `orchestrator`, `store`). Os testes cobrem adversarial/autonomy, clustering, proposals, rollout, monitoring, integração de Fase 6 e wiring do kernel.

O código é real: por exemplo, `runLearningFlywheelIteration` limita sinais/clusters/candidates, aplica orçamento de runtime e no-progress e faz upsert de propostas; a UI deixa explícito que a aprovação humana é obrigatória e não autopromove. As rotas endurecem UUID/tenant e aplicação de propostas.

### O que `main` já tem

`main` possui todas essas áreas e mais: os mesmos módulos de autonomy/flywheel/kernel/product-agents, contratos adicionais (`flywheel-migration-contract`, `outcome-collector`), correções nas rotas de proposals/evolution e os merges de Fase 6 e Fase 7. A UI e o hook atuais refletem a integração posterior. O log de `main` documenta `d5e53fec`/`19a3e36d` (Fase 6) e `26507491` (Fase 7).

### O que o branch tem que `main` não tem

Não há capability funcional exclusiva conservável. O branch carrega `docs/superpowers/verification/phase-6-midrun-2026-08-18-03.md`, cujo texto é explicitamente “Technical-only verification marker”, “No production deployment” e “No remote migration”; isso é evidência histórica, não um artefacto ausente de produto. Comparado com `main`, o branch falta correções e módulos posteriores (notadamente `outcome-collector` e os contratos de migração/integração atualizados).

### Estado na própria branch

É uma implementação técnica coerente e bem testada em isolamento, mas o próprio plano de Fase 6 ainda deixa steps de suite completa, typecheck/build, preview, evidência final, atualização de docs e GO como pendentes. O marcador de midrun proíbe interpretar a branch como deploy ou prova de produção. Assim, “rodaria se integrada” não está demonstrado para a árvore inteira; no mínimo dependeria de reconciliar a base e executar os gates atuais.

### Valor e recomendação

O conteúdo foi absorvido por `main`, que também contém correções posteriores e a Fase 7. Reanimar este tip reintroduziria rotas/UI/kernel antigos e poderia perder hardening já integrado.

**Recomendação: segura pra apagar, já obsoleta.** O marcador de verificação pode ser mantido apenas como histórico, não como justificativa para integração.

## 4. `origin/implementacao-tokens-channel-gateway`

### O que é

É a implementação de um gateway de canais com contrato provider-agnostic. Define tipos de envelopes/eventos/conteúdo/capabilities, `MessagingEngine`, registry fail-closed e erros determinísticos; cria engines WAHA e Meta Cloud que traduzem conteúdo normalizado para o adapter existente, expõem health, send, media download e ingest/subscribers; adiciona resolução exata de identidade, supervisão de sessão/leases/recovery, trace e sanitização de logs/tenant scope/guard de autorização. Os testes cobrem seam, engines, registry, identidade, segurança e session supervisor.

Há detalhes funcionais importantes no código: `authorizeGatewayToolCall` nega side effects em SHADOW e autoridade de conteúdo externo; `assertGatewayTenantScope` nega cross-tenant; `chooseRecoveryAction` exige reauth quando expirado e limita reconnect/restart; `assertNoAutomaticEngineMigration` impede troca silenciosa de engine. `WahaEngine` e `MetaCloudEngine` usam os adapters canónicos e recusam media sem URL/mime type.

### O que `main` já tem

`main` contém todos os 19 paths funcionais do gateway. O histórico mostra os mesmos passos com hashes reescritos/integrados: `5a189596` (types), `90e2fc49` (engine contract), `0b09f3e9` (registry), `09dcb063` (session supervision), `da36af24` (identity), `8c1c452d` (fail-closed identity) e `80607caf` (trace/security). Isso confirma absorção real, não coincidência de nomes.

### O que o branch tem que `main` não tem

Nenhum código funcional ou teste exclusivo. A comparação da árvore atual mostra somente diferenças cosméticas e comentários removidos, mais uma diferença comportamental relevante: o tip remoto remove comentários de fail-closed e comentários de lifecycle nos engines, enquanto `main` os preserva. Não existe migration/config nova exclusiva neste branch; o script `verify-implementacao-tokens-phase-02.sh` apenas ajusta a verificação.

### Estado na própria branch

O gateway é implementável e os contratos unitários são claros, mas o tip é um snapshot antigo: os engines têm `connect`/`disconnect` vazios por desenho (“lifecycle remains in existing control plane”), `downloadMedia` depende de callback opcional e não há prova de wiring de produção para cada engine. O `main` integrado é a variante mais segura, com comentários/documentação de limites preservados. Portanto, não há razão para tratar o remoto como uma entrega pendente a terminar.

### Valor e recomendação

Valor histórico: mostra a origem e os limites de segurança do gateway. Valor de integração atual: zero, porque `main` já contém o trabalho e preserva mais contexto/documentação. Integrar o tip remoto só causaria regressões cosméticas ou remoção de guardrails documentais.

**Recomendação: segura pra apagar, já obsoleta.**

## Conclusão consolidada

As quatro branches têm trabalho real, mas nenhum delta funcional que justifique integração hoje:

1. `agent-os-implementation-plan` — origem do kernel/Fase 2; absorvida e superada por Fases 3–7; migrations antigas contraditórias; **segura pra apagar**.
2. `agent-os-phase-4-shadow-evals-planning` — product agents + plano de Fase 4, não implementação completa; evals posteriores já estão em `main`; **segura pra apagar**.
3. `agent-os-verification` — snapshot técnico de autonomy/flywheel/Fase 6, sem prova final de deploy; `main` tem integração e correções posteriores; **segura pra apagar**.
4. `implementacao-tokens-channel-gateway` — gateway de canais funcional, mas já integrado por commits equivalentes em `main`; tip remove documentação/guardrails textuais; **segura pra apagar**.

Não foi apagada nenhuma branch nem alterada qualquer ref.
