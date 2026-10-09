# Plano único de implementação — Unificação Lumenva em 15 tarefas

> Para o Jules: executar uma tarefa de cada vez, no repositório `trydavidqix/Lumenva`. Ler este documento inteiro antes da tarefa atribuída. Não criar subagentes, iniciar outras tarefas, fazer merge, publicar serviços ou modificar os repositórios de origem. Este documento é um plano para revisão, não uma autorização para executar as 15 tarefas automaticamente.

**Objetivo:** tornar Lumenva o único repositório canônico do produto e das ferramentas próprias necessárias à sua operação, incorporando capacidades úteis dos nove outros repositórios, sem perder o CRM, duplicar implementações ou misturar dados de clientes com o ambiente de engenharia.

**Arquitetura proposta:** evolução incremental do monorepo existente, com módulos por domínio e integrações por interfaces explícitas. CRM continua a superfície central; redes sociais, produção de mídia, memória/contexto, governança, ferramentas e WebMCP entram como módulos. Um repositório pode conter vários processos e bancos especializados; não exige um único processo ou uma troca geral de banco.

**Base técnica:** Node 22; pnpm 9.15.9 do Lumenva; Next.js/React/TypeScript já usados no destino; contratos existentes e testes canônicos. Dependências de origens com versões incompatíveis precisam de comparação antes da importação. Preservar o provider de autenticação e o banco efetivamente ativos no destino; nenhuma migração geral Supabase/Firebase/GCP/Neon é implicitamente autorizada.

**Spec:** a proposta de arquitetura, as restrições e os critérios de conclusão deste próprio documento constituem o desenho de referência para estas 15 tarefas. Ainda requer revisão do Owner; não existe aprovação técnica prévia implícita.

**Escopo assumido:** os dez projetos selecionados. Consolidar o que existe e integrar as capacidades selecionadas. Blueprints de funcionalidades futuras não se tornam funcionalidades implementadas pela simples importação da documentação. Uma tarefa é uma etapa de entrega e pode precisar de mais de uma sessão Jules; não se promete concluir a migração em exatamente 15 sessões.

## 1. Pesquisa e evidência

Pesquisa realizada em 2026-10-08:

- O README do pacote oficial `@google/jules` foi consultado em `https://registry.npmjs.org/@google/jules`; a versão indicada pelo registro era `0.1.42`. Documenta `jules new --repo owner/repository "prompt"`, `jules remote list --session`, `jules remote list --repo` e `jules remote pull --session ID`.
- O repositório da Google `https://github.com/google-labs-code/jules-awesome-list` foi consultado via seu README público. Recomenda tarefas delimitadas, contexto específico, identificação de duplicação e extração de módulos.
- O CLI também documenta `--parallel`, mas este plano deliberadamente usa sessões sequenciais. Uma opção de paralelismo não elimina conflitos de arquivos, dependências ou contratos.
- `https://jules.google/docs/` e `https://jules.google/docs/api/` continuaram a receber bloqueio `403` pelo proxy. Não foram confirmadas por essas páginas as quotas do plano, a política de branches da UI, limites de duração, acesso a repositórios privados adicionais ou opções de API. Verificar essas capacidades no Jules antes de automatizar o envio; não inventar flags de CLI.
- Nesta pesquisa não houve login Jules, criação de sessão, PR, merge ou deploy.

Inspeção de código do destino e das origens:

- `Lumenva/apps/crm` já contém contactos, leads, funil, conversas, automações, agentes, RBAC e invariantes de isolamento.
- `Lumenva/packages/core/operating-core` já tem contratos de jobs/eventos, memória, roteamento, autonomia, workforce, evidências e resultados. Não criar um segundo núcleo concorrente sem mapear esta implementação.
- Comparação de arquivos rastreados: 2.316 arquivos de `Lumenva-Legacy/apps/crm` eram idênticos aos correspondentes do destino; 219 eram diferentes; 2 não tinham correspondente nesse caminho. Igualdade de bytes não prova equivalência de comportamento e diferenças não provam melhoria.
- O Social Brain já está amplamente incorporado: comparação de `apps/web` com `apps/social-web` encontrou 62 iguais, 2 diferentes e 1 sem correspondente; `packages/core` com `packages/core/social-brain/core` encontrou 52 iguais e 3 diferentes. Importar novamente todos esses arquivos criaria dívida.
- Nexus tem memória/contexto, contratos, control plane, execução, evidências, governança, provedores, indexação GitHub, inteligência de código, CLI, Edge e painel. Seu `packages/compat` é uma fachada, não uma implementação autoritativa independente. Há sobreposição com Operating Core que deve ser resolvida explicitamente.
- ToolMesh tem bootstrap de controlo de tarefas e regras de repositório. Seus diretórios `apps/api` e `apps/web` não comprovam um produto completo de conectores; não tratar arquitetura OpenConnector como implementação pronta.
- BrowserMesh contém WebMCP, bridge, funcionalidades de interface e worker. A demonstração com estado em memória não substitui operações CRM autenticadas.
- `social-media` contém API/worker/dashboard, SQLite, produção e verificação de mídia, FFmpeg e adapters. Google Flow é manual; Docker é proibido pelas regras dessa origem.
- `lumenva-social` contém publicação, automações, inbox, contactos/leads, cron e conteúdo/referências com SQLite. É originalmente pessoal: importar para multiempresa exige isolamento e identidade.
- `Agent-Os-` e `UniversalAgentOS` têm essencialmente documentação arquitetural; aproveitar decisões úteis, não anunciar código de produto inexistente.

A inspeção foi dirigida a estruturas, contratos, fontes representativas e diferenças de arquivos; não foi uma leitura integral de todos os arquivos nem auditoria de segurança completa. Estes são snapshots de inspeção, não certificados de prontidão. A tarefa 01 revalida os SHAs, diferenças, licenças e testes atuais antes de qualquer importação.

