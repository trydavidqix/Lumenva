# Plano único de implementação — Lumenva CRM, Social e Dropshipping

> **Para Jules:** ler este documento inteiro antes da tarefa atribuída. Cada sessão executa uma tarefa distinta no repositório `trydavidqix/Lumenva`, em VM/branch/PR remota própria. Criar as sessões individualmente, uma chamada por tarefa, sem `--parallel`; manter até 15 sessões ativas quando dependências e ownership permitirem. Não iniciar tarefa com dependência pendente ou paths compartilhados. Jules não faz merge, deploy, postagem nem modifica repositórios de origem. Este plano precisa de revisão do Owner antes da execução.

**Objetivo:** consolidar no Lumenva o CRM central, a gestão e produção de conteúdo social, a publicação e inbox social com contatos/leads básicos e a gestão de dropshipping, reaproveitando seletivamente `Lumenva-Legacy`, `lumenva-social`, `lumenva-social-brain` e `Drop` sem duplicar capacidades existentes nem misturar dados de clientes, loja e engenharia.

**Arquitetura:** o CRM continua sendo a entrada e o centro da experiência. Social e dropshipping são módulos de domínio do produto, conectados por contratos e adapters explícitos. Podem manter apps, workers e bancos especializados dentro do mesmo repositório quando a arquitetura existente exigir; unificação do produto não implica um processo único, banco único, migração geral ou cópia dos dados de origem.

**Stack:** preservar Node, pnpm, Next.js, React, TypeScript, autenticação, banco, storage, CI e convenções efetivamente ativos no Lumenva. A Task 01 confirma versões e comandos na base de execução. Não atualizar a stack só para igualar uma origem.

**Spec:** este documento define o escopo e os critérios de implementação para as cinco fontes listadas. A arquitetura é proposta e requer aprovação do Owner; auditoria de repositórios não equivale a aprovação técnica, autorização de produção nem validação externa de provedores.

## Restrições globais

- Lumenva é o único destino e repositório canônico das capacidades aprovadas.
- Escopo de origem: `Lumenva` (destino), `Lumenva-Legacy`, `lumenva-social`, `lumenva-social-brain` e `Drop`. Não incorporar Nexus, ToolMesh, BrowserMesh, `social-media` ou outros projetos sem nova ordem e revisão do escopo.
- A Task 01 verifica novamente os SHAs abaixo, acesso às origens, licenças, mudanças recentes e situação de branches/PRs antes de qualquer port. Os SHAs são o snapshot da auditoria de 09/10/2026, não autorização para usar versões diferentes.
- Um port precisa de comportamento/capacidade demonstrável. Classificar cada item `KEEP_DESTINATION`, `PORT_DELTA`, `ADAPT`, `DOCUMENT_ONLY`, `DEFER` ou `REJECT`, com origem, destino, licença, dono, justificativa, testes e dependências.
- Uma sessão, uma tarefa, uma branch e uma PR. Criar sessões separadas uma por vez; tarefas independentes podem rodar ao mesmo tempo até a cota Pro de 15. Não abrir sessões redundantes só para preencher a cota.
- Cada tarefa declara `base_sha`, `source_sha`, allowlist de paths, contratos existentes e resultado esperado. Se a base mudar, revalidar a PR no GitHub; nunca resolver conflito escolhendo automaticamente `ours` ou `theirs`.
- Arquivos compartilhados (manifests, lockfile, workspace, contratos transversais, configuração, esquema e CI) têm um único escritor por tarefa. Alteração fora da allowlist exige ajuste aprovado antes de editar; a tarefa não amplia o próprio escopo para justificar mudanças feitas.
- Preservar login, sessões, IDs, tenant, RBAC, RLS, auditoria e fluxos CRM. O tenant é derivado da sessão autenticada no servidor; nunca confiar no `organizationId` recebido do browser.
- Não migrar dados existentes entre bancos nem trocar provider de auth, storage ou banco implicitamente. Toda migração de esquema é aditiva, com baseline, tipos, replay em CI e rollback documentados.
- Segredos ficam fora de Git, plano, prompt Jules e evidência. Não ler `.env`/variantes protegidas. Não usar dados reais de clientes, loja ou rede social em teste; usar fixtures sintéticas, banco isolado no GitHub Actions e provedores fake.
- Durante desenvolvimento: sem deploy, chamada paga, OAuth real, publicação/postagem, compra, alteração de catálogo, pedido, anúncio, mensagem externa ou escrita em loja. Testes não podem representar mock como prova de integração real.
- Operações de dropshipping começam em modo somente leitura/simulado. Checkout, pedido ao fornecedor, mudança de preço, publicação de produto, refund e qualquer escrita externa exigem capability explícita, autorização humana no momento da ação, idempotência e ambiente/credenciais autorizados em uma etapa posterior. `unknown` ou `submitted` não autoriza repetir ou trocar executor: reconciliar primeiro.
- Reutilizar AutoDS/DSers/n8n e APIs oficiais como integrações externas somente após confirmar acesso, escopos, licença, custo, compatibilidade e limites atuais. Não copiar código proprietário nem tratar README/catálogo MCP como servidor executável.
- Windows não executa testes, Docker, builds, instalações de dependências, worktrees ou checkouts auxiliares para este plano. Não criar arquivos temporários locais. Testes e validações de código rodam nos GitHub Actions das PRs; Jules não executa suítes localmente na VM. Gate `PASS`, `FAIL`, `SKIPPED`, `NOT_EXECUTED` e `BLOCKED` são estados diferentes.
- Nenhum repositório de origem será apagado ou arquivado durante este plano. O fechamento pode propor arquivamento humano, preservando histórico, tags, licenças e material não migrado.

