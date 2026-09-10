# Changelog

Todas as mudanças relevantes deste projeto são documentadas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o versionamento segue [SemVer](https://semver.org/lang/pt-BR/).

Se você roda o Lumenva numa VPS, **leia a seção da versão para a qual está atualizando antes de rodar `bash update.sh`**. Mudanças que exigem ação manual aparecem sob **⚠️ Requer atenção**.

## [Não lançado]

### F8 — Release readiness

- Preparado contrato de release `0.2.0`, probe `/api/v1/readyz`, inventário de migrations em dry-run e checklist de rollback/deploy. Nenhum deploy foi executado.

### Alterado

- **Voz (sessão 2026-08-29, integração):** `codex/voice-media-integration` (276 commits, 234
  arquivos) trazida via `git merge --no-ff` para `codex/crm-consolidated` (`6f6232a2`), sem
  conflitos — `lib/voice/**` e o código de sinalização SIP/BYOC agora existem de fato nesta
  branch. Corrigidos 3 problemas expostos pela merge: erro de sintaxe TS em
  `app/app/settings/tenant/voice/_form.tsx` (`)}` órfão), 1 warning eslint em
  `lib/voice/sip/testing/fake-ari-server.ts` (`consistent-type-imports`), e um bug real de
  infraestrutura de teste em `vitest.config.ts` — os padrões de `exclude` sem prefixo `**/` não
  alcançavam `tests/e2e/**` dentro de worktrees git aninhadas (`.worktrees/*`,
  `.claude/worktrees/*`), fazendo o vitest coletar specs Playwright de até 10 worktrees e travar
  `pnpm test:unit`. **Gap ainda aberto, não corrigido:** `supabase/baseline.sql` não tem o
  apêndice idempotente das migrations de voz (`voice_calls`, `voice_phone_numbers`,
  `voice_sip_connections`) — viola a regra da tripla; confirmado por
  `tests/unit/manifest-x-migrations.test.ts` falhando. Também 1 falha em
  `tests/unit/navegacao-completude.test.ts` sugerindo tela de voice sem entrada em
  `lib/navigation/registry.ts`. **`pnpm test:unit` completo rodado em ambiente cloud (Codex) por
  contenção de recursos no Mac local: 4150 passaram, 3 falharam (4 arquivos), 4 pulados.** Além
  dos dois gaps já suspeitados, apareceram 2 problemas novos: o número de migration `0124` está
  duplicado entre `0124_ai_chunks_embedding_2048` (pré-existente) e `0124_customer_memory` (trazida
  pela merge); e `workers/voice-pipecat-runtime/main.test.mjs` +
  `workers/voice-worker/pending-outbound.test.mjs` falham ao carregar no vitest com `Cannot bundle
  Node.js built-in "node:test"` (usam o test runner nativo do Node, não vitest). **As 4 falhas
  foram corrigidas** (migration renumerada `0124`→`0132`, 7 migrations de voz registradas em
  baseline+MANIFEST, `/app/settings/tenant/voice` na navegação, os dois `node:test` excluídos do
  `test:unit` e movidos pro `node --test` dentro de `scripts/verify-voice-core.sh`) e confirmadas
  numa corrida completa em hardware separado (VPS de produção, diretório isolado via `rsync`,
  apagado ao fim): 4119 passaram, 2 falhas ambientais (rsync sem `.git`, confirmadas falso-negativo
  rodando os mesmos 2 testes localmente: 39/39). `pnpm test:db` também rodado na VPS (Postgres
  descartável via Docker): 75 arquivos/507 testes passaram, 1 pulado, "test:db verde" — confirma
  `baseline.sql` com as migrations de voz instalando/atualizando limpo e RLS/multi-tenancy
  corretos. CRM de produção na mesma VPS confirmado saudável antes/depois de ambas as corridas.
  Rodando os 7 gates (`typecheck`, `lint`, `lint:channels`, `lint:tenant-filter`, `test:unit`,
  `test:db`, `gov:verify`) numa corrida completa na VPS, `typecheck`/`gov:verify` deram OOM (heap
  insuficiente na VPS de 3.7GB, limitação já conhecida, não regressão) — rodados no Mac local em
  vez disso, onde `pnpm lint` sozinho **achou um segundo bug real**: `eslint.config.mjs` tinha
  `globalIgnores` cobrindo `.claude/worktrees/` mas não `.worktrees/` (a outra pasta de worktrees
  paralelas), mesma classe de bug do `vitest.config.ts` corrigido acima — 46929 erros falsos no
  Mac (que tem as 10 worktrees) contra 0 na VPS. Corrigido; `pnpm gov:verify` completo agora passa
  limpo no Mac local (harness:check, typecheck, lint 0 erros, lint:channels, lint:tenant-filter,
  test:unit 432 arquivos/4153 passaram/4 pulados/0 falhas). **Enviado a `origin` com autorização
  explícita do dono** (`git push origin codex/crm-consolidated`, fast-forward, `d8fbc575..a552a512`).
  Vercel Preview disparado automaticamente pela integração GitHub, `READY` sem erro
  (`crm-git-codex-crm-consolidated-lumenva.vercel.app`, commit `a552a512`).

- **Voz:** documentação sincronizada com a decisão de SIP/BYOC para o número do próprio cliente e
  com o estado real da branch Voice Core `d3c97cbd`. Confirmado por leitura de código: a camada
  de sinalização (ARI, listener, reconexão, rotas CRM, forwarder, worker) está implementada e
  testada de ponta a ponta, não é mais scaffold; testada parcialmente também na VPS.
  `faster-whisper`, Piper e Kokoro medidos como viáveis em CPU na própria VPS de produção
  (isolado e sob carga concorrente com o CRM ligado). Deploy do Asterisk extraído e versionado em
  `ops/voice-asterisk/` (segredos redigidos). **Com autorização explícita do dono, um script
  ad-hoc fora do repo provou a primeira chamada telefónica real de ponta a ponta** (softphone →
  Asterisk → STT → resposta → TTS → volta ao telefone) — prova de viabilidade técnica, não é
  ainda a integração real nos contratos `lib/voice/**` nem tem Agent OS. Achado de segurança
  separado, não corrigido: Asterisk exposto a brute-force na porta 5060/UDP pública. O código
  ainda não foi integrado no CRM consolidado. O schema Voice foi aplicado no banco usado pela VPS
  após autorização explícita; não há ativação de `VOICE_LIVE_ENABLED=true`.

- **Voz (sessão seguinte):** dois bugs reais achados e corrigidos na ponte de teste ad-hoc da
  VPS (fora do repo). (1) NAT do PJSIP mandava RTP de saída pro IP privado/Wi-Fi local do
  celular do dono em vez do IP público — corrigido com `rtp_symmetric=yes`,
  `rewrite_contact=yes`, `force_rport=yes` em `/etc/asterisk/pjsip.conf`; confirmado corrigido
  via log real de uma chamada, sentido servidor→celular. **Sentido celular→servidor confirmado
  resolvido na mesma sessão** (ciclo completo fala→STT→resposta funcionando, transcrição
  correta). (2) Áudio de teste do OpenAI TTS (`gpt-4o-mini-tts`) tocava lento por suposição
  errada de sample rate na conversão pra µ-law; corrigido revertendo pra conversão sem resample
  depois de diagnóstico por transcrição em múltiplas taxas candidatas. Pesquisa de alternativas
  de TTS pago documentada (ElevenLabs, XTTS-v2/F5-TTS sem licença comercial, Chatterbox/StyleTTS2,
  Inworld AI, OpenAI TTS). Voz `nova` (OpenAI) escolhida inicialmente pra saudação, **depois
  substituída na mesma sessão por Inworld AI** (toolkit Composio conectado; API gera direto em
  µ-law 8kHz, sem o pipeline de resample que causou bug com a OpenAI) — **decisão final: Inworld
  AI, voz `Leonor` (português europeu), `speaking_rate=0.85`, modelo `inworld-tts-2`**. Detalhe:
  `docs/evidence/voice-vps-real-call-bridge-2026-08-28.md`.

- **Ferramentas de agente (fora do repositório):** duas skills globais instaladas em
  `~/.claude/skills/` — `inworld` (SDK/referência da API Inworld TTS, pronta pra uso) e
  `9router-tts` (proxy multi-provider de TTS OpenAI-compatible; **em observação**, exige
  hospedar um serviço `9Router` próprio ainda inexistente — pendência pra quando houver decisão
  de montar um roteador de modelos gratuitos).

- **Voz (sessão seguinte, mesmo dia) — migração pra Pipecat pausada:** tentativa de recompor a
  ponte com Asterisk 22.11.0 (compilado do fonte, isolado em `/opt/asterisk-v2/`, porta 5061,
  sem tocar produção) + `chan_websocket` + `pipecat-asterisk` + `OpenAIRealtimeLLMService`, pra
  resolver a latência arquitetural (5-9s) de um teste full-stack OpenAI anterior. Conexão com a
  OpenAI confirmada funcionando; **áudio do celular nunca chega no Asterisk-v2** (bloqueador não
  resolvido, mais de 3 correções tentadas sem sucesso — ICE, faixa de porta RTP, dialplan).
  Pausado por decisão do dono seguindo a skill `systematic-debugging`, não abandonado. Instância
  antiga (porta 5060) continua intocada e é o único caminho comprovado funcionando hoje. Regra
  nova adicionada em `~/.claude/CLAUDE.md` (fora do repo, config pessoal do agente): antes de
  assumir que algo exige construir do zero, procurar implementação de referência real via
  `gh search repos`. Detalhe: `docs/handoffs/HANDOFF-voice-sip-2026-08-28.md`.

- **Privacidade:** a superfície administrativa e as rotas públicas de compliance usam
  `/app/privacy` e `/api/v1/privacy`; nomes `lgpd` que permanecem em migrations, jobs e
  webhooks Nuvemshop são compatibilidade/histórico, não rotas novas.
- **IA e memória:** providers Google/Gemini foram adicionados ao runtime; embeddings podem
  usar o override `EMBEDDING_BASE_URL`/`EMBEDDING_API_KEY`/`EMBEDDING_MODEL_ID`, e Mem0 e
  Graphiti entram no worker apenas sob feature flag/kill switch. `ai_chunks.embedding` passou
  para `vector(2048)` para o caminho NVIDIA documentado no runbook.
- **Tools externas:** Composio suporta sessões `direct_tools` com filtragem por slug exata;
  o catálogo MCP foi ampliado com tools de anexos, notas, casos humanos, evolução, operação,
  retenção e privacidade.
- **Webhooks:** Meta e WAHA validam envelopes com Zod antes do ingest; os receivers públicos
  têm rate limit próprio e a documentação de WAHA agora aponta o código executável, não o
  esboço histórico.
- **Inbox e escalada:** a rede de segurança do realtime cobre conversas e mensagens; handoff
  nativo abre `agent_case` formal e a devolução fecha o caso aberto com evento auditável.
- **Flywheel:** a Phase 10 persiste outcomes e agenda o judge/distiller loop em
  `/api/v1/cron/flywheel-judge-loop`, com aprovação administrativa para aplicar propostas.

### Corrigido

- **RAG multi-agente:** o worker de reindexação sempre resolvia o agente-alvo pelo default da
  organização, ignorando qual agente o evento `knowledge_source.updated` realmente descrevia —
  numa org com mais de um agente ativo, publicar/reindexar conhecimento de um agente não-default
  reindexava o default em silêncio (evento reportava `done`, mas o agente que mudou nunca
  recebia os chunks). Agora o worker usa `payload.agent_id` do próprio evento, com o default como
  fallback só quando o evento não carrega essa informação.
- **RAG multi-agente:** `/app/ai/knowledge/sources` só permitia configurar o agente default da
  organização — não havia como gerenciar conhecimento de nenhum outro agente. Adicionado seletor
  de agente (`?agentId=`) na tela.
- A fonte de conhecimento `conversations` (auto-criada, alimentada pelo cron dedicado
  `kb-conversations-batch`) deixou de ser marcada `failed` pelo reindex genérico baseado em FAQ —
  ela nunca tem itens desse tipo por desenho, então sempre reportava falha mesmo saudável.

### Segurança e operação

- Adicionado `lint:tenant-filter` como gate heurístico para handlers que usam client admin.
- O limite `maxDuration` do cron do flywheel foi ajustado para o teto de 300s do Vercel Hobby.
- A validação local e os runbooks são a prova primária enquanto GitHub Actions permanece
  desabilitado por decisão operacional registrada em `docs/current-state.md` §10.

## [1.2.0] — 2026-08-06

Versão grande: 122 correções e 62 novidades desde a 1.1.0. O tema é o agente de IA deixar de
ser um respondedor e virar parte da operação — com papel próprio, capacidades declaradas e
lugar na tela —, e o sistema parar de mentir quando algo dá errado.

### Adicionado

- **O agente publicado ganha papel próprio**, entre atendente e gerente: ele assume o lead,
  devolve para uma pessoa quando precisa, e a volta aparece na linha do tempo em vez de sumir.
- **Roteador de intenção por número.** Um WhatsApp só passa a atender vários assuntos: o
  roteador entende o que o cliente quer e entrega para o agente certo.
- **Fila de leads por atendente, com rodízio.** A distribuição deixa de ser combinada por fora
  e vira porta na tela.
- **Capacidades do agente.** Você escolhe o que ele pode fazer, vê quantas vezes usou cada uma,
  e ele avisa quando falta uma capacidade em vez de falhar calado.
- **Catálogo de modelos atualizado** nos três provedores — quem instala não escolhe mais entre
  modelos de duas gerações atrás, pagando mais caro por pior.
- **Aviso de mensagem presa.** Uma tarefa automática detecta mensagem que ficou "enviando" e
  abre um aviso na Central, em vez de deixar o cliente sem resposta em silêncio.

### Corrigido

- **Duas partes do sistema respondiam à mesma mensagem do cliente.** Agora há um dono só.
- **"O WhatsApp está fora do ar" quando o serviço estava de pé.** Toda falha de rede caía na
  mesma frase, mandando reiniciar um container que nunca havia caído. Agora a mensagem
  distingue endereço errado de serviço parado e diz onde mexer.
- **O roteador recusava um número que existia**, com a mensagem "não encontrado nesta
  organização", quando na verdade a consulta é que havia falhado.
- **A tela de funis misturava organizações** do mesmo usuário.
- **Excluir um canal** apagava o roteador junto, sem avisar, e deixava a Meta ainda entregando
  mensagens. Reconectar dizia "conectado" com a linha ainda arquivada.
- **Erro ao publicar o agente no onboarding criava um agente novo a cada clique.**
- **O custo de IA sem agente dono sumia da auditoria** — as telas de consumo mostravam zero
  numa instalação com tráfego real e provedor pago.

### Segurança

- **8 de 25 funções internas do banco estavam executáveis pela chave pública** que vai para o
  navegador, incluindo uma que escreve recebendo a organização por parâmetro, sem checar se
  você pertence a ela. Todas fechadas, com uma varredura que reprova a próxima.

**⚠️ Requer atenção**

Esta versão traz mudanças de banco (migrations 0100 a 0114). O `update.sh` aplica tudo sozinho
e faz backup antes — você não precisa rodar nada à mão. Se a sua instalação está há muito tempo
sem atualizar, é normal a etapa do banco demorar mais e imprimir vários avisos de "já existe":
eles são esperados e o script só destaca o que não for.

## [1.1.0] — 2026-07-30

### Adicionado

- **Atualização pela própria tela.** O dono da instalação vê a versão instalada no rodapé do menu
  e, quando há versão nova, atualiza com um clique — sem abrir terminal. A tela mostra o que muda,
  avisa quanto tempo o sistema fica fora do ar e faz uma cópia de segurança antes.

### Alterado

- **A atualização passa a instalar a última versão publicada, não o topo do código em
  desenvolvimento.** O `update.sh` recusa instalar uma versão anterior à que já está no servidor
  (voltar no tempo continua possível com `--force`) e grava a imagem escolhida no `.env` — assim um
  `docker compose up -d` rodado depois não traz o app de volta para a `latest`.

**⚠️ Requer atenção**

Quem já tem o CRM instalado precisa rodar `bash hostgator-setup-kit/update.sh` **duas vezes** pelo
terminal para ativar o botão. Não é engano: a primeira execução ainda é a do programa antigo, que
baixa o novo mas não sabe ligar o agente da tela; a segunda já roda o programa atualizado e liga.
Depois disso, nunca mais é preciso o terminal.

## [1.0.0] — 2026-07-27

Primeira versão marcada do Lumenva. O projeto vinha sendo desenvolvido publicamente desde abril de 2026 sem tags; esta release estabelece o ponto a partir do qual toda mudança passa a ser versionada e descrita — porque quem hospeda o próprio sistema precisa saber o que muda antes de atualizar.

### Plataforma

- Multi-tenancy com RLS em toda tabela tenant-aware, resolvida por `fn_user_org_ids()`.
- RBAC de 4 papéis (`viewer` < `agent` < `manager` < `admin`), aplicado no servidor.
- Autenticação via Supabase Auth com MFA TOTP obrigatório para administradores.
- Log de auditoria append-only com retenção de 5 anos.
- Onboarding de organização e ciclo completo de convite de membros.

### Atendimento WhatsApp

- Inbox de 3 painéis em tempo real, com múltiplos números via WAHA.
- Mídia servida por Storage com URLs assinadas; transcrição de áudio.
- Proteção anti-banimento: ritmo com variação, teto por número, janela de horário, aquecimento gradual e variação de texto.
- Detecção de pedido de descadastro (STOP) no inbound, com bloqueio automático.

### CRM

- Funil kanban com indexação fracionária de posição.
- Vocabulário configurável por funil — o mesmo núcleo atende e-commerce, clínica, imobiliária, infoproduto e serviços.
- Customer 360, contatos, etiquetas e linha do tempo unificada.
- Integração com Nuvemshop para a vertical de e-commerce.

### Agentes de IA

- Agentes com RAG por organização (pgvector), análise de sentimento e controle de orçamento por organização.
- IA como responsável de primeira classe, sujeita às mesmas regras de governança de um humano.
- Handoff IA→humano auditado, entregando resumo contextual (não a conversa crua).
- Cadeia de 7 verificações antes de cada envio, em ordem fixa: descadastro, LGPD, anti-banimento, variação de texto, promessa determinística, promessa semântica e disclosure. Cada avaliação vira registro durável e auditável — inclusive as que barram o envio.
- Servidor MCP interno.

### Governança de atendimento

- Atribuição e transferência auditadas, fila com posição e roteamento automático.
- Escopo de visualização por papel, aplicado via RLS.
- Métricas por atendente.

### Automação

- Fontes de captação: endpoint público por organização que recebe leads de landing pages, formulários e ferramentas externas.
- Regras QUANDO/SE/ENTÃO, que nascem pausadas até revisão.
- Webhooks de saída com proteção contra SSRF.
- Nenhum trigger de banco faz HTTP: eventos vão para `event_log` e são drenados por rota agendada.

### LGPD

- Exportação e anonimização em cascata via workers, com anonimização preferida sobre exclusão.
- Consentimento auditado.

### Self-host

- `hostgator-setup-kit`: instalação completa (app + WAHA + banco) com um comando.
- `baseline.sql` idempotente e auto-curativo — atualização não quebra clone com dados legados.
- 8 scripts de operação: `install`, `update`, `backup`, `restore`, `reset-password`, `reset-mfa`, `healthcheck` e o assistente de instalação em IA.
- Imagem publicada em `ghcr.io/melgarafael/deskcommcrm` — a VPS não compila nada.

### Qualidade

- CI com dois portões obrigatórios: `verify` (typecheck, lint, testes unitários) e `invariants`.
- O portão `invariants` sobe um Postgres limpo, aplica o `baseline.sql` em modo install e update, e roda **364 testes de invariante** em 56 arquivos — incluindo o teste de isolamento entre organizações, que prova que um usuário de uma organização não enxerga nenhuma linha de outra.
- Suíte end-to-end em Playwright dirigindo o frontend.

### ⚠️ Requer atenção

- **Node 22 é obrigatório para desenvolvimento.** A suíte de invariantes instancia o cliente do Supabase, que exige o `WebSocket` global — nativo apenas a partir do Node 22. Isso não afeta quem apenas hospeda: a VPS roda a imagem pronta.

[Não lançado]: https://github.com/melgarafael/DeskcommCRM/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/melgarafael/DeskcommCRM/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/melgarafael/DeskcommCRM/releases/tag/v1.0.0