## 2. Fontes congeladas e seleção

| Origem | SHA observado | Seleção pretendida |
|---|---|---|
| Lumenva | `3fbe74a3ff7b7a99538d1e53aa55688294b7ba99` | Destino; CRM e módulos já consolidados são a base |
| Lumenva-Legacy | `6e9dbbd901445cfbec53955981a7dab6d644b9da` | Apenas melhorias únicas demonstradas por teste ou contrato |
| lumenva-social-brain | `80a877bde72bd6a27a5d20ff2f6231a7e0f72995` | Deltas úteis, aprovação por snapshot, analytics, adapters e engenharia |
| lumenva-social | `54c3b32c934462277320874fc3630882d2855f39` | Publicação, carrossel, inbox, automações, conteúdo e referências |
| social-media | `879ba34e1d0c50a01d3885255abc4ef91f11d5c6` | Produção de avatar/vídeo, QA, exportação e adapters |
| nexus-brain | `70f663bf160edee7e0979a18f4334d753d40eb17` | Memória/contexto, execução, governança, evidência, indexação e ferramentas de engenharia |
| ToolMesh | `07fdc0a9fd06da2a3d839cdcdadc601398adda00` | Controlo de tarefas e princípios de registry/adapters existentes |
| BrowserMesh | `061e38292dc850e06750dc99c66dc9dc8df503f6` | WebMCP, bridge e capacidades implementadas selecionadas |
| Agent-Os- | `bc6802d274bf2d074c9a48a42bdb47ba4ec41f21` | Blueprint de domínios, avaliação e governança |
| UniversalAgentOS | `147c012525e5f9de266bfb8882e4d3d507cb2feb` | Regras compartilhadas e adaptação entre runtimes |

A tarefa 01 deve verificar os dez SHAs e o acesso às fontes, incluindo os dois repositórios documentais. Revisões novas só entram por atualização explícita da matriz, acompanhada de novo diff/revisão. O código do destino evolui após cada tarefa; não fixar todas as sessões ao SHA inicial do Lumenva.

Classificar cada capacidade como `KEEP_DESTINATION`, `PORT_DELTA`, `ADAPT`, `DOCUMENT_ONLY`, `DEFER` ou `REJECT`, com origem, motivo, teste, dependências, licença e destino. “Parte boa” significa comportamento útil com evidência e compatibilidade; não basta ser mais recente ou ter mais arquivos.

Nenhuma origem é eliminada durante as 15 tarefas. No encerramento, gerar uma proposta de arquivamento para decisão humana, preservando histórico, releases e material não migrado. Arquivamento GitHub é uma ação separada.

## 3. Estrutura de destino

Preservar os caminhos existentes que já funcionam. Caminhos novos abaixo são propostas de destino, não afirmações de que já existem:

```text
Lumenva/
  apps/
    crm/                    # produto central e entrada dos domínios
    website/                # institucional existente
    social-web/             # frontend social existente; acesso integrado
    social-mcp/             # ferramentas sociais existentes
    social-worker/          # jobs sociais existentes
    video-composer/         # composição de vídeo existente
    voice-worker/           # voz existente, preservada
    control-center/         # operações de engenharia vindas do Nexus
    edge/                   # Edge/local MCP opcional vindo do Nexus
    media-api/              # API de produção de mídia vinda de social-media
    media-worker/           # worker de mídia
    browser-lab/            # superfície experimental BrowserMesh, opcional
  packages/
    core/
      operating-core/       # fachada pública estável durante a transição
      social-brain/         # domínio social já incorporado
      nexus/                # donos canônicos selecionados: brain/execution/etc.
      media-production/     # pipeline de mídia e adapters
    integrations/
      ...                   # integrações atuais
      tool-registry/        # registry e adapters de ferramentas
    platform/
      unification/          # contratos de fronteira e módulos
      browsermesh/          # adapter WebMCP do produto
      engineering-runtime/  # regras/adapters Codex/Claude/Jules, sem novo LLM
  tooling/
    scripts/unification/    # aquisição de fontes, gates e proveniência
    unification/            # manifesto, donos de arquivos e tarefas
  docs/unification/         # decisões, evidência e runbooks
```

O projeto deve ter uma entrada e identidade Lumenva para o utilizador. Não duplicar autenticação nem copiar tokens entre apps. Integração de acesso passa por sessão validada no servidor, RBAC e contratos de identidade. Operações técnicas com shell, filesystem, provider de engenharia ou credenciais ficam no controlo de engenharia com acesso separado e explícito.

Nexus pode inicialmente manter nomes de pacotes `@nexus-brain/*` para preservar consumidores e resolução; renomear apenas quando houver vantagem comprovada. Não criar aliases relativos atravessando pacotes. Dependências workspace são declaradas nos manifests.

## 4. Restrições globais e prevenção de conflitos