## Fontes e evidência inicial

| Repositório | SHA observado em `main` | Evidência e disposition inicial |
|---|---|---|
| `trydavidqix/Lumenva` | `3fbe74a3ff7b7a99538d1e53aa55688294b7ba99` | Destino. Já contém CRM, Content OS, distribuição/publicações sociais, `apps/social-web`, `apps/social-worker`, `apps/social-mcp` e `packages/core/social-brain`. Preservar e reconciliar antes de importar. |
| `trydavidqix/Lumenva-Legacy` | `6e9dbbd901445cfbec53955981a7dab6d644b9da` | Comparação de `apps/crm`: 2.814 arquivos com hash idêntico, 397 diferentes, 182 só no destino e zero só no Legacy. Diferença não prova melhoria; portar somente deltas com comportamento e teste. |
| `trydavidqix/lumenva-social` | `54c3b32c934462277320874fc3630882d2855f39` | README descreve publicação/agendamento, carrossel, inbox, automações, referência/conteúdo e contatos/leads básicos. É app pessoal com SQLite local, não multiempresa; adaptar capacidades, não transplantar seu banco como produto. |
| `trydavidqix/lumenva-social-brain` | `80a877bde72bd6a27a5d20ff2f6231a7e0f72995` | Social Brain com conteúdo, aprovação, publicação, analytics e integrações. Comparação atual: `apps/web`→`apps/social-web` tem 92 arquivos iguais, 4 diferentes, 1 só na origem e 5 só no destino; worker tem 15 iguais e 1 diferente; core tem 58 iguais, 4 diferentes e 37 só no destino. Reconciliar, não duplicar. README registra pendências de OAuth/provedor/publicação real; evidência de deploy não substitui prova funcional atual. |
| `trydavidqix/Drop` | `9259af5f4ec49cbc58f2d0f9b1e2776c8c07deec` | `main` tem documentação, auditorias upstream e três contratos em `src/contracts`; o plano de 04/10 diz que runtime, conectores, workflows e operação real não foram implementados/validados. Não há PR aberto na consulta. Tratar como especificação e contratos iniciais, não produto de dropshipping pronto. |

Inspeção foi somente leitura de árvores, README, contratos/documentação, hashes e PRs. Não foi auditoria integral de segurança nem teste de runtime. Task 01 atualiza a evidência antes de qualquer edição. Os contratos existentes de Drop distinguem estados como `not_started`, `submitted`, `confirmed`, `failed` e `unknown`; confirmar o contrato exato no SHA validado antes de reutilizá-lo.

## Produto e donos propostos

- **CRM:** `apps/crm` e os pacotes atuais continuam donos de organizações, contatos/leads canônicos, conversas, RBAC, auditoria, auth e permissões.
- **Social:** Social Brain já presente é dono do workflow de conteúdo/aprovação/publicação/analytics onde comprovado. `lumenva-social` é fonte de deltas de publicação, inbox, automações, referências e conteúdo; seus contatos devem ligar-se ao CRM por adapter e regras verificáveis de identidade.
- **Dropshipping:** criar capacidades ausentes dentro do workspace Lumenva, aproveitando os contratos e decisões existentes de Drop. Shopify (ou outra loja aprovada) mantém a autoridade dos dados de catálogo/pedido que já administra; Lumenva guarda vínculos, snapshots, decisões, custos/status e receipts necessários ao seu fluxo, sem presumir migração da loja.
- **Engenharia:** credenciais técnicas, shell, filesystem, indexação de código e ferramentas de engenharia não são acessíveis por papéis de negócio do CRM.
- **Identidade e integração:** adapters server-side traduzem sessão/tenant e contratos de domínio. OAuth/token pertence ao provider/account owner já escolhido; não criar login paralelo nem copiar tokens entre apps.