1. Ordem obrigatória: **01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10 → 11 → 12 → 13 → 14 → 15**. Não enviar as 15 sessões simultaneamente.
2. Uma tarefa, uma branch, uma PR. Sugestão de nome: `feat/unification-NN-resumo`, sujeita ao contrato de branch atual do destino.
3. Iniciar a tarefa N somente quando N−1 estiver revista, integrada e os gates necessários passarem no SHA integrado. O Owner faz ou autoriza cada merge; Jules não faz auto-merge.
4. Registrar `base_sha` da main atual, `source_sha` de cada origem, lista de arquivos permitidos, interfaces e testes antes de editar.
5. Se main mudar durante a sessão, parar novas edições, comparar os commits e revalidar sobre uma base integrada atualizada. Nunca resolver conflitos escolhendo automaticamente “ours” ou “theirs”.
6. Arquivos compartilhados — root `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, contratos, `.env.example`, policies e esquema — têm um único escritor na sessão corrente. As tarefas 03/06/07/08/09/11/12/14/15 podem atualizar manifests/lockfile quando importam módulos ou concluem integração; explicar cada mudança. Outra tarefa precisa pedir ampliação explícita de escopo antes de tocá-los.
7. A matriz de ownership criada na tarefa 01 fixa a allowlist de cada tarefa. Uma tarefa não pode enfraquecer seu próprio gate nem ampliar sua allowlist para legitimar uma alteração já realizada.
8. Esquema: somente migration aditiva com baseline/MANIFEST/tipos atualizados quando o contrato do destino exigir. Numeração reservada pela sessão corrente após ler a main; nada de números escolhidos agora ou edição de migrations aplicadas.
9. Nada de reset hard, clean, force-push, apagar checkout, apagar repositório, deploy, migrar produção, chamar serviços pagos ou publicar conteúdo real.
10. Credenciais fora do Git e prompts. Acesso privado às origens deve ser verificado dentro do Jules; autorização de um repo não prova acesso a outro. Sem acesso, devolver `BLOCKED_SOURCE_ACCESS`, não fabricar código.
11. Fontes adicionais são somente leitura, com SHA verificado, fora do checkout de trabalho, por exemplo `/tmp/lumenva-sources`. Não presumir que os checkouts desta conversa existem na VM Jules. Se necessário, o Owner fornece bundles/arquivos autorizados, com commit e SHA-256, pelo mecanismo suportado. Não incluir segredos, dados pessoais ou dependências geradas nesses arquivos.
12. Preservar autenticação, TLS, checksums e assinaturas. Não usar `--no-frozen-lockfile` para esconder discrepâncias. Atualizações de lock são intencionais e revisadas.
13. Testes usam dados sintéticos, DB local isolado e clientes falsos; nunca credenciais ou dados de produção. Não fazer mocks passarem como prova de OAuth/publicação real.
14. Portar `social-media` sem instalar containers. Serviços nativos ou hosted APIs autorizadas; requisito de Docker de qualquer componente precisa de decisão separada.
15. Não trocar modelos bloqueados das origens implicitamente. Políticas de modelo/runtime entram na matriz e permanecem isoladas por capability; nenhuma execução real de agente filho é autorizada por esta consolidação.
16. Supabase, Firebase/GCP, Neon, SQLite e storage mantêm donos definidos. Identidade unificada não implica fundir tabelas, IDs ou dados existentes sem migrador e rollback.
17. Licenças: o destino não tem autoridade para relicenciar código de terceiro. Não copiar referências AGPL do Postiz para código distribuído MIT. Preservar notices e verificar direitos dos donors sem LICENSE antes do port.
18. A etapa 15 pode preparar release e runbook. Publicação e arquivamento continuam ações humanas explícitas, depois dos gates.

## 5. Contratos e responsabilidade

A tarefa 02 publica os contratos de fronteira em `packages/platform/unification/src/contracts.ts` e a lista de módulos em `src/module-registry.ts`:

```ts
type Domain = 'crm' | 'social' | 'media' | 'engineering' | 'browser';
interface ActorContext {
  organizationId: string;
  actorId: string;
  actorKind: 'human' | 'agent' | 'service';
  requestId: string;
  permissions: readonly string[];
}
interface ActionProposal {
  id: string;
  organizationId: string;
  actorId: string;
  domain: Domain;
  capability: string;
  idempotencyKey: string;
  payload: Readonly<Record<string, unknown>>;
  policyVersion: string;
  approvalRef?: string;
}
interface ActionReceipt {
  proposalId: string;
  organizationId: string;
  status: 'succeeded' | 'denied' | 'failed';
  evidenceRefs: readonly string[];
}
interface ModuleDescriptor {
  id: string;
  domain: Domain;
  enabled: boolean;
  requiredPermissions: readonly string[];
}
```

Estas interfaces são envelopes de integração, não substituem `Job`, `JobEvent` e outros contratos já existentes em Operating Core. Criar schemas de validação e adapters explícitos para os contratos das origens. Nenhum `organizationId` recebido do browser vira autoridade: deriva da sessão validada; comparar sempre com a entidade armazenada.

Assinaturas comuns propostas para os adapters, detalhadas na tarefa dona:

- `assertActorContext(context: ActorContext): ActorContext` — valida formato; não concede permissões.
- `authorizeCapability(context: ActorContext, proposal: ActionProposal): Promise<{ allowed: boolean; reason: string }>` — nega tenant/capability/approval incompatíveis.
- `executeAction(context: ActorContext, proposal: ActionProposal): Promise<ActionReceipt>` — opera somente após autorização e idempotência; não é executor arbitrário de shell.

Propriedade: tarefa 02 define e congela envelopes; tarefa 05 implementa a autorização; tarefa 07 implementa o dispatcher sobre o engine escolhido. Mudanças posteriores no contrato exigem ADR, testes de consumidores e aprovação do escopo, nunca renomeação unilateral.

## 6. Gates e foco de revisão

Comandos canônicos existentes, executados no root do destino:

```bash
pnpm --dir apps/crm typecheck
pnpm --dir apps/crm lint
pnpm --dir apps/crm test:unit
pnpm --dir apps/crm test:db
pnpm --dir apps/crm test:e2e
pnpm --dir apps/social-web test:foundation
pnpm --dir apps/social-web build
pnpm --dir apps/website typecheck
pnpm --dir apps/website test
```

Rodar apenas os correspondentes à tarefa. Build CRM e E2E requerem pré-requisitos documentados; não chamar zero testes, skipped ou ausência de servidor de PASS. A tarefa 01 cria `tooling/scripts/unification/gate.mjs` e o catálogo `tooling/unification/gates.json`, mapeando task/phase aos argv reais existentes, sem shell genérico. Para módulo novo, cadastrar os scripts reais no catálogo durante sua importação, com timeout e preservação do exit code. Depois da tarefa 03, o alias `pnpm unify:gate -- --task NN --phase final` pode ser usado. Antes dele, usar `node tooling/scripts/unification/gate.mjs --task NN --phase final`.

Foco transversal de revisão (testes concretos nas tarefas donas):

- Uma sessão da organização A nunca consulta memória, mídia, leads ou jobs da B: tarefas 05/06/09/11.
- Retry/webhook duplicado não duplica envio, publicação ou execução: tarefas 07/09/10/11.
- Aprovação fica inválida quando conteúdo, destinatário ou versão da política muda: tarefas 05/08/10.
- Provider desativado, credencial ausente ou WebMCP indisponível mantém erro claro e módulos restantes funcionais: tarefas 09/10/12/14.
- Migração parcial, processo reiniciado ou resultado vencido preserva estado e permite retomada/rollback sem declarar sucesso: tarefas 04/07/11/15.

`PASS`, `FAIL`, `SKIPPED`, `NOT_EXECUTED` e `BLOCKED` são distintos. Falhas herdadas são registradas no baseline, com alvo e evidência; isso não transforma uma regressão em aprovação. Falha sem diagnóstico em um gate requerido bloqueia a etapa. Não desligar asserções nem excluir suites para produzir verde.

## 7. As 15 tarefas

Cada tarefa segue RED → implementação mínima → GREEN → revisão do diff → evidência → PR. Não implementar a próxima. Testes indicados são critérios futuros; este plano não afirma que já foram executados.

### Task 01 — Inventário, fontes e protocolo Jules

**Depende:** nenhuma. **Entrega:** seleção auditável e mecanismo para limitar futuras sessões.

**Arquivos:** criar `docs/unification/inventory.md`, `docs/unification/source-selection.csv`, `docs/unification/jules-runbook.md`, `tooling/unification/sources.json`, `tooling/unification/tasks/01.json` até `15.json`, `tooling/unification/gates.json`, `tooling/scripts/unification/prepare-sources.mjs`, `gate.mjs`, `check-scope.mjs` e testes próprios adjacentes. Somente docs/tooling novos; sem alterar lógica do produto.

**Interfaces:** manifesto `{ repository, commit, sourcePaths, destinationPaths, disposition, license, checksum? }`; task manifest `{ id, dependsOn, allowedPaths, requiredGates }`. Registrar base/source SHA e árvore de arquivos para todas as origens.

- [ ] Ler código, histórico, manifests, contracts, regras e licenses; confirmar acesso read-only de todas as fontes necessárias na VM Jules.
- [ ] Criar testes RED: SHA divergente é rejeitado; arquivo fora de scope produz exit não zero; runner transmite falha/timeout/zero-tests; checksum de arquivo importado é validado.
- [ ] Implementar helpers limitados aos repos listados, sem credenciais embutidas, sem clone no destino e sem executar conteúdo externo arbitrário.
- [ ] Gerar comparação por conteúdo e contratos, classificando cada capability e duplicação. Examinar links/symlinks e ignorar caches explicitamente.
- [ ] Executar baseline dos alvos requeridos; documentar falhas do código e impedimentos do ambiente separadamente, sem consertos fora de escopo.
- [ ] Propor selection matrix e scopes das 15 etapas; Owner revê antes de Task 02. PR somente com os arquivos autorizados.

**Aceitação:** dez fontes identificadas, nenhum source inacessível requerido tratado como migrado, tarefa/arquivo com dono, catálogo de gates e matriz de seleção revisáveis.

### Task 02 — Desenho canônico, envelopes e registro de módulos

**Depende:** 01 integrada e matriz aceite. **Entrega:** fronteiras estáveis para a migração.

**Arquivos:** criar `packages/platform/unification/src/contracts.ts`, `schemas.ts`, `module-registry.ts`, testes adjacentes; criar `docs/unification/architecture.md`, `ownership.md`, `data-authorities.md`, `capability-matrix.md`; package manifest local quando registrado pela 03. Sem mudar runtime CRM nesta tarefa.

**Consome:** inventário e contratos Operating Core. **Produz:** os contratos da seção 5, schemas de fronteira e registry sem execução externa.

- [ ] RED: context vazio/organization inválida, envelope cross-tenant e módulo sem permission são inválidos; alteração de payload muda o hash de aprovação.
- [ ] Implementar schemas e mapeamento de versões; registry tem IDs únicos e módulos opcionais explicitamente desativados.
- [ ] Documentar um dono por memória/job/router/provider/audit/identity; resolver Nexus versus Operating Core sem criar dois schedulers.
- [ ] Registrar decisões: CRM é centro; dados técnicos separados dos dados tenant; domínios não fazem import circular.
- [ ] GREEN: executar testes de contratos, validar registry e verificar que consumers existentes não quebram.

**Aceitação:** seleção e arquitetura documentadas, nenhum blueprint anunciado como runtime pronto, interfaces e ownership fechados antes de imports.

### Task 03 — Workspace e ambiente reproduzível para Jules

**Depende:** 02. **Entrega:** uma instalação suportada e comandos por domínio.

**Arquivos:** modificar root `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, manifests dos novos pacotes registrados, `tooling/unification/gates.json`, `.env.example` somente nomes/documentação quando necessário; criar `docs/unification/setup.md`. Não alterar dependências globalmente sem compatibilidade demonstrada.

**Consome:** seleção e módulos. **Produz:** resolução de workspace e alias `unify:gate`, catálogo de serviços/portas/readiness e env requirements sem valores secretos.

- [ ] RED: teste de registro detecta nome workspace duplicado, pacote não incluído, comando ausente e porta compartilhada indevida.
- [ ] Fixar Node 22 e pnpm canônico; resolver diferenças de Node/pnpm das fontes por runtime compatível, não por atualização geral de toolchain.
- [ ] Instalar frozen após atualização intencional de lock; aprovar scripts nativos específicos, mantendo TLS/checksums. Registrar FFmpeg, toolchain nativa e DB isolado quando requeridos.
- [ ] Garantir que setup não escreva AGENTS/manifests involuntariamente; preservar instruções das fontes como evidência, com autoridade final Lumenva explícita.
- [ ] GREEN: instalação limpa e repetida, resolução de imports, typecheck dos módulos registrados e smoke de seus prerequisitos.

**Aceitação:** instalação documentada em checkout limpo; pré-requisitos faltantes produzem BLOCKED; nenhuma credencial ou filesystem desta conversa presumido na VM Jules.

### Task 04 — Reconciliar CRM Legacy e proteger o CRM atual

**Depende:** 03. **Entrega:** deltas Legacy úteis integrados sem regressão.