## Contratos de integração

Reutilizar a sessão/RBAC do CRM, os contratos de jobs/eventos do Operating Core, os contratos atuais do Social Brain e os contratos de pedido/mercado/evento do Drop. A Task 02 documenta donos e adapters necessários; não criar registry genérico, envelope paralelo ou segundo scheduler. Criar validações novas somente para uma lacuna comprovada e dentro do módulo dono. O tenant vem da sessão validada no servidor. Aprovação fica vinculada ao snapshot do conteúdo ou pedido; alteração relevante a invalida. Ação externa exige autorização, idempotência e modo explicitamente habilitado.

## Organização de destino

Preservar caminhos ativos. A estrutura abaixo é alvo conceitual; Task 01 mapeia a localização real e cada allowlist. Não criar pacote só para obedecer a um desenho:

Usar primeiro `apps/crm/`, `apps/social-web/`, `apps/social-worker/`, `apps/social-mcp/`, `packages/core/social-brain/` e os pacotes de integração existentes. `packages/core/dropshipping/` só será criado se a Task 01 provar que os padrões existentes não comportam o domínio. Não criar app, worker, registry ou pacote por antecipação. Cada tarefa recebe paths exclusivos; manifests, lockfiles, migrations compartilhadas e exports centrais têm um único owner definido antes das sessões paralelas.

## Gates e revisão

Task 01 registra os checks exigidos pela branch base. GitHub Actions é o único executor de testes e validações. Cada Jules entrega PR e aguarda os checks remotos; Windows não executa testes, Docker ou build. Não criar runner, catálogo de gates ou script de validação se os workflows atuais atenderem à tarefa.

Foco transversal e tarefa proprietária dos testes:

- Organização A não lê contatos, mensagens, assets, produtos, pedidos, custos ou jobs da organização B — Tasks 04, 06, 09, 11–14.
- Webhook/job repetido não duplica mensagem, publicação, item importado, pedido nem receipt — Tasks 07–10, 12–14.
- Alterar conteúdo, canal/destino, item/preço, fornecedor ou policy invalida aprovação existente — Tasks 08–10, 13–14.
- Token/provider indisponível, scope insuficiente ou API externa em erro produz falha explícita e não quebra CRM/módulos restantes — Tasks 07–09, 12–14.
- Estado `submitted`/`unknown`, timeout, reinício e resposta atrasada não provocam retry cego, troca de fornecedor ou falsa conclusão — Tasks 12–15.

## As 15 tarefas

Cada tarefa é uma PR isolada, com uma allowlist registrada antes de editar. Arquivos abaixo são limites propostos; Task 01 substitui curingas por paths exatos da base revisada. Arquivos não listados permanecem fora de escopo.

### Task 01 — Inventariar fontes e ownership

**Depende:** nenhuma. Pode rodar em paralelo com Tasks 02–03 porque possui arquivo próprio. **Entrega:** inventário e matriz de paths para sessões paralelas.

**Arquivos:** criar somente `docs/unification/inventory.md` e `docs/unification/task-ownership.md`. Não criar scripts, task manifests, gate runner, teste de tooling ou alterar produto.

- [ ] Conferir SHAs, acesso, branches/PRs, LICENSE/notices e paths das cinco fontes. Fonte privada sem acesso fica `BLOCKED_SOURCE_ACCESS`.
- [ ] Comparar árvores com hash; registrar arquivos iguais/diferentes/exclusivos. Hash igual não prova comportamento igual.
- [ ] Classificar cada capacidade por origem, disposition, motivo e owner; divergência do snapshot interrompe o port afetado até revalidação.
- [ ] Mapear arquivos compartilhados, migrations e exports para impedir duas sessões escritoras do mesmo path.
- [ ] Anotar os checks atuais de GitHub Actions. Não executar comandos, testes ou builds no Windows.

**Aceitação:** nenhuma fonte inacessível é tratada como migrada; cada path tem um owner; tarefas paralelas têm allowlists sem sobreposição.

### Task 02 — Contratos, ownership e arquitetura de domínio

**Depende:** nenhuma; usa os SHAs e contratos congelados neste plano. Pode rodar em paralelo com Tasks 01 e 03. **Entrega:** mapa de donos e fronteiras.

**Arquivos:** criar somente `docs/unification/architecture.md` e `docs/unification/data-owners.md`. Não criar package de plataforma, registry, schema genérico ou envelope duplicado.

- [ ] Mapear auth/RBAC e jobs/eventos já existentes no Lumenva, fronteiras do Social Brain e contratos Drop de pedido/mercado/evento.
- [ ] Nomear autoridade para contato, conversa, identidade social externa, conta social, conteúdo, asset, produto, loja, pedido, fornecedor, preço/custo, job e audit.
- [ ] Documentar autoridade de dados, tenant, approval snapshot, idempotência e estado `unknown`.
- [ ] Registrar paths centrais que não podem ser alterados em mais de uma PR concorrente.