**Arquivos:** subconjunto aprovado de `apps/crm/`; testes em `apps/crm/tests/unit/` e `tests/invariants/`; esquema somente em `infra/supabase/` ou no caminho da autoridade de dados confirmada, com baseline/MANIFEST/tipos segundo contrato; `docs/unification/legacy-deltas.md`.

**Consome:** matriz de diferenças. **Produz:** CRM canônico preservado, deltas selecionados e replay de migração local.

- [ ] Escolher diferenças concretas, não substituir diretórios inteiros; provar comportamento antigo e esperado com RED por delta.
- [ ] Portar apenas melhorias selecionadas, incluindo testes válidos que faltam ao destino.
- [ ] Exercitar contactos/leads/funil/inbox, atribuição humano/agente, auth/RBAC, WhatsApp e automações com providers fake.
- [ ] Rehearsal sintético de upgrade: IDs/FKs/eventos preservados; migration parcial não anuncia sucesso; repetir aplicação quando idempotência é contratual.
- [ ] GREEN: comandos canônicos CRM relevantes e DB local para toda mudança de esquema/tenancy.

**Aceitação:** nenhuma funcionalidade CRM removida; diferenças rejeitadas possuem motivo; nenhuma migration de produção executada.

### Task 05 — Identidade, isolamento e governança compartilhados

**Depende:** 04. **Entrega:** todos os domínios usam uma identidade de negócio verificável.

**Arquivos:** `packages/platform/unification/src/identity-adapter.ts`, `authorization.ts`, `approval-snapshot.ts` e testes; adapter mínimo na auth existente `apps/crm/lib/auth/`; tests cross-tenant; esquema de grants/approval apenas se necessário e aditivo.

**Consome:** ActorContext/ActionProposal e auth corrente. **Produz:** `authorizeCapability`, referências de aprovação vinculadas a snapshot e bridge de identidade com escopo explícito.

- [ ] RED: A não usa token, contato ou job de B; cliente não escolhe tenant; payload/targets/policy alterados invalidam aprovação.
- [ ] Usar auth server-side atual, mapear IDs existentes sem email como autoridade nem novo login paralelo.
- [ ] Separar permissions de negócio e engenharia; nenhuma role CRM ganha shell ou acesso global à memória por import de Nexus.
- [ ] GREEN: isolamento/RBAC e validade de aprovação, inclusive revogação após início de sessão; audit sem segredo/PII.

**Aceitação:** identidade uniforme com compatibilidade de sessões existentes, negação por default e separação de controles administrativos.

### Task 06 — Incorporar memória, contexto e indexação do Nexus

**Depende:** 05. **Entrega:** capacidades de brain úteis com ownership e ACL.

**Arquivos:** importar seleção de `nexus-brain/packages/brain`, `context-gateway`, `github-indexer`, `code-intelligence`, `state`, contracts estritamente necessários para `packages/core/nexus/`; adapter `packages/platform/unification/src/nexus-context-adapter.ts`; facade de memória/contexto em `packages/core/operating-core/src/memory/` e `context/` somente paths escolhidos; manifests/workspace/lock; testes e proveniência.

**Consome:** auth e ownership. **Produz:** serviço de memória/contexto através dos contratos canônicos importados, adapter com `ActorContext` e escopo de dados.

- [ ] RED: fonte recuperada fora do projeto/tenant é negada; resultado stale/sem proveniência é sinalizado; indexador não executa código indexado.
- [ ] Selecionar autoridade por capacidade; não importar `packages/compat` como segundo engine. Fachada Lumenva chama o dono e preserva exports usados.
- [ ] Isolar memória técnica/projetos de memória de clientes; opt-in explícito para contexto global.
- [ ] Configurar indexação GitHub read-only, reconciliação e tombstones com fixtures; não pressupor acesso a todos os repos do usuário.
- [ ] GREEN: suites reais dos pacotes importados, testes de ACL, proveniência, escrita/replay local e imports dos consumidores.

**Aceitação:** um dono por store/context compiler, consumidores existentes preservados e nenhuma fuga de informações entre escopos.

### Task 07 — Consolidar jobs, eventos e execução de agentes

**Depende:** 06. **Entrega:** ciclo de execução durável sem schedulers duplicados.

**Arquivos:** seleção Nexus `execution`, `control-plane`, `routing`, `governance`, `providers`, `evidence` para `packages/core/nexus/`; adapters em `packages/core/operating-core/`; `packages/platform/unification/src/action-dispatcher.ts`; testes e migrations locais aditivas pertinentes. Manifests/workspace/lock desta importação pertencem exclusivamente à sessão desta tarefa; não alterar dependências alheias ao port.

**Consome:** Job/JobEvent atuais, autorização e brain. **Produz:** `executeAction` e adapters de job/event, mantendo APIs existentes até consumidores migrados.

- [ ] RED: webhook repetido produz um receipt; worker morto libera/reclama lease conforme contrato; tenant errado não reclama job; retorno após timeout não marca job vencido como concluído.
- [ ] Eleger um engine por domínio e um dispatcher de fronteira; não disparar ambos durante transição.
- [ ] Persistir estados, attempts, evidenceRefs, cost/approval policy e replay; outcome verificado separado de comando executado.
- [ ] GREEN: contract tests entre CRM/brain/workers, reinício e replay locais, negação de ações não aprovadas, audit redigido.

**Aceitação:** nenhum efeito duplicado e nenhuma execução de LLM/provider real necessária aos testes.

### Task 08 — Consolidar Social Brain já presente

**Depende:** 07. **Entrega:** capacidades sociais existentes sem duplicação de apps/packages.

**Arquivos:** deltas selecionados em `apps/social-web`, `apps/social-mcp`, `apps/social-worker`, `packages/core/social-brain/`; manifests/lock somente com justificativa; testes e `docs/unification/social-brain-deltas.md`.

**Consome:** identidade/approvals/jobs. **Produz:** fluxo conteúdo → revisão de snapshot → job de publicação, analytics e MCP sociais integrados aos contratos novos.

- [ ] RED: editar conteúdo após aprovação impede publicação; analytics sem amostra fica indisponível e nunca aprova conteúdo automaticamente.
- [ ] Comparar cada diferença com origem antes de importar; preservar adapters BrightBean/MoneyPrinter e release evidence separada do runtime ativo.
- [ ] Ligar tenant/actor e receipts ao core, preservar ranges analíticos existentes e APIs de domínio.
- [ ] GREEN: `pnpm --dir apps/social-web test:foundation`, build e testes de webhook/job/mock provider; provedor não configurado retorna estado claro.

**Aceitação:** uma implementação por capacidade social, sem segundo Social Brain ou OAuth paralelo.

### Task 09 — Inbox social, contactos e automações do lumenva-social

**Depende:** 08. **Entrega:** inbox/CRM social multiempresa no Lumenva.

**Arquivos:** adaptar fontes `lumenva-social/lib/inbox`, `lib/automation`, `lib/db`, `app/api/inbox`, `contacts`, `leads`; destinos em `packages/core/social-brain/core/src/inbox/`, `automations/`, `crm-adapter/`, rotas em `apps/social-web/app/api/`; bridge CRM mínimo com scope explícito; schemas/migrations aditivos; manifests/lock quando necessário.

**Consome:** contactos canônicos, tenant, adapters e jobs. **Produz:** normalização social e dedupe, conversa ligada ao contacto CRM, automações por tenant.

- [ ] RED: mesma identidade externa em duas contas não conflita; evento duplicado não cria mensagem/lead duplicado; takeover humano bloqueia auto-resposta.
- [ ] Não copiar SQLite pessoal como banco multiempresa; mapear dados por origem/account ID e tenant. Importador local sintético com dry-run e reconciliation report.
- [ ] Inbound Meta valida assinatura/challenge, normaliza e enfileira sem duplicar lógica de envio.
- [ ] GREEN: scopes tenant/canal/account, takeover, retry e kill switch; contactos CRM ficam preservados e provider ausente não quebra inbox.

**Aceitação:** um cadastro canônico de contacto por regra de identidade, sem merge automático por nome/email não verificado.

### Task 10 — Conteúdo, referências, imagens e publicação unificados

**Depende:** 09. **Entrega:** criar conteúdo e publicar pelos adapters aprovados.

**Arquivos:** seleção `lumenva-social/lib/daily-content`, `lib/reference`, `lib/ai`, `lib/publish.ts`; destinos em `packages/core/social-brain/core/src/content/`, `references/`, `publishing/`; UI/rotas em `apps/social-web` e jobs `apps/social-worker`; testes do fluxo.

**Consome:** marca/tenant, snapshots, jobs e providers existentes. **Produz:** um comando de publicação idempotente por destino e pipeline de referência com proveniência.

- [ ] RED: carrossel inválido é rejeitado; retry só reexecuta destinos falhados; agendamento duplicado não publica duas vezes; edição invalida aprovação.
- [ ] Unificar `publishToTargets` com o adapter dominante selecionado, preservando erros claros e contratos de provider.
- [ ] Conteúdo/referências geram rascunhos; não publicam por terem sido gerados. Scraping autenticado e image generation permanecem opcionais com consentimento/credenciais.
- [ ] Manter geração Codex/CLI no boundary técnico autorizado, não expor sessão pessoal nem filesystem no servidor multiempresa.
- [ ] GREEN: fixture fonte→rascunho→aprovação→queue→receipt e fallback credencial ausente; nenhum post real.

**Aceitação:** uma lógica de envio, proveniência por asset, aprovação explícita e provider modes documentados.

### Task 11 — Produção de mídia e avatar do social-media

**Depende:** 10. **Entrega:** pipeline audiovisual próprio integrado ao domínio social.

**Arquivos:** seleção `social-media/packages/core`, `apps/api`, `apps/worker` para `packages/core/media-production`, `apps/media-api`, `apps/media-worker`; adapters com `apps/video-composer`; UI de domínio em `apps/social-web`; manifests/workspace/lock; testes FFmpeg e importador SQLite→modelo de domínio quando requerido.

**Consome:** tenant/asset/approval/jobs; reutiliza exporters/publishing da 10. **Produz:** roteiro/storyboard/handoff, ingest, QC, retake, export e associação ao conteúdo social.

- [ ] RED: upload e arquivo fora do root permitido são negados; export cross-tenant é negado; job retomado não duplica asset nem publicação.
- [ ] Portar módulos úteis, não a dependência do control plane pessoal inteiro; não trazer modelo/runtime lock como acesso irrestrito ao agente.
- [ ] Preservar identidade de avatar/referências; Flow permanece manual. Testar FFmpeg/ffprobe com vídeo sintético e comparar metadados de saída esperados.
- [ ] Não instalar containers; workers têm limite de CPU/memória/timeout e limpeza somente de arquivos temporários próprios.
- [ ] Rehearsal sintético de importação: IDs, referências, hashes, ownership e estado de jobs conferidos; sqlite original nunca é apagado.
- [ ] GREEN: pipeline handoff→ingest→QC→export→draft, restart, storage autorizado e ausência de provider pago.