**Aceitação:** tarefas conhecem contratos existentes e donos; nenhuma capability é presumida pronta sem código e evidência.

### Task 03 — GitHub Actions e execução Jules

**Depende:** nenhuma; pode rodar em paralelo com Tasks 01–02 porque possui arquivo próprio. **Entrega:** procedimento remoto de Jules e GitHub Actions.

**Arquivos:** criar somente `docs/unification/jules-runbook.md`; alterar workflow apenas se um check essencial estiver ausente e a mudança for aprovada.

- [ ] Registrar checks de CI e instruções para acompanhar PR remota; não criar catálogo ou script de gates.
- [ ] Não alterar manifests, lockfile, workspace, portas, toolchain ou `.env.example` nesta tarefa.
- [ ] Rever a ajuda da versão Jules conectada antes de qualquer automação. A referência oficial atual apresenta `jules remote new --repo ... --session ...`; o README publicado de `@google/jules` mostra `jules new --repo ... "prompt"`. Registrar a sintaxe suportada pela instalação, sem presumir que são aliases. Não usar `--parallel`.
- [ ] Confirmar acesso separado às cinco fontes privadas. Sem acesso, a tarefa de importação retorna `BLOCKED_SOURCE_ACCESS` e não inventa código.
- [ ] Registrar que testes/build rodam somente nos GitHub Actions e que Windows não executa comandos de validação.

**Aceitação:** runbook curto; até 15 sessões independentes criadas uma por chamada; checks remotos; nenhum setup local.

### Task 04 — Reconciliar CRM Legacy sem regressão

**Depende:** contrato/escopo deste plano; pode rodar com Tasks 05–14 quando Task 01 confirmar allowlist sem colisão.

**Arquivos:** subset aprovado e exato de `apps/crm/`, testes correspondentes e migration aditiva somente se necessária; `docs/unification/legacy-deltas.md`. Não alterar navegação global.

- [ ] Selecionar cada delta pelos hashes e contracts atuais; justificar manter, portar, adaptar ou rejeitar.
- [ ] Para cada comportamento escolhido, adicionar teste RED que falhe no Lumenva atual e passe com a mudança mínima.
- [ ] Não substituir diretórios inteiros nem reimportar os 2.814 arquivos já iguais.
- [ ] Cobrir contatos/leads/funil/inbox, RBAC e isolamento com fixtures e banco de teste isolado nos GitHub Actions.
- [ ] Se esquema mudar, validar migration parcial/replay/rollback nos checks remotos; não executar migration de produção.
- [ ] GitHub Actions valida os gates canônicos relevantes do CRM e testes DB para alterações de tenancy/schema.

**Aceitação:** nenhuma capacidade atual removida; os 397 paths diferentes foram triados ou explicitamente adiados/rejeitados; zero migration de produção.

### Task 05 — Reconciliar Social Brain já incorporado

**Depende:** contrato/escopo deste plano; pode rodar com Tasks 04 e 06–14 em paths separados.

**Arquivos:** paths selecionados de `apps/social-web/` e `docs/unification/social-brain-deltas.md`. Não alterar core, worker, MCP, manifests ou paths das Tasks 06–10.

- [ ] Comparar novamente árvore/hash com a fonte e inspecionar cada diferença (92 iguais/4 diferentes/1 só origem/5 só destino no web; 15 iguais/1 diferente no worker; core 58 iguais/4 diferentes/37 só destino no snapshot da auditoria).
- [ ] Fazer teste RED para qualquer delta de comportamento selecionado; manter APIs/consumidores atuais através de adapters quando necessário.
- [ ] Confirmar por código e gates quais partes estão prontas; marcar separadamente conexão/OAuth/provider/publicação/analytics externos não provados.
- [ ] Conferir contratos sociais, jobs, aprovação de snapshot, analytics e proveniência; não criar segundo app, worker, publisher nem pacote para uma capacidade já ativa.
- [ ] GitHub Actions valida os gates reais do social-web/worker/MCP e contract tests relevantes.

**Aceitação:** ownership documentado e nenhum port duplicado; funcionalidades não comprovadas ficam com status explícito.

### Task 06 — Modelo social multiempresa e adapter de contatos

**Depende:** contratos CRM/Social descritos na Task 02; paralelizável após confirmação de paths.

**Arquivos:** subpaths de identidade/bridge CRM em `packages/core/social-brain/`, testes correspondentes e `docs/unification/social-data-map.md`. Reusar as APIs de contato existentes; não editar `apps/crm`, UI, provider, publisher ou migrations compartilhadas.

- [ ] Examinar schema Drizzle/SQLite da origem; mapear conta/canal/ID externo para modelo canônico sem copiar DB pessoal para produto.
- [ ] RED: mesma pessoa externa em tenants ou contas/canais distintos não colide; não mesclar por nome/email sem regra verificada; evento replay é idempotente.
- [ ] Definir `SocialIdentity`/chave de dedupe e vínculo ao contato CRM com escopo da organização e da conta social.
- [ ] Criar importador sintético em dry-run somente se a migração de dados existentes for parte da necessidade demonstrada; reportar conflitos sem merge automático.
- [ ] GREEN: isolamento cross-tenant, duplicidade, reconciliação, tombstone e integridade referencial.

**Aceitação:** CRM segue dono de contato/lead; Social Brain armazena apenas identidade/vínculos sociais requeridos; nenhum dado de produção foi importado.

### Task 07 — Contas, credenciais e entrada de eventos sociais

**Depende:** contratos atuais de conta/evento; paths separados dos adapters de contato.

**Arquivos:** subpaths de provider/account e ingestão em `packages/core/social-brain/`, rotas próprias de webhook e fixtures. Não editar schema compartilhado, UI de inbox ou publisher.

- [ ] RED: webhook com assinatura/challenge inválido, tenant/account divergente, scope insuficiente e provider desativado são negados sem gravação.
- [ ] Reusar a conexão/OAuth dona já existente depois de mapear o código; não duplicar auth do Social Brain e `lumenva-social` nem copiar tokens entre stores.
- [ ] Validar assinatura, normalizar evento, deduplicar por ID/provider/account e enfileirar com receipt; não enviar resposta nesta tarefa.
- [ ] Adicionar kill switch por capability/provider e mensagens de erro acionáveis; não usar credencial real em teste.
- [ ] GREEN: fixtures assinadas/falsas, replay/retry, revoke e provider ausente.

**Aceitação:** evento válido chega uma vez ao domínio correto; token e payload sensível não aparecem em logs/evidências.

### Task 08 — Conteúdo, referências, mídia e publicação aprovados

**Depende:** contrato atual de publicação; paths separados do adapter de provider.

**Arquivos:** subpaths de conteúdo/referência/publicação em `packages/core/social-brain/`, rotas próprias em `apps/social-web/`, jobs existentes em `apps/social-worker/`, testes e `docs/unification/social-workflow.md`. Não alterar provider/account ou inbox.

- [ ] RED: editar conteúdo, asset, legenda ou destinos depois da aprovação invalida o snapshot; retry só tenta destinations em falha e não duplica publicação.
- [ ] Reconciliar `publishToTargets` e publishers existentes; manter um único dono por provider/destino e estado por post/destino.
- [ ] Adaptar composer, carrossel, calendário/agendamento, BrandKit e referências apenas quando código testado da origem preencher lacuna real.
- [ ] Conteúdo gerado/analisado é rascunho; geração, analytics ou recomendação não aprovam nem publicam automaticamente.
- [ ] Capturar hash/proveniência de mídia e approvalRef; provider não configurado gera estado claro.
- [ ] GREEN: fixtures sintéticas do fluxo rascunho→revisão→aprovação→job→receipt, com provider fake e sem post real.

**Aceitação:** uma lógica de publicação, approval vinculado ao snapshot atual e nenhum custo/post externo necessário à validação local.

### Task 09 — Inbox, automações sociais e takeover humano

**Depende:** interface de inbox/contato mapeada na Task 02; usar fixture do adapter e integrar com a Task 06 na Task 15.

**Arquivos:** subpaths inbox/automation em `packages/core/social-brain/`, UI/rotas exclusivas de inbox em `apps/social-web/`, worker e fixtures/testes; migration aditiva somente se necessária. Reutilizar bridge CRM da Task 06 sem editar seus arquivos.

- [ ] RED: mensagem/webhook repetido não duplica conversa/lead; takeover humano suspende resposta automática; tenant/account incorretos são negados.
- [ ] Adaptar normalização Instagram/Facebook e regras de keyword/DM da origem sem trazer sua DB nem duplicar pipeline de envio da Task 08.
- [ ] Escrever ao CRM por API/adapter canônico; registrar origem, consentimento, account e ID externo para dedupe/audit.
- [ ] Default automações desativadas; kill switch/revogação bloqueia novo efeito; nenhum envio real nos testes.
- [ ] GREEN: retries, takeover, opt-out, revogação, cross-tenant e provider ausente.

**Aceitação:** inbox reconhece a pessoa conforme regra aprovada; agente não supera takeover nem consentimento; lead/contact não duplica.

### Task 10 — Conteúdo editorial e analytics sociais