**Aceitação:** fluxo mídia e social conectado; nenhum upload/custo/publicação externa real requerido para prova local.

### Task 12 — ToolMesh e BrowserMesh como módulos de ferramentas

**Depende:** 11. **Entrega:** ferramentas registradas e WebMCP com controle de acesso.

**Arquivos:** seleção ToolMesh `packages/project-control` para `packages/platform/engineering-runtime/project-control/`; registry em `packages/integrations/tool-registry`; seleção BrowserMesh em `packages/platform/browsermesh` e `apps/browser-lab`; manifests/workspace/lock e testes. UI CRM só na 14.

**Consome:** authorizeCapability/executeAction. **Produz:** descritores de ferramentas validados e adapter de tools WebMCP→ações governadas.

- [ ] RED: input schema inválido, capability desconhecida, origem não permitida e tenant incorreto são negados; browser sem `document.modelContext` funciona com estado de indisponibilidade.
- [ ] Portar apenas capabilities existentes selecionadas; ToolMesh API/OpenConnector planejados não entram como implementação fictícia.
- [ ] Ferramentas humanas/agente chamam o mesmo serviço autorizado; bridge local tem allowlist, auth e limites, sem executor arbitrário exposto ao browser.
- [ ] Garantir audit sem valores secretos; serializar propostas e preservar actor humano/agent.
- [ ] GREEN: contract tests com WebMCP simulado, lifecycle/unregister, fallback e requests não autorizados; documentação distingue browser real com API experimental ainda não testado.

**Aceitação:** ferramentas isoladas e rastreáveis; demo store não vira banco CRM; experimental continua opcional.

### Task 13 — Governança documental e runtimes Agent-Os-/UniversalAgentOS

**Depende:** 12. **Entrega:** uma doutrina Lumenva e adapters de trabalho coerentes.

**Arquivos:** `docs/unification/agent-runtime-policy.md`, `docs/architecture/` somente desenho reconciliado; `packages/platform/engineering-runtime/` adapters; `AGENTS.md`, `CLAUDE.md`, `.claude/rules/` somente deltas aprovados com scope nominal; instructions Jules e testes de consistência. Não instalar configurações globais no PC do usuário.

**Consome:** políticas atuais, blueprints documentais e governança da 05/07. **Produz:** regras compartilhadas por Codex/Claude/Jules, matriz de capabilities/policies/model constraints e índice canônico.

- [ ] RED: policies contraditórias, auto-merge implícito, acesso de negócio a shell e side effect sem gate são detectados.
- [ ] Reconciliar ideias úteis dos dois blueprints; distinguir implementado, adaptado, rejeitado e backlog. Não tentar implementar finance/academy/business blueprint generator como migração de código inexistente.
- [ ] Manter controle de risco/custo/approval e policy de memória consistente; runtime/model locks por origem permanecem visíveis até decisão explícita.
- [ ] GREEN: testes de instruções/harness e comportamento dos adapters com fakes; nenhuma chamada a outro agente ou alteração de perfil global.

**Aceitação:** agente novo entende um conjunto canônico de regras e evidências, sem instruções antigas ordenando missão paralela ou execução automática.

### Task 14 — Experiência Lumenva única e controlo operacional

**Depende:** 13. **Entrega:** navegação, sessão e estados coerentes para o utilizador.

**Arquivos:** shell/nav/permissões de `apps/crm` e `apps/social-web`; `apps/control-center`/`apps/edge` selecionados do Nexus com services já importados; adapters de sessão e módulo registry; testes E2E de integração; manifests/workspace/lock dos apps importados. Definir arquivos exatos do shell existentes na tarefa 01 para a allowlist desta tarefa.

**Consome:** todos os módulos e identidade. **Produz:** entrada Lumenva, transições autenticadas, visibility por permission e painel de saúde operacional.

- [ ] RED: link sem permissão não aparece e endpoint segue negado; logout/revogação propagam; módulo desligado oferece estado claro sem quebrar o CRM.
- [ ] Integrar domínios numa navegação e identidade; preservar apps separadas quando runtime exige, com URLs/rotas documentadas e verificação server-side.
- [ ] Painel técnico só para roles técnicas; separar custos/tarefas de engenharia das conversas/dados de clientes.
- [ ] GREEN: browser sintético login→CRM→social→mídia→ação governada→receipt→logout; acessibilidade e erro/empty/loading; websocket/SSE sem dados cross-tenant.

**Aceitação:** experiência Lumenva coerente, URLs antigas com redirects seguros quando necessário e nenhuma rota ou endpoint contornando RBAC.

### Task 15 — Validação integrada, recuperação e encerramento

**Depende:** 14. **Entrega:** candidato de release revisável e consolidação verificável.

**Arquivos:** `tooling/unification/` gates/manifest finais; ajustes de integração estritamente inventariados, scripts root/lock final quando necessário; `docs/unification/release-readiness.md`, `rollback.md`, `source-closure.md`, `runbook.md`; fixtures/E2E integrados. Mudanças de domínio novas voltam à tarefa dona, não entram escondidas nesta etapa.

**Consome:** capabilities e contratos aceites de 01–14. **Produz:** relatório final por capability/serviço, plano de corte e proposta de arquivamento.

- [ ] Verificar instalação frozen em checkout limpo, builds/types relevantes, suites locais e smoke funcional de todos os módulos selecionados, com contagens e SHA atual.
- [ ] RED→GREEN para cenários de integração: restart, mensagem duplicada, revoke/tenant crossing, stale approval, storage indisponível, migration parcial e rollback. Não repetir suites que já provaram tudo sem mudanças.
- [ ] Provar restore com backup sintético, checksums, row counts/IDs, receipts e rollback de routing/module flags; nenhuma restauração em produção.
- [ ] Confirmar um dono e uma implementação ativa por capability; mapear todo código DEFER/DOCUMENT_ONLY/REJECT sem anunciar transferência concluída.
- [ ] Classificar `CODE_READY`, `LOCAL_WORKFLOW_VERIFIED`, `EXTERNAL_VALIDATION_PENDING` e `PRODUCTION_RELEASED` separadamente. External OAuth/provider/production exige ambiente e autorização específicos; unrun não é pass.
- [ ] Produzir inventário e proposta para arquivar origens; preservar históricos, tags, licença e conteúdo não portado. Não apagar nem arquivar repositórios nesta PR.
- [ ] Owner revê release, prerequisites externos e rollback; depois executa ou autoriza deploy/cutover. Somente após aceite final faz arquivamento no GitHub.