**Depende:** eventos atuais de conteúdo/publicação; paths separados de inbox e publisher.

**Arquivos:** subpaths analytics/editorial em `packages/core/social-brain/`, testes e `docs/unification/social-analytics.md`. Consumir eventos/APIs existentes; não editar `apps/crm`, publisher ou inbox.

- [ ] RED: amostra insuficiente, métrica desatualizada, asset sem fonte e recomendação sem evidência ficam indisponíveis/inconclusivos, nunca viram aprovação.
- [ ] Mapear Content OS atual do CRM e analytics do Social Brain; consolidar um calendário, uma fonte para cada métrica e um job por rotina.
- [ ] Adaptar pipeline de conteúdo diário/referências da origem em rascunhos com fontes e hash; scraping autenticado e image generation são capacidades opcionais com credenciais e consentimento fora da fase de dev.
- [ ] Medir e reconciliar por provider/account/post sem misturar organização ou inventar dados ausentes.
- [ ] GREEN: fixtures de série válida, vazia, atrasada e provider indisponível; aprovação permanece manual.

**Aceitação:** CRM continua entrada do produto; editorial, publicação e métrica têm estados e donos claros; tela visual sem fonte real é rotulada como não conectada.

### Task 11 — Contratos e domínio de dropshipping

**Depende:** contratos Drop verificados na Task 01 e mapa da Task 02; paths separados de social.

**Arquivos:** contratos/state machine em subpath próprio do pacote escolhido na Task 02, testes correspondentes e `docs/unification/dropshipping-domain.md`. Não criar pacote/worker se outro pacote atual comportar o domínio.

- [ ] Revalidar `src/contracts/events.ts`, `orders.ts`, `markets.ts` e decisões nos briefs do SHA autorizado; copiar/adaptar somente contratos necessários preservando notices/licença.
- [ ] RED: mercado ausente/inválido, currency/config não permitida, transição ilegal, executor duplicado e idempotency key reutilizada com payload diferente são rejeitados.
- [ ] Formalizar mercados configuráveis (Portugal/UE, Estados Unidos e terceiro mercado configurável conforme decisão Drop); não codificar taxas, frete, imposto, margem, preço ou política legal como constantes.
- [ ] Implementar estados duráveis de operação (`not_started`, `submitted`, `confirmed`, `failed`, `unknown`) e evidência; `unknown` não permite retry nem fallback de executor.
- [ ] Diferenciar modo `read_only`, `simulated` e `approved_write`; desenvolvimento permanece read-only/simulado.
- [ ] GREEN: testes de schema, transição, replay/idempotência, tenant e receipt com valores sintéticos.

**Aceitação:** um contrato versionado por pedido/evento/mercado, sem servidor/worker/DB concorrente criado antes de demonstrar a lacuna.

### Task 12 — Loja e catálogo em leitura

**Depende:** contratos de mercado/produto deste plano; adapter read-only em path próprio.

**Arquivos:** subpath exclusivo do adapter de loja, testes e `docs/unification/store-adapter.md`. Sem editar contratos, workflow de pedidos, UI global ou manifests.

- [ ] RED: escopo de leitura insuficiente, loja trocada, resultado paginado parcial e timeout não viram catálogo/pedido completo nem estado de sucesso.
- [ ] Confirmar provider de loja aprovado e API/schema vigente; usar Shopify Admin GraphQL read-only somente se Shopify estiver confirmado como loja-alvo.
- [ ] Implementar fetch paginado/read-only para produtos, inventário e pedidos; guardar external IDs, versão/snapshot, timestamps e origem.
- [ ] Credenciais entram em secret store/runtime existente, nunca no banco de cliente em claro nem nos logs.
- [ ] GREEN: fixtures paginadas, permission denied, stale data, rate limit e timeout; zero mutation GraphQL.

**Aceitação:** usuário autorizado vê snapshot correto da sua loja; integração sem credencial falha sem afetar CRM/social.

### Task 13 — Sourcing, custo e margem sem checkout

**Depende:** contratos de mercado/produto deste plano; módulo de sourcing/cálculo em paths próprios.

**Arquivos:** subpath próprio de sourcing e serviço puro de unit economics no pacote dono, testes e `docs/unification/sourcing-economics.md`. Sem editar adapter de loja ou workflow de pedidos.

- [ ] RED: moeda/market mismatch, custo ou frete ausente, fee desconhecida, margem inválida, preço stale e limite de API bloqueiam cálculo/decisão em vez de assumir valores.
- [ ] Confirmar a compatibilidade, disponibilidade, custo e scopes atuais dos endpoints AutoDS MCP e DSers MCP; a documentação pública não é implementação server-side e não prova compatibilidade com o runtime.
- [ ] Adaptar somente capacidades autorizadas/read-only: pesquisa, comparação, vínculo produto-fornecedor e cotação disponível. Não copiar AutoDS proprietário; não executar checkout/compra.
- [ ] Implementar cálculo puro com entradas explícitas para custo, envio, fees, impostos, CAC e margem; nunca preencher defaults comerciais não aprovados.
- [ ] Um produto/pedido e uma tentativa têm provider/executor definido; mudança de provider exige novo estado aprovado e nunca é automática após `unknown`.
- [ ] GREEN: fixtures de moedas, campos faltantes, preço expirado, provider indisponível e comparação com resultado calculado manualmente.

**Aceitação:** recomendação mostra entradas, fonte, timestamp e incerteza; nenhuma compra nem escrita no fornecedor.

### Task 14 — Operação de pedidos, aprovações e interface Lumenva

**Depende:** interfaces de pedido/approval deste plano; wiring final acontece na Task 15.

**Arquivos:** subpaths próprios de workflow/order approval e rota UI dedicada sob `apps/crm/app/(admin)/(protected)/dropshipping/`, testes e `docs/unification/dropshipping-runbook.md`. Navegação global, schema, manifests e exports ficam para Task 15.

- [ ] RED: pedido alterado depois da aprovação, actor sem capability, aprovação revogada, replay, timeout ou estado `unknown` impedem write/retry e não marcam fulfillment como concluído.
- [ ] Implementar state machine/eventos para pedido recebido→revisado→aprovado→submetido→confirmado/falhou/unknown→tracking, com reconciliation explícita.
- [ ] Planejar integração n8n externa para webhooks/eventos somente se já hospedada e aprovada; não criar scheduler/fila paralela. Se não houver ambiente aprovado, manter adapter e fixtures como `EXTERNAL_VALIDATION_PENDING`.
- [ ] Integrar UI dropshipping à navegação/sessão do CRM; RBAC, tenant, receipts, erros, loading/empty/offline e approval snapshot são server-side.
- [ ] Não habilitar `approved_write` durante esta implementação; deixar kill switch desativado e documentar os requisitos para ativação humana posterior.
- [ ] GREEN: workflow com store/provider fake, restart, lock/idempotência, cancelamento, revoke e cross-tenant; nenhum pedido real criado.

**Aceitação:** Lumenva oferece gestão/reconciliação de pedidos com status verdadeiro; execução comercial permanece bloqueada até autorização e gate operacional próprios.

### Task 15 — Aceitação integrada, recuperação e prontidão

**Depende:** Tasks 04–14 aprovadas/integradas e docs 01–03 revisadas. **Entrega:** candidato integrado revisável, evidências por capacidade e runbook de recuperação.

**Arquivos:** `docs/unification/release-readiness.md`, `rollback.md`, `runbook.md` e `source-closure.md`; fixtures E2E somente se já fizerem parte dos workflows existentes; correções de comportamento voltam à tarefa dona.

- [ ] Conferir os GitHub Actions de cada PR e da base integrada; registrar SHA e link dos checks. Nenhuma validação é executada no Windows.
- [ ] Fazer percurso sintético: login→CRM/contact→inbox/social draft→approval→publish receipt fake→loja read snapshot→margin proposal→order approval simulada→tracking receipt fake.
- [ ] Verificar explicitamente isolamento entre organizações, duplicidade de eventos, approval stale/revogada, provider offline, rate limit, timeout, restart, DB/storage indisponível e migration parcial/rollback.
- [ ] Se houver mudança de schema/storage, conferir backup/restauração sintética, IDs, hashes, eventos, snapshots e receipts nos gates disponíveis; sem restore/cutover em produção.
- [ ] Marcar cada capability `CODE_READY`, `CI_VERIFIED`, `EXTERNAL_VALIDATION_PENDING` ou `PRODUCTION_RELEASED`; somente a última exige prova real e autorização separada.
- [ ] Confirmar um dono/caminho ativo por capability; listar `DEFER`, `DOCUMENT_ONLY` e `REJECT` sem declarar migração concluída.
- [ ] Preparar proposta de arquivamento das origens preservando histórico e código não migrado; não executar archive, delete, deploy ou publicação.

**Aceitação:** módulos CRM, social e dropshipping coexistem no Lumenva, sem duplicação de autoridade, cross-tenant ou efeito externo involuntário. Pendências de provider/produção aparecem separadas dos checks CI.

## Operação paralela no Jules