**Aceitação:** somente Lumenva é mantido como repositório canônico das capacidades escolhidas; consumidores críticos preservados; operação, dados e rollback demonstrados; pendências externas explicitamente visíveis. Não chamar unificação completa se uma capability prometida ainda depende do código de um repositório antigo sem integração registrada.

## 8. Como usar no Jules sem criar conflitos

### Preparação humana

1. Rever este plano e a arquitetura proposta. O plano atual é local; colocá-lo no repositório Lumenva antes de pedir ao Jules para o ler.
2. Confirmar Lumenva ligado ao Jules. O CLI documentado permite listar repos com `jules remote list --repo`; `jules login` é realizado pelo usuário, sem colocar credenciais em chat.
3. Confirmar acesso autorizado às origens ou fornecer snapshots verificáveis. Não exigir que Jules encontre arquivos desta sessão cloud.
4. Abrir somente a Task 01. A integração seguinte ocorre após review/merge humano e registro do SHA.
5. Depois de cada merge, criar uma sessão nova para a task seguinte a partir da main que contém a task anterior. Não reutilizar uma sessão baseada na main antiga para novas etapas.

### Prompt obrigatório de cada sessão

Copiar este bloco, substituir NN, título e SHA de base e anexar/indicar o plano no repo. Para 01, dependência é nenhuma; para N>01, informar PR/SHA integrado de N−1.

```text
Repositório de destino: trydavidqix/Lumenva.
Plano: docs/superpowers/plans/2026-10-08-lumenva-unificacao-jules.md.
Executa somente Task NN — TÍTULO, incluindo suas restrições globais e critérios.
Base exigida: SHA_DA_MAIN_ATUAL_COM_DEPENDÊNCIAS_INTEGRADAS.
Dependência anterior: PR/SHA integrado (ou nenhuma para Task 01).
Antes de editar: lê AGENTS.md, CLAUDE.md e regras aplicáveis; verifica base,
fontes congeladas, scope e gates. Não assuma acesso a outro repo nem a esta VM.
Se base, licença, fonte, credencial de teste local ou decisão essencial faltar,
reporta BLOCKED com prova e não inventes alternativa que altere o contrato.
Não inicia outra task; não cria subagentes; não faz merge, deploy, postagem,
execução paga, migration de produção ou modificação de repositório de origem.
Segue os arquivos/interfaces desta task. Mudança fora de scope exige revisão.
Escreve teste RED para comportamento novo/portado, implementa e executa gates.
Preserva testes, credenciais, dados e alterações preexistentes.
Entrega uma PR com task ID, base/source/final SHA, arquivos, deltas,
interfaces, comandos e contagens, blockers, riscos e rollback.
```

Exemplo confirmado de sintaxe CLI; não executado neste planejamento:

```bash
jules new --repo trydavidqix/Lumenva "Executa somente a Task 01 do plano docs/superpowers/plans/2026-10-08-lumenva-unificacao-jules.md. Lê o plano completo e as regras do repositório antes de agir. Entrega PR, evidência e blockers; não faz merge nem inicia Task 02."
jules remote list --session
```

Para consultar outras opções, usar `jules help` e ajuda do subcomando instalado. Se usar `jules remote pull --session ID`, fazê-lo numa árvore limpa dedicada ao review; não aplicar resultado sobre trabalho existente sem inspecionar o diff. Não existe, nesta pesquisa, garantia de flags `--branch`/`--base`; usar os controles suportados da instalação/interface atual e verificar a base no código.

### Checklist de review antes do próximo envio

- Base e fontes correspondem aos SHAs declarados.
- Diff só tem arquivos permitidos; nenhum segredo ou cache.
- Interfaces/consumers/schema estão compatíveis e os gates realmente executaram.
- Falhas herdadas, skipped e bloqueios externos estão separados de regressões.
- Nenhum efeito externo/merge/custo autorizado por engano.
- PR integrada por decisão humana; anotar o SHA e somente então iniciar N+1.

### Quando Jules não consegue concluir uma etapa

Manter o mesmo número de task. Pedir diagnóstico/redução do slice, preservar branch e evidência, corrigir o prerequisite ou solicitar decisão de escopo. Uma etapa grande pode ter sessões A/B de continuação, executadas sequencialmente e com base/interface atualizada; continua sendo uma das 15 etapas, não uma licença para vários workers mexerem no mesmo módulo.

## 9. Definição final de “ficar apenas Lumenva”

- Um repositório canônico e um lugar de regras/documentação/proveniência.
- CRM existente preservado e capacidades sociais/mídia/ferramentas selecionadas integradas.
- Um dono por função transversal e contratos comuns, com dados de negócio e engenharia isolados.
- Desenvolvimento e operação reproduzíveis sem depender de checkout antigo para capacidades declaradas migradas.
- Repositórios antigos preservados como histórico, depois arquiváveis por decisão humana.
- Dependências externas legítimas continuam externas: Google Flow, provedores de rede social, banco/storage e modelos não viram código próprio por terem sido conectados.

O plano estrutura a unificação completa das capacidades aprovadas. Não transforma automaticamente todos os blueprints das origens em produto acabado e não promete ausência absoluta de conflitos. Execução sequencial, ownership explícito, base atualizada, contratos estáveis e gates reduzem e tornam detectáveis os conflitos.