1. O Owner revisa o plano e confirma a base canônica. Tasks 01–03 podem ser criadas em sessões concorrentes porque têm arquivos de documentação separados.
2. Os SHAs deste plano já foram auditados. Task 01 revalida em paralelo; se detectar divergência, pausa somente os ports dependentes. Acesso a uma origem não autoriza acesso às demais.
3. Tasks 04–14 podem iniciar como sessões distintas após conferir ownership e interfaces deste plano. Criar cada sessão por chamada individual, uma por vez, até 14 sessões de implementação simultâneas; a 15ª vaga fica disponível para continuação sem ultrapassar a cota Pro.
4. Não usar `--parallel`: ele replica o mesmo prompt. Cada sessão remota recebe uma tarefa distinta, base SHA e paths próprios, e entrega sua própria PR no GitHub.
5. Paths compartilhados, migrations, schema/types, manifests, lockfile e exports centrais têm owner único. Se Task 01 detectar colisão, serializar somente as sessões afetadas.
6. O Owner/reviewer integra PRs uma a uma. Após cada merge, revalidar os GitHub Actions das PRs abertas contra a nova base. Task 15 só começa após as implementações integradas.
7. Windows não executa testes/build, Docker, instalação de dependências, worktree ou checkout auxiliar. Não criar arquivos temporários locais. GitHub Actions executa os checks; Jules edita no ambiente remoto.

### Prompt por sessão Jules

```text
Repositório de destino: trydavidqix/Lumenva.
Plano: docs/superpowers/plans/2026-10-09-lumenva-crm-social-dropshipping-jules.md.
Leia o plano inteiro e AGENTS.md/regras aplicáveis antes de editar.
Execute somente Task NN — TÍTULO, na base SHA informada e com a allowlist registrada.
Dependências/interfaces: consulte a task; outras tarefas podem estar em andamento em paths separados.
Verifique os SHAs/acesso da fonte; não presuma autorização ou checkout de outro repo.
Se base, fonte, licença, decisão, secret de teste ou gate essencial faltar, pare e reporte BLOCKED com evidência. Não invente alternativa que mude contratos.
Não crie subagentes nem outra sessão a partir deste prompt. Não faça merge/deploy,
não modifique repositório de origem, não execute chamadas pagas/OAuth real/publicação,
nem escrita em loja/fornecedor. Preserve mudanças preexistentes e segredos.
Implemente somente a task atribuída; não execute testes/build/Docker localmente. GitHub Actions executa os checks.
Entregue PR com task ID, base/source/final SHA, paths alterados, links/status dos checks,
decisões, blockers e rollback.
```

### CLI e pesquisa Jules

Consulta feita em 09/10/2026. A CLI oficial cria sessões remotas, lista repositórios/sessões e acompanha resultados; a API cria uma sessão por requisição. Jules Pro documenta até 15 tarefas concorrentes. Criar cada sessão individualmente com prompt distinto; `--parallel` replica o mesmo prompt e não coordena tasks diferentes. Cada sessão roda em VM remota e pode entregar PR própria. Conferir a sintaxe instalada; não presumir flags de base nem auto-merge.

Exemplo CLI, repetir com uma chamada e um prompt diferente por tarefa:

```bash
jules remote new --repo trydavidqix/Lumenva --session "Execute somente Task NN deste plano e entregue uma PR."
```

Na API, criar uma sessão por requisição `POST https://jules.googleapis.com/v1alpha/sessions`, com `prompt` e `sourceContext` apontando para a branch autorizada. Não registrar chave de API neste plano nem habilitar auto-merge.

- [Jules CLI reference](https://jules.google/docs/cli/reference/)
- [@google/jules npm README](https://www.npmjs.com/package/@google/jules)
- [Jules CLI examples](https://jules.google/docs/cli/examples/)
- [Plano e briefings do Drop](https://github.com/trydavidqix/Drop/tree/main/docs)

## Definição de concluído

- Lumenva é o repositório canônico da experiência CRM + social + dropshipping aprovada.
- CRM permanece central e preserva dados/fluxos, com contatos/leads de origem social ligados por regras explícitas.
- Capacidades sociais são unificadas por ownership demonstrado; não há segundo publisher, inbox ou banco pessoal importado sem adaptação.
- Drop deixa de ser somente contratos/documentação: capacidades selecionadas de loja, sourcing, economics e pedidos têm implementação e gates no Lumenva; qualquer dependência externa sem prova continua declarada pendente.
- Tenancy, approvals, idempotência, audit, estado incerto e rollback passam nos testes das tarefas proprietárias.
- Nenhuma operação real de provider/loja é exigida para provar o código; produção permanece gate separado, explícito e humano.
- Repositórios de origem ficam preservados até decisão humana posterior; não declarar “só existe no Lumenva” enquanto houver capability prometida sem implementação ou integração rastreável.

Este documento é uma proposta para revisão. Ele não aprova tecnicamente sua própria arquitetura nem autoriza executar as 15 tarefas automaticamente.
