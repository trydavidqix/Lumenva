---
title: DeskcommCRM — Catálogo de Regras de Negócio
version: 0.1
status: em revisão
date: 2026-04-28
owner: Rafael Melgaço
---

# DeskcommCRM — Catálogo de Regras de Negócio

> Regras de negócio normalizadas com IDs lookup-able. Cada regra documenta GIVEN/WHEN/THEN/EXCEPT, enforcement layer e política de override. Especificações técnicas (schema SQL, payloads) ficam nas Specs (Fase 3); aqui é onde a lógica de negócio vive.

## Notação

- **ID** prefixado por domínio: `T` (Tenancy), `L` (Privacidade/RGPD), `W` (WhatsApp), `P` (Pipeline), `AT` (Atendimento), `IA` (IA), `B` (Billing), `VOZ` (canal de voz).
- **Origem**: link pro PRD/sub-PRD que define a capacidade subjacente.
- **Tipo de comprometimento**:
  - **Hard constraint** — violação = bug. Sistema recusa.
  - **Soft policy** — comportamento default. Configurável globalmente.
  - **Default com override** — comportamento default. Role apropriada pode pular pontualmente, com audit.
- **Enforcement** — camada onde a regra vive: `DB` / `API` / `UI` / `Worker` / `Cron` / `RAG` / `LLM-guardrail`.

---

## 1. Tenancy & Isolamento (T)

### T-01 — Toda tabela tenant-aware tem `organization_id` + RLS habilitada
- **Origem**: Sub-PRD 01 §3.2
- **Tipo**: Hard constraint
- **Regra**: GIVEN qualquer tabela que armazena dado de tenant; WHEN é criada via migration; THEN deve ter `organization_id uuid not null references organizations(id) on delete cascade` + policy `tenant_isolation_<tabela>_all` aplicada.
- **Enforcement**: DB (RLS) + linter SQL no CI + teste de isolamento obrigatório por tabela.
- **Exceção**: Tabelas globais (`provider_catalogs`, `system_config`, `feature_flags`) — explicitamente sem `organization_id`, somente leitura pra usuários, escrita só por DBA.
- **Override**: Nenhum em runtime. Mudança requer migration revisada por 2 engenheiros.

### T-02 — Service role bypass requer filtro manual de `organization_id`
- **Origem**: Sub-PRD 01 §3.2
- **Tipo**: Hard constraint
- **Regra**: GIVEN handler usando admin client (webhook receiver, cron); WHEN executa qualquer query em tabela tenant-aware; THEN deve filtrar `organization_id` resolvido de fonte confiável (cookie validado, JWT, `webhook_secret`, path token) — **NUNCA do body do request**.
- **Enforcement**: Code review + linter custom + audit log com flag `bypassed_rls=true`.
- **Exceção**: Endpoints públicos sem dado de tenant (`/api/v1/health`).

### T-03 — JWT carrega `tenant_id` claim em cada request autenticado
- **Origem**: Sub-PRD 01 §3.1
- **Tipo**: Hard constraint
- **Regra**: GIVEN usuário logado; WHEN faz qualquer chamada à API; THEN o JWT contém `tenant_id` claim e o middleware injeta no contexto da request antes de qualquer query.
- **Enforcement**: API (middleware Next.js) + DB (RLS lê via `auth.uid()` → `fn_user_org_ids()`).
- **Exceção**: Endpoints sem auth (`/api/v1/health`, `/api/v1/oauth/callback`).

### T-04 — Super-admin de plataforma é o único role cross-tenant
- **Origem**: Sub-PRD 01 §3.4
- **Tipo**: Hard constraint
- **Regra**: GIVEN um usuário sem flag `is_platform_admin`; WHEN tenta acessar dado de tenant ao qual não pertence; THEN RLS retorna conjunto vazio (404 ou 403 dependendo do endpoint).
- **Enforcement**: DB (helper RLS retorna TRUE para platform_admin em qualquer tabela tenant-aware) + audit log com flag `acting_as_platform_admin=true`.
- **Override**: Nenhum em runtime. Inclusão/remoção em `platform_admins` é processo manual de DBA com double-confirmation.

### T-05 — Roteamento de API usa subdomain OU header `X-Tenant-ID`
- **Origem**: Sub-PRD 01 §3.2 (decisão deferida na §9 do mesmo)
- **Tipo**: Soft policy
- **Regra**: GIVEN request entrando pela API; WHEN chega no edge; THEN tenant é resolvido via subdomain (`<tenant>.api.deskcomm.com`) OU header `X-Tenant-ID` (configurável global). API key NÃO determina tenant — o JWT/Bearer determina.
- **Enforcement**: Edge function / middleware.
- **Exceção**: Webhooks externos (Nuvemshop) usam path token único por tenant em vez de subdomain.

### T-06 — Tenant criado vem com pipeline default seedado
- **Origem**: Sub-PRD 01 §3.7 + Sub-PRD 04 §3.3
- **Tipo**: Hard constraint
- **Regra**: GIVEN nova organização criada; WHEN transação de criação commita; THEN trigger `fn_seed_default_pipeline_for_org` cria pipeline "Pedidos" com 7 stages canônicas e-commerce em ordem.
- **Enforcement**: DB trigger.
- **Exceção**: Tenant criado via migration de import (data lift de cliente legado) — migration pode pular o seed e popular pipelines manualmente.

### T-07 — `webhook_path_token` é único globalmente
- **Origem**: Sub-PRD 03 §3.3
- **Tipo**: Hard constraint
- **Regra**: GIVEN tenant cria nova `channel_session` ou conecta integração externa; WHEN gerar `webhook_path_token`; THEN o valor é UUID v4 + único globalmente (não por tenant) — `unique(webhook_path_token)`. Webhook URL inclui o token no path.
- **Enforcement**: DB unique constraint + verificação no service.
- **Exceção**: Nenhuma.

### T-08 — Toda query, log e métrica é tenant-scoped
- **Origem**: Doutrina herdada (memória de projeto, `project_tenancy_model`)
- **Tipo**: Hard constraint
- **Regra**: GIVEN qualquer query, log estruturado ou métrica emitida pelo backend; WHEN não envolve dado global; THEN tem `organization_id` como tag/coluna obrigatória.
- **Enforcement**: Linter custom + revisão em PR.
- **Exceção**: Logs do próprio sistema sem dado de domínio (startup, shutdown, health check).

---

## 2. Privacidade / RGPD (L)

> Renumeração evitada de propósito — L-01…L-10 continuam sendo os IDs referenciados
> por outras specs/PRDs; L-11 é novo (violação de dados, RGPD Art. 33, sem
> equivalente anterior). O conteúdo abaixo foi migrado de LGPD (lei brasileira) para
> RGPD/GDPR (Regulamento (UE) 2016/679), que é a lei que rege o negócio a partir de
> 2026-08-20 (clientela europeia, operação sediada em Portugal). L-07/L-08/L-09
> (CPF) permanecem tecnicamente corretas mas são um caso Brasil-específico e opcional
> por tenant — não fazem parte da migração porque nenhum cliente europeu tem CPF.

### L-01 — Anonimização preferida sobre delete físico
- **Origem**: PRD-Mestre §7.1, Sub-PRD 01 §3.6, Sub-PRD 06 §3.9
- **Tipo**: Hard constraint
- **Regra**: GIVEN solicitação de redact RGPD (direito ao apagamento, Art. 17); WHEN o contato tem **qualquer** referência em `crm_leads`, `orders`, `crm_lead_activities`, `messages` (ou seja, é praticamente sempre); THEN executar **anonimização** (não delete). Delete físico apenas se contact não tem nenhuma dependência (raro: contato criado e nunca usado).
- **Enforcement**: API (`POST /api/v1/privacy/anonymize`) + worker de privacidade.
- **Exceção**: Tenant pode solicitar delete forçado via processo manual com aprovação dupla (admin + super-admin) — auditado.

### L-02 — SLA de data_request: 1 mês corrido (RGPD Art. 12(3))
- **Origem**: Sub-PRD 01 §3.6, Sub-PRD 06 §3.9
- **Tipo**: Hard constraint
- **Regra**: GIVEN data_request recebido (via UI ou webhook de e-commerce); WHEN cronômetro inicia em `request.received_at`; THEN export estruturado (JSON + PDF) deve ser entregue em ≤1 mês corrido (calendário, não dias úteis — RGPD Art. 12(3) primeira frase), extensível por mais 2 meses em casos complexos/volumosos mediante notificação ao titular dentro do 1º mês.
- **Enforcement**: Worker de privacidade + alarme em D+20 (Sentry/PagerDuty) — ~10 dias de folga antes do vencimento.
- **Exceção**: A extensão de até 2 meses (Art. 12(3), 2ª frase) exige notificação por escrito ao titular explicando o motivo, dentro do prazo original de 1 mês — o próprio pedido de extensão é auditado.

### L-03 — SLA de redact: 1 mês corrido (RGPD Art. 12(3))
- **Origem**: Sub-PRD 01 §3.6, Sub-PRD 06 §3.9
- **Tipo**: Hard constraint
- **Regra**: GIVEN redact aprovado (incluindo cascade pra messages, activities, mídia em Storage); WHEN cronômetro inicia em `redact.approved_at`; THEN cascade completo aplicado em ≤1 mês corrido. O RGPD não distingue prazo de acesso (L-02) de apagamento (L-03) — ambos herdam o mesmo Art. 12(3); os dois IDs continuam separados aqui só porque o produto trata os dois tipos de solicitação como entidades distintas.
- **Enforcement**: Worker de privacidade + alarme em D+20.
- **Exceção**: Mesma da L-02.

### L-04 — Anonimização é irreversível
- **Origem**: Sub-PRD 02 §3.4 (merge), Sub-PRD 01 §3.6
- **Tipo**: Hard constraint
- **Regra**: GIVEN contact com `is_anonymized=true`; WHEN qualquer endpoint tenta atualizar dados pessoais; THEN retorna 403 `privacy_anonymization_irreversible`.
- **Enforcement**: API + DB (check constraint).
- **Exceção**: Nenhuma. Decisão deliberada (RGPD Art. 17 prevê o direito do titular ao apagamento como definitivo).

### L-11 — Notificação de violação de dados em até 72h (RGPD Art. 33)
- **Origem**: RGPD Art. 33 — ainda sem PRD/spec dedicada; registrado aqui para não faltar doutrina antes de qualquer implementação.
- **Tipo**: Hard constraint (processual — hoje não há mecanismo automatizado no código)
- **Regra**: GIVEN uma violação de dados pessoais (vazamento, acesso não autorizado, perda) que representa risco aos titulares; WHEN a organização toma conhecimento; THEN a autoridade de controlo competente deve ser notificada em até 72 horas — prazo fixo, não "razoável" como na LGPD. Se o risco for alto, os titulares afetados também devem ser notificados sem atraso indevido.
- **Enforcement**: Nenhum ainda — hoje é processo manual/humano. Antes de automatizar qualquer parte disso, valide o desenho com um advogado especializado em RGPD.
- **Exceção**: Nenhuma quanto ao prazo; a notificação aos titulares (não à autoridade) pode ser dispensada se a organização demonstrar medidas técnicas que tornam os dados incompreensíveis (ex.: criptografia forte).

### L-05 — Consentimento granular por finalidade
- **Origem**: PRD-Mestre §7.1, Sub-PRD 01 §3.6
- **Tipo**: Hard constraint
- **Regra**: GIVEN qualquer ação de comunicação (envio WhatsApp, email, push); WHEN a comunicação tem propósito categorizado; THEN o sistema verifica `contacts.consent.<categoria>.granted_at` antes de despachar. Categorias: `marketing` / `transactional` / `profiling`.
- **Enforcement**: API (interceptor pré-envio) + UI (botão envio bloqueado se sem consent).
- **Exceção**: Comunicação `transactional` originada pelo próprio cliente (resposta a inbound do cliente) é dispensada de verificação — janela 24h da Meta cobre.

### L-06 — Audit de toda operação em dados sensíveis
- **Origem**: Sub-PRD 01 §3.5, Sub-PRD 06 §3.9
- **Tipo**: Hard constraint
- **Regra**: GIVEN qualquer create/update/delete em `contacts.email`, `contacts.phone_number`, `contacts.cpf`, `contacts.consent`; WHEN a mutação commita; THEN entrada em `api_audit_log` com `who/what/which/when/from/to`.
- **Enforcement**: DB trigger + middleware API.
- **Exceção**: Nenhuma.

### L-07 — CPF criptografado at-rest
- **Origem**: Sub-PRD 02 §3.1 (Risco C7)
- **Tipo**: Hard constraint
- **Regra**: GIVEN contact com CPF; WHEN persistido; THEN coluna usa `pgcrypto` com chave separada `CPF_ENCRYPTION_KEY` (env-only, rotação trimestral).
- **Enforcement**: DB (coluna `cpf_encrypted bytea`; função `decrypt_cpf()` com check de role).
- **Exceção**: Tenants que explicitamente desativam coleta de CPF nas regras de identity resolution (Sub-PRD 02 §3.3) não têm a coluna populada.

### L-08 — Logs nunca contêm CPF, mesmo em debug
- **Origem**: Sub-PRD 02 Risco C7
- **Tipo**: Hard constraint
- **Regra**: GIVEN qualquer log estruturado, Sentry event, request body dump; WHEN o payload contém CPF (regex `\d{3}\.?\d{3}\.?\d{3}-?\d{2}`); THEN o valor é mascarado pra `***.***.***-**` antes do log persistir.
- **Enforcement**: Sentry `beforeSend` + logger middleware + sanitizador de webhook log.
- **Exceção**: Nenhuma.

### L-09 — Token OAuth Nuvemshop criptografado at-rest
- **Origem**: Sub-PRD 06 §3.2
- **Tipo**: Hard constraint
- **Regra**: GIVEN OAuth token de plataforma e-commerce; WHEN persistido em `tenants.<provider>_oauth`; THEN coluna usa `pgcrypto` com chave separada `NUVEMSHOP_OAUTH_ENCRYPTION_KEY`.
- **Enforcement**: DB.
- **Exceção**: Nenhuma.

### L-10 — Audit log é append-only e retém 5 anos
- **Origem**: Sub-PRD 01 §3.5
- **Tipo**: Hard constraint
- **Regra**: GIVEN tabela `api_audit_log`; WHEN qualquer operação UPDATE/DELETE é tentada via API ou ORM; THEN retorna 405. Retenção em hot storage 90 dias; cold storage S3 com lifecycle policy de 5 anos.
- **Enforcement**: DB (sem RLS de UPDATE/DELETE; permission revogada do role da app) + worker de archive.
- **Exceção**: DBA pode deletar manualmente apenas com double-confirmation e audit duplo (raro: erro de coleta de PII que precisa ser purgado).

---

## 3. WhatsApp via WAHA (W)

### W-01 — Throttle 1msg/1.2s + jitter ≤800ms por sessão
- **Origem**: Sub-PRD 03 §3.7 (Anti-banimento)
- **Tipo**: Hard constraint
- **Regra**: GIVEN envio de mensagem outbound; WHEN a sessão WAHA atual já enviou mensagem nos últimos 1.2s; THEN o envio aguarda `(last_send_ts + 1200ms + random(0..800)ms) - now`.
- **Enforcement**: Worker de envio (acquireSendLock).
- **Exceção**: Nenhuma. Vale inclusive pra envio "manual" do atendente.

### W-02 — Detecção STOP automática bloqueia contact
- **Origem**: Sub-PRD 03 §3.7
- **Tipo**: Hard constraint
- **Regra**: GIVEN mensagem inbound text; WHEN body matches regex `/STOP|PARAR|SAIR|UNSUBSCRIBE|CANCELAR/i`; THEN `contacts.is_blocked=true` + emitir activity `system.contact_blocked_by_stop`.
- **Enforcement**: Worker de webhook (após persist da message).
- **Override**: Tenant admin pode desbloquear manualmente; ação auditada.

### W-03 — Contact bloqueado nunca recebe outbound automatizado
- **Origem**: Sub-PRD 03 §3.7
- **Tipo**: Hard constraint
- **Regra**: GIVEN contact com `is_blocked=true`; WHEN qualquer fluxo automatizado (campanha, IA, recovery de carrinho) tenta enviar; THEN o envio é abortado e atividade `system.send_blocked` é registrada.
- **Enforcement**: API send (interceptor) + IA guardrail.
- **Exceção**: Atendente humano pode enviar manualmente (com confirmação dupla na UI) — registra `manual_override_blocked` no audit.

### W-04 — Janela 24h respeitada por automações
- **Origem**: Sub-PRD 03 §3.13
- **Tipo**: Hard constraint
- **Regra**: GIVEN automação tentando enviar mensagem outbound; WHEN tempo desde `last_inbound_at` do contact > 24h; THEN o envio é abortado, alerta é registrado e atendente é notificado.
- **Enforcement**: API send (interceptor).
- **Exceção**: Templates aprovados (Fase 2 — fora do MVP). Atendente humano pode tentar manualmente; risco fica com ele.

### W-05 — Idempotência de webhook inbound via `unique (org, external_id)`
- **Origem**: Sub-PRD 03 §3.3
- **Tipo**: Hard constraint
- **Regra**: GIVEN webhook inbound de WAHA; WHEN insert em `messages` com `external_id` já existente no tenant; THEN captura `code === '23505'` e retorna 200 sem duplicar efeitos colaterais.
- **Enforcement**: DB unique constraint + handler.
- **Exceção**: Nenhuma.

### W-06 — Limite diário em número novo: 200-500 msgs/dia
- **Origem**: Sub-PRD 03 §3.7
- **Tipo**: Default com override
- **Regra**: GIVEN `channel_session` com `created_at` < 30 dias; WHEN tentativa de envio outbound do dia ultrapassa o limite (default 300); THEN próximo envio é abortado com erro `daily_limit_exceeded`.
- **Enforcement**: Worker de envio + counter Redis por sessão.
- **Override**: Tenant admin com aprovação de super-admin pode aumentar limite — ação auditada com justificativa.

### W-07 — Janela horária default 7h-22h, sem domingo
- **Origem**: Sub-PRD 03 §3.7
- **Tipo**: Default com override
- **Regra**: GIVEN automação tentando envio outbound; WHEN hora local do tenant está fora de 7h-22h OU dia é domingo; THEN o envio é enfileirado pra próximo horário válido.
- **Enforcement**: Worker de envio.
- **Override**: Atendente humano envia manualmente sem restrição (a regra é pra automações em massa).

### W-08 — Mídia outbound vai pra Storage, NUNCA inline base64
- **Origem**: Sub-PRD 03 §3.6
- **Tipo**: Hard constraint
- **Regra**: GIVEN envio de mensagem outbound com mídia; WHEN o tamanho da mídia > 1MB; THEN o arquivo é uploaded pro Supabase Storage (bucket `whatsapp-media`) primeiro, e a URL assinada é passada pro WAHA.
- **Enforcement**: API send + WAHA client wrapper.
- **Exceção**: Mídia <1MB pode ir inline (aceitável performance-wise). Mídia >16MB é rejeitada na UI antes de subir.

### W-09 — Mensagens em grupos não criam leads
- **Origem**: Sub-PRD 03 §3.10 (edge cases)
- **Tipo**: Hard constraint
- **Regra**: GIVEN webhook inbound com `chatId.endsWith('@g.us')`; WHEN o handler processaria binding CRM; THEN binding é abortado, mensagem é persistida como `messages.metadata.is_group=true` mas SEM lead criado.
- **Enforcement**: Worker de webhook.
- **Exceção**: Tenant pode opt-in em fase futura pra "atendimento de grupo" (fora do MVP).

### W-10 — Multi-device sync requer `message.any`
- **Origem**: Sub-PRD 03 §3.9
- **Tipo**: Hard constraint
- **Regra**: GIVEN configuração de webhook na sessão WAHA; WHEN definindo `events`; THEN deve incluir `message.any` (não apenas `message`) pra capturar mensagens enviadas por aparelhos vinculados — e tratar `fromMe=true` sem duplicar.
- **Enforcement**: WAHA client wrapper + handler que checa `fromMe + already_persisted`.
- **Exceção**: Nenhuma.

### W-11 — Sessão WAHA com volumes corrompidos é re-criada, não recuperada
- **Origem**: Sub-PRD 03 §3.10 (edge case `STARTING` indefinido)
- **Tipo**: Soft policy
- **Regra**: GIVEN sessão WAHA presa em estado `STARTING` por >5 min; WHEN cron health-check detecta; THEN registra alerta + escala pra super-admin (não tenta auto-recovery — perde sessão silenciosa é pior que pedir reescaneamento).
- **Enforcement**: Cron `sync-sessions` + alerta.
- **Exceção**: Super-admin com runbook pode forçar `docker volume rm` + reescaneamento.

### W-12 — Cron `recover-stuck-messages` marca `sending` >5min como `failed`
- **Origem**: Sub-PRD 03 §3.10
- **Tipo**: Hard constraint
- **Regra**: GIVEN mensagem com `status='sending'`; WHEN `created_at < now() - 5 min`; THEN cron muda pra `status='failed'`, emite event `message.failed` e notifica atendente se modo interativo.
- **Enforcement**: Cron de 1 min — `app/api/v1/cron/recover-stuck-messages/route.ts`, agendado no serviço `scheduler` do `docker-compose.prod.yml`. Implementado em 2026-08-05 (issue #129); antes disso a regra existia só neste catálogo. A notificação é um item `message_send_stuck` na Central de avisos, **um por organização por rodada** (um por mensagem enterraria a Central justo no dia em que ela precisa ser lida). Guardado por `tests/unit/recover-stuck-messages.test.ts`.
- **Exceção**: `status='queued'` não entra. Esse estado tem dono — o agent-engine reagenda o envio por `SEND_QUEUED_RETRY_MS` enquanto a sessão do canal não está WORKING —, e falhá-lo em 5 min perderia mensagem que ia sair. `sending` é que não tem dono nenhum.

---

## 4. Pipeline & Lead (P)

### P-01 — Lead vive em UM pipeline; mover entre pipelines não é suportado
- **Origem**: Sub-PRD 02 §3.2
- **Tipo**: Hard constraint
- **Regra**: GIVEN lead criado; WHEN qualquer endpoint tenta mudar `pipeline_id` da linha; THEN retorna 422 `pipeline_immutable_use_clone`. Pra "mover", clona criando novo lead em pipeline destino e marca origem como `lost` com `lost_reason='moved_to_pipeline_X'`.
- **Enforcement**: API (interceptor) + DB check constraint.
- **Exceção**: Nenhuma. Decisão deliberada (mover entre pipelines é semanticamente diferente — clonar deixa explícito).

### P-02 — Status `won/lost` derivado de stage com flag
- **Origem**: Sub-PRD 02 §3.8
- **Tipo**: Hard constraint
- **Regra**: GIVEN lead movido pra stage com `is_won=true`; WHEN o move commita; THEN trigger `fn_crm_lead_close_on_stage` muda `lead.status='won'` + `closed_at=now()`. Idem pra `is_lost=true → status='lost'`.
- **Enforcement**: DB trigger.
- **Exceção**: Reabertura (mudar pra stage sem flag) volta `status='open'` + `closed_at=null`.

### P-03 — `lost_reason` obrigatório em transição pra `lost`
- **Origem**: Sub-PRD 02 §3.8
- **Tipo**: Hard constraint
- **Regra**: GIVEN lead transicionando pra `status='lost'`; WHEN `lost_reason` é null; THEN trigger reverte a transição e retorna erro 422 `lost_reason_required`.
- **Enforcement**: DB trigger.
- **Exceção**: Nenhuma. Lista canônica de reasons: `requested_by_customer`, `price`, `no_response`, `product_unavailable`, `cancelled_by_store`, `cancelled_by_customer`, `payment_failed`, `other`.

### P-04 — Reabertura é evento auditado
- **Origem**: Sub-PRD 02 §3.8
- **Tipo**: Hard constraint
- **Regra**: GIVEN lead com `status` em (`won`, `lost`); WHEN movido pra stage sem flags `is_won/is_lost`; THEN registra activity `reopened` com `metadata.previous_status` e `metadata.reason`.
- **Enforcement**: DB trigger + worker.
- **Exceção**: Nenhuma.

### P-05 — Reorder de cards usa fractional indexing (numeric)
- **Origem**: Sub-PRD 02 §3.2
- **Tipo**: Hard constraint
- **Regra**: GIVEN drag-drop de card no Kanban; WHEN card é solto entre `prev` e `next`; THEN `position_in_stage = midpoint(prev.position, next.position)`. Se não há `prev`, `position = next.position - 1`. Se não há `next`, `position = prev.position + 1`.
- **Enforcement**: API (`POST /leads/:id/move`) + UI lib `@hello-pangea/dnd`.
- **Exceção**: Reposicionamento global ("compactar posições") permitido pra `manager+` quando precisão decimal degradar (ex: 30+ niveis de subdivisão).

### P-06 — Pipeline duplicação é deep clone com vocabulary preservada
- **Origem**: Sub-PRD 04 §3.2
- **Tipo**: Default
- **Regra**: GIVEN pipeline existente; WHEN admin clica "duplicar"; THEN cria novo pipeline com mesmas stages (em ordem), mesma `vocabulary`, mesmos `custom_fields` schema. Leads NÃO são clonados.
- **Enforcement**: API.
- **Exceção**: Nenhuma.

### P-07 — Vocabulary do pipeline rege rótulos da UI, não dados
- **Origem**: Sub-PRD 02 §3.7
- **Tipo**: Hard constraint
- **Regra**: GIVEN UI exibindo dados de lead/deal/stage; WHEN componente renderiza rótulo; THEN usa `vocabulary[lead]`, `vocabulary[deal]`, etc., NUNCA strings hardcoded em PT.
- **Enforcement**: Hook `usePipelineVocabulary` + linter custom em PR.
- **Exceção**: Strings de erro técnico (mensagem 422) podem ser hardcoded — não são dirigidas ao cliente final.

### P-08 — Lead duplicado vinculado ao mesmo contact é permitido
- **Origem**: Sub-PRD 02 §3.2
- **Tipo**: Soft policy
- **Regra**: GIVEN mesmo contact tem pedidos múltiplos; WHEN cada pedido cria 1 lead em "Pedidos"; THEN N leads são permitidos, distinguidos por `source_metadata.order_id`. Mas dois leads na MESMA stage com MESMO `source_metadata.order_id` devem ser detectados e mesclados.
- **Enforcement**: Worker de Nuvemshop sync (idempotência).
- **Exceção**: Nenhuma.

---

## 5. Atendimento & Roteamento (AT)

### AT-01 — Conversation status segue máquina de estado fechada
- **Origem**: Sub-PRD 04 §3.4
- **Tipo**: Hard constraint
- **Regra**: Estados permitidos: `open` → `pending` → `resolved` (transitions auditadas). `resolved → open` permitido (reabertura). `pending → open` permitido (cliente respondeu). Outras transições retornam 422.
- **Enforcement**: API + DB check constraint.
- **Exceção**: Nenhuma.

### AT-02 — "Eu cuido" é claim atômico
- **Origem**: Sub-PRD 04 §3.8
- **Tipo**: Hard constraint
- **Regra**: GIVEN conversation sem `assigned_to_user_id`; WHEN atendente clica "eu cuido"; THEN UPDATE atomicamente `assigned_to=ME` apenas se `assigned_to IS NULL`. Caso já tenha sido claim'ed (race), retorna 409 `already_assigned` com `details.assigned_to=<user>`.
- **Enforcement**: DB (`UPDATE ... WHERE assigned_to IS NULL`).
- **Exceção**: Manager pode reassign forçado, mesmo já assigned, com audit.

### AT-03 — Round-robin distribui entre atendentes online
- **Origem**: Sub-PRD 04 §3.9
- **Tipo**: Default com override
- **Regra**: GIVEN conversation nova sem `assigned_to`; WHEN tenant tem auto-assignment ativado; THEN ronda os atendentes com `status='online'` em ordem (last_assigned_at ASC) e atribui ao próximo.
- **Enforcement**: Worker de auto-assignment.
- **Exceção**: Tenant pode desativar auto-assignment globalmente. Atendente "busy" não recebe (mesmo se for sua vez); pula.

### AT-04 — Supervisor lê conversas em tempo real, mas não modifica
- **Origem**: Sub-PRD 04 §3.8
- **Tipo**: Hard constraint
- **Regra**: GIVEN role `manager+` ou super-admin; WHEN abre conversation que NÃO é `assigned_to=ME`; THEN UI entra em modo somente-leitura (composer desabilitado, botões "resolver"/"eu cuido" disponíveis); abertura é audita como `conversation.observed_by_supervisor`.
- **Enforcement**: UI + API (interceptor que bloqueia `POST /messages` se `assigned_to != caller`).
- **Exceção**: Manager+ pode forçar reassign pra si com audit.

### AT-05 — Notas internas nunca vão pro WhatsApp
- **Origem**: Sub-PRD 04 §3.8
- **Tipo**: Hard constraint
- **Regra**: GIVEN atendente cria activity tipo `note`; WHEN o evento entra no `event_log`; THEN nenhum worker outbound consome. Notas são exclusivamente internas.
- **Enforcement**: Worker outbound checa `activity.type` e ignora `note`.
- **Exceção**: Nenhuma.

### AT-06 — Bulk action limitado a 50 cards por request
- **Origem**: Sub-PRD 04 §3.12
- **Tipo**: Hard constraint
- **Regra**: GIVEN atendente seleciona N cards no Kanban; WHEN N > 50 e tenta executar bulk; THEN retorna 422 `bulk_too_large`. UI mostra erro com sugestão "selecione até 50 ou use filtro + script".
- **Enforcement**: API + UI.
- **Exceção**: Nenhuma no MVP.

### AT-07 — Mensagem >4096 chars é chunkada automaticamente
- **Origem**: Sub-PRD 03 §3.10 (edge case)
- **Tipo**: Hard constraint
- **Regra**: GIVEN composer recebe texto com `length > 4096`; WHEN atendente clica send; THEN o texto é particionado em chunks ≤4000 chars (preferindo `\n\n` > ` ` > tamanho fixo). Cada chunk é uma `message` separada com mesmo `conversation_id` e `metadata.chunk_of=<original_uuid>`.
- **Enforcement**: API send (worker pré-despacho).
- **Exceção**: Nenhuma.

### AT-08 — Status atendente: idle por inatividade vira offline em 15 min
- **Origem**: Sub-PRD 04 §3.8
- **Tipo**: Default com override
- **Regra**: GIVEN atendente com status `online`; WHEN sem atividade UI por 15 min; THEN status muda automaticamente pra `offline`.
- **Enforcement**: Worker (heartbeat de UI a cada 60s).
- **Exceção**: Atendente pode pinar status `online` permanentemente em sessão (com warning UX).

---

## 6. IA & Bot (IA)

### IA-01 — Bot respeita janela 24h da Meta
- **Origem**: Sub-PRD 05 §3.10 (guardrails)
- **Tipo**: Hard constraint (LLM-guardrail)
- **Regra**: GIVEN bot tentando enviar outbound; WHEN tempo desde `last_inbound_at` > 24h; THEN o envio é abortado, activity `system.window_24h_expired` é registrada e atendente é notificado.
- **Enforcement**: API send + IA guardrail pré-despacho.
- **Exceção**: Nenhuma. Templates aprovados (Fase 2) eventualmente.

### IA-02 — Bot respeita `is_blocked=true` do contact
- **Origem**: Sub-PRD 05 §3.10
- **Tipo**: Hard constraint
- **Regra**: GIVEN contact com `is_blocked=true`; WHEN bot recebe sinal de inbound (que veio antes do bloqueio) ou tenta proativo; THEN nunca responde. Conversation continua aberta pra atendente humano.
- **Enforcement**: IA guardrail.
- **Exceção**: Nenhuma.

### IA-03 — Top-K do RAG default 5, configurável por tenant
- **Origem**: Sub-PRD 05 §3.5
- **Tipo**: Default com override
- **Regra**: GIVEN bot construindo contexto pra responder; WHEN consulta vector store; THEN retorna top-5 chunks mais similares (configurável `ai_agents.config.rag_top_k` entre 1-20).
- **Enforcement**: Worker de IA (constructor de prompt).
- **Exceção**: Nenhuma.

### IA-04 — Sentiment threshold default 0.3, configurável
- **Origem**: Sub-PRD 05 §3.6
- **Tipo**: Default com override
- **Regra**: GIVEN análise de sentiment retorna score; WHEN `score < tenant.sentiment_threshold` (default 0.3); THEN gatilho de handoff é acionado.
- **Enforcement**: Worker de sentiment.
- **Exceção**: Tenant pode desativar handoff por sentiment (manter só os outros 3 gatilhos).

### IA-05 — 4 gatilhos de handoff são redundantes (OR-lógico)
- **Origem**: Sub-PRD 05 §3.7
- **Tipo**: Hard constraint
- **Regra**: GIVEN bot processando inbound; WHEN qualquer um dos 4 gatilhos dispara (G1=pedido explícito, G2=sentiment baixo, G3=incerteza IA, G4=estágio crítico); THEN handoff é triggered. Gatilhos não se anulam.
- **Enforcement**: Worker IA.
- **Exceção**: Tenant pode desativar G2 (sentiment) ou G4 (estágio) individualmente; G1 e G3 são always-on.

### IA-06 — Bot não reassume após handoff (default)
- **Origem**: Sub-PRD 05 §3.8
- **Tipo**: Default com override
- **Regra**: GIVEN handoff foi triggered numa conversation; WHEN cliente continua respondendo; THEN bot NÃO reassume. Humano fica responsável até `conversation.status='resolved'`.
- **Enforcement**: Worker IA (verifica `last_handoff_at` antes de processar).
- **Override**: Atendente clica botão "passar pra IA" → audit + bot reassume.

### IA-07 — Bot nunca promete ressarcimento sem confirmação humana
- **Origem**: Sub-PRD 05 §3.10
- **Tipo**: Hard constraint (LLM-guardrail)
- **Regra**: GIVEN resposta do bot; WHEN contém palavras-chave de comprometimento financeiro (regex `/(reembols|estorn|devolv|ressarc|crédit)/i`); THEN bot escala pra humano em vez de enviar.
- **Enforcement**: Pós-processamento da resposta do LLM.
- **Exceção**: Nenhuma.

### IA-08 — Bot só fala de produtos no catálogo Nuvemshop sincronizado
- **Origem**: Sub-PRD 05 §3.10
- **Tipo**: Hard constraint (LLM-guardrail)
- **Regra**: GIVEN cliente pergunta sobre produto X; WHEN RAG não retorna match no catálogo; THEN bot responde "vou verificar com nossa equipe" e escala (gatilho G3).
- **Enforcement**: Pós-processamento da resposta + verificação de RAG hits.
- **Exceção**: Nenhuma.

### IA-09 — Menção de fraude/jurídico escala imediato
- **Origem**: Sub-PRD 05 §3.10
- **Tipo**: Hard constraint (LLM-guardrail)
- **Regra**: GIVEN inbound matches regex `/(fraude|estelionato|polícia|justiça|processo|advogad|ANPD|procon|jurídic)/i`; WHEN o handler processa; THEN handoff imediato (gatilho G4) sem o bot tentar responder.
- **Enforcement**: Worker IA (pré-processamento do inbound).
- **Exceção**: Nenhuma.

### IA-10 — Orçamento de IA do tenant: alarme em 80%, throttle em 100%
- **Origem**: Sub-PRD 05 §3.11
- **Tipo**: Default com override
- **Regra**: GIVEN tenant com `ai_budget_cents` configurado; WHEN consumo do mês atinge 80%; THEN alarme + email pro admin. Em 100%; THEN bot é throttled (default: pausa); 4 gatilhos de handoff continuam funcionando (cliente sempre tem humano).
- **Enforcement**: Worker IA + cron de billing.
- **Override**: Tenant pode escolher comportamento em 100%: pausar bot vs continuar (paga overage). Default: pausar.

### IA-11 — Embeddings de catálogo Nuvemshop são re-indexados em mudança
- **Origem**: Sub-PRD 05 §3.5
- **Tipo**: Hard constraint
- **Regra**: GIVEN evento `nuvemshop.product_updated` no event_log; WHEN worker RAG consome; THEN o produto correspondente tem embedding re-gerado e index atualizado em ≤30s p95.
- **Enforcement**: Worker RAG (pull-loop) + Sentry alerta se lag >5min.
- **Exceção**: Nenhuma.

### IA-12 — Bot nunca oferece desconto por conta própria nem comenta/compara concorrente
- **Origem**: `docs/pesquisa/playbook-comportamento-atendimento-2026-09-03.md` §1.5/§2 (lacuna nº2); decisão do dono do produto, 2026-09-03.
- **Tipo**: Hard constraint (LLM-guardrail)
- **Regra**: GIVEN resposta candidata do bot; WHEN o texto concede desconto/exceção de preço não presente na tabela de preços/promessas versionada da org (F4-01, `promiseGate`), OU menciona/compara nomeadamente um concorrente; THEN a resposta é vetada antes de alcançar o canal — desconto é decisão humana (equipe comercial), e o bot fala da própria empresa, nunca ataca ou compara concorrente nomeado.
- **Enforcement**: LLM-guardrail — consolida sob um rótulo único o que hoje já é coberto em parte por IA-07 (comprometimento financeiro) e pelo `promiseGate`/F4-01 (`lib/agent-engine/guardrails/before-send.ts`) para desconto; a parte de concorrente é lacuna nova, sem gate dedicado ainda — a implementar.
- **Exceção**: Nenhuma. Concessão de desconto é sempre escalada para humano (IA-05, gatilho G1/G3), nunca decidida pelo bot.

### IA-13 — Bot admite ser um assistente de IA quando perguntado diretamente
- **Origem**: `docs/pesquisa/playbook-comportamento-atendimento-2026-09-03.md` §1.4/§2 (lacuna nº3); decisão do dono do produto, 2026-09-03.
- **Tipo**: Hard constraint
- **Regra**: GIVEN cliente pergunta diretamente se está falando com um robô/IA/assistente automático; WHEN o bot responde; THEN ele ADMITE que é um assistente de IA (nunca nega, nunca desvia) e continua ajudando na mesma mensagem — a pergunta não é, por si só, gatilho de handoff (não soma aos 4 gatilhos de IA-05).
- **Enforcement**: LLM-guardrail (prompt/instrução do Conversador, Spec 16). Consistente com o gate de `disclosure` (F4-05, `disclosureGate`) que já garante a apresentação como assistente virtual na 1ª mensagem — esta regra cobre a pergunta direta a qualquer momento da conversa, não só o 1º outbound.
- **Exceção**: Nenhuma.

### IA-14 — Handoff sem humano disponível sempre confirma recebimento + prazo real
- **Origem**: `docs/pesquisa/playbook-comportamento-atendimento-2026-09-03.md` §1.1/§2 (lacuna nº4); decisão do dono do produto, 2026-09-03.
- **Tipo**: Hard constraint
- **Regra**: GIVEN handoff triggado (qualquer um dos 4 gatilhos de IA-05) E nenhum atendente disponível no momento (fila cheia, ninguém `online`, ver AT-03); WHEN o bot encerra o turno para o cliente; THEN a última mensagem ao cliente confirma que o pedido foi recebido E informa um prazo real de retorno (não um "já já"/"em breve" vago) — nunca silencia a conversa sem essa confirmação.
- **Enforcement**: Worker de handoff (`lib/ai/handoff/orchestrator.ts`) — o prazo real vem de configuração/SLA de atendimento do tenant, nunca de estimativa inventada pelo bot (mesma doutrina de IA-08: nunca promete o que não pode confirmar).
- **Exceção**: Nenhuma.

### IA-15 — Tom/registro do agente é configurável por tenant; guardrails de conteúdo são permanentes
- **Origem**: decisão do dono do produto, 2026-09-03 (proposta de design em `docs/specs/19-spec-tenant-voice-customization.md`).
- **Tipo**: Default com override (tom) + Hard constraint (guardrails)
- **Regra**: GIVEN uma organização configura o tom/registro do próprio agente de atendimento (ex.: mais informal, gírias regionais, mais caloroso) via `voice_profile` da versão do agente; WHEN o agente responde em qualquer canal (WhatsApp ou voz); THEN a redação segue o tom configurado pelo tenant, MAS os guardrails de negócio da lista IA-07 a IA-14 e VOZ-01 a VOZ-04 continuam se aplicando de forma idêntica, independentemente do tom escolhido — nenhuma configuração de tom pode afrouxar, contornar ou desligar um guardrail dessa lista.
- **Enforcement**: Arquitetural — tom é composto no `system_prompt` (camada 1, o que o modelo tenta gerar); guardrails permanecem em `BEFORE_SEND_GATES` (`lib/agent-engine/guardrails/before-send.ts`), camada de pós-processamento que nunca lê `voice_profile`. As duas camadas são mecanismos fisicamente separados, então tom não tem como competir com guardrail pelo mesmo caminho de decisão.
- **Exceção**: Nenhuma. Profissionalismo (`register: "professional"`) continua existindo como uma das opções de tom — o default — mas deixa de ser a única.

---

## 7. Billing & Uso (B)

### B-01 — Métricas de uso por tenant são coletadas no MVP (mesmo sem cobrança)
- **Origem**: PRD-Mestre §1 (billing-ready), memória `project_tenancy_model`
- **Tipo**: Hard constraint
- **Regra**: GIVEN qualquer ação que consome recurso (mensagem enviada/recebida, chamada LLM, storage usage); WHEN ocorre; THEN entrada em `usage_events` com `tenant_id`, `metric_type`, `quantity`, `cost_cents` (calculado), `recorded_at`.
- **Enforcement**: Workers de cada subsistema (WhatsApp send/recv, IA invocation, storage upload).
- **Exceção**: Nenhuma.

### B-02 — Custo de IA é rateado por tenant
- **Origem**: Sub-PRD 05 §3.9 + IA-10
- **Tipo**: Hard constraint
- **Regra**: GIVEN invocação LLM via Vercel AI Gateway; WHEN o evento de billing chega do Gateway; THEN o custo é atribuído ao `tenant_id` do agent que originou a chamada.
- **Enforcement**: Worker de billing IA.
- **Exceção**: Custos administrativos da plataforma (super-admin testando, suporte) são debitados ao tenant `internal_deskcomm`.

### B-03 — Storage de mídia tem retenção configurável por tenant
- **Origem**: PRD-Mestre §7.3
- **Tipo**: Default com override
- **Regra**: GIVEN mídia em `whatsapp-media` bucket; WHEN `created_at < now() - tenant.media_retention_days` (default 365); THEN cron `prune-old-media` move pra cold storage S3 (ou deleta se `tenant.cold_storage_disabled=true`).
- **Enforcement**: Cron diário.
- **Override**: Tenant pode aumentar retenção (paga storage extra) ou diminuir (mín 90d em modo BPO; sem mín em modo SaaS futuro).

### B-04 — Quota de chamadas API por tenant: 100 RPS no MVP
- **Origem**: Sub-PRD 01 §4.2
- **Tipo**: Default com override
- **Regra**: GIVEN tenant fazendo chamadas via API; WHEN ultrapassa 100 RPS; THEN próxima chamada retorna 429 com `Retry-After` e `X-RateLimit-*` headers.
- **Enforcement**: Upstash Redis sliding window.
- **Override**: Cliente enterprise pode contratar plano com RPS maior; ajuste em `tenants.rate_limit_config`.

### B-05 — Sync inicial Nuvemshop respeita rate limit do upstream
- **Origem**: Sub-PRD 06 §3.11
- **Tipo**: Hard constraint
- **Regra**: GIVEN sync inicial em execução; WHEN response da Nuvemshop API retorna `X-Rate-Limit-Remaining: 0`; THEN worker pausa por `Retry-After` (ou 60s default) antes de continuar.
- **Enforcement**: Worker de sync.
- **Exceção**: Nenhuma.

---

---

## 8. Canal de Voz (VOZ)

> Regras novas — canal de voz ainda não tem sub-PRD/spec própria completa; origem é a pesquisa
> de mercado cruzada com decisão explícita do dono do produto em 2026-09-03
> (`docs/pesquisa/playbook-comportamento-atendimento-2026-09-03.md`). Enforcement técnico
> (gate `before_send` específico de voz) está desenhado em `docs/specs/18-spec-humanizer-gate.md`
> mas ainda não implementado — estas regras documentam o comportamento esperado antes do código.

### VOZ-01 — Resposta falada tem no máximo 1-2 frases, sem parágrafo longo
- **Origem**: `docs/pesquisa/playbook-comportamento-atendimento-2026-09-03.md` §1.6/§2 (lacuna nº1); decisão do dono do produto, 2026-09-03.
- **Tipo**: Hard constraint
- **Regra**: GIVEN o bot responde numa ligação de voz; WHEN a resposta candidata é gerada; THEN o texto tem no máximo 1-2 frases curtas — uma resposta de parágrafo longo faz o cliente achar que a ligação travou ou desligar antes do fim.
- **Enforcement**: LLM-guardrail — gate `before_send` específico de voz (a implementar; ver `docs/specs/18-spec-humanizer-gate.md`), separado do gate de humanização de texto/WhatsApp por causa da restrição de latência/formato da voz.
- **Exceção**: Nenhuma.

### VOZ-02 — Números, datas e valores são sempre falados por extenso
- **Origem**: `docs/pesquisa/playbook-comportamento-atendimento-2026-09-03.md` §1.6/§2 (lacuna nº1); decisão do dono do produto, 2026-09-03.
- **Tipo**: Hard constraint
- **Regra**: GIVEN o bot menciona um número, data ou valor monetário numa ligação de voz; WHEN a resposta é gerada; THEN o valor sai por extenso (ex.: "cinquenta euros", nunca "50€"/"R$50") — o TTS lê símbolo/dígito em voz alta de um jeito que soa artificial e pode confundir quem ouve.
- **Enforcement**: LLM-guardrail — mesmo gate de voz da VOZ-01.
- **Exceção**: Nenhuma.

### VOZ-03 — Toda resposta falada sinaliza explicitamente fim de turno
- **Origem**: `docs/pesquisa/playbook-comportamento-atendimento-2026-09-03.md` §1.6/§2 (lacuna nº1); decisão do dono do produto, 2026-09-03.
- **Tipo**: Hard constraint
- **Regra**: GIVEN o bot termina de falar numa ligação de voz; WHEN a resposta não é seguida de uma pergunta direta ou outro sinal claro de que terminou; THEN o cliente fica em silêncio sem saber se é a vez dele de falar — a resposta deve sempre deixar claro que o turno passou (geralmente com uma pergunta direta ao final).
- **Enforcement**: LLM-guardrail — mesmo gate de voz da VOZ-01.
- **Exceção**: Nenhuma.

### VOZ-04 — IA para de falar quando o cliente interrompe (barge-in)
- **Origem**: `docs/pesquisa/playbook-comportamento-atendimento-2026-09-03.md` §1.6/§2 (lacuna nº1); decisão do dono do produto, 2026-09-03.
- **Tipo**: Hard constraint
- **Regra**: GIVEN a IA está falando numa ligação de voz; WHEN o cliente começa a falar por cima (barge-in); THEN a IA para de falar imediatamente e responde ao que o cliente acabou de dizer — nunca "termina o pensamento anterior" antes de reagir à interrupção.
- **Enforcement**: Runtime de voz (detecção de fala do interlocutor + corte de TTS em andamento) — camada de transporte de áudio, fora do escopo do gate `before_send` textual; a implementar junto da infra de voz.
- **Exceção**: Nenhuma.

---

## Anexo A — Mapa de regras por sub-PRD origem

| Sub-PRD | Regras associadas |
|---|---|
| `00-prd-master` | (visão geral; sem regras diretas) |
| `01-prd-platform-base` | T-01, T-02, T-03, T-04, T-05, T-06, T-08; L-06, L-10; B-04 |
| `02-prd-customer-360` | P-01, P-02, P-03, P-04, P-05, P-08; L-04, L-07, L-08 |
| `03-prd-whatsapp-waha` | T-07; W-01 a W-12; AT-07 |
| `04-prd-pipeline-attendance` | P-06, P-07; AT-01 a AT-08 |
| `05-prd-ai-rag-handoff` | IA-01 a IA-14; B-02 |
| `06-prd-nuvemshop-lgpd` | L-01, L-02, L-03, L-05, L-09; B-05 |
| *(sem sub-PRD dedicada ainda)* | VOZ-01 a VOZ-04 — origem: `docs/pesquisa/playbook-comportamento-atendimento-2026-09-03.md`; IA-15 — origem: `docs/specs/19-spec-tenant-voice-customization.md` |

## Anexo B — Mapa de enforcement layer

| Layer | Regras |
|---|---|
| **DB** (RLS, trigger, check constraint) | T-01, T-04, T-06, T-07, T-08; L-04, L-06, L-07, L-09, L-10; W-05; P-01, P-02, P-03, P-04, P-05; AT-01, AT-02 |
| **API** (middleware, interceptor) | T-02, T-03, T-05; L-05, L-08; W-04, W-08; P-06, P-07, P-08; AT-04, AT-06; B-04 |
| **UI** (frontend) | P-07; AT-04, AT-06 |
| **Worker** (cron, queue consumer, event_log) | W-01, W-02, W-03, W-06, W-07, W-09, W-10, W-12; AT-03, AT-05, AT-07, AT-08; IA-03, IA-04, IA-05, IA-06, IA-10, IA-11, IA-14; B-01, B-02, B-03, B-05 |
| **LLM-guardrail** (pós-processamento de resposta IA) | IA-01, IA-02, IA-07, IA-08, IA-09, IA-12, IA-13; VOZ-01, VOZ-02, VOZ-03 |
| **Cron** | W-11, W-12; B-03 |
| *(runtime de voz, fora do gate textual — a implementar)* | VOZ-04 |

## Anexo C — Regras com override permitido

| ID | Quem pode override | Audit obrigatório |
|---|---|---|
| W-02 | Tenant admin | Sim |
| W-03 | Atendente humano (manual com confirmação dupla) | Sim |
| W-06 | Tenant admin + super-admin (aprovação dupla) | Sim |
| W-07 | Atendente humano (manual) | Não (regra é pra automação) |
| AT-03 | Tenant admin (desativar global) | Sim |
| AT-04 | Manager+ (forçar reassign) | Sim |
| AT-08 | Atendente (pin online em sessão) | Não |
| IA-04 | Tenant admin | Sim |
| IA-05 | Tenant admin (desativar G2/G4) | Sim |
| IA-06 | Atendente humano (passar pra IA) | Sim |
| IA-10 | Tenant admin (continuar em throttle) | Sim |
| B-03 | Tenant (config de retenção) | Não |
| B-04 | Plano contratual | Sim |
| L-01 | Admin + super-admin (delete forçado) | Sim |
| P-05 | Manager+ (reposicionamento global) | Sim |

## Anexo D — Estatísticas

- **Total de regras**: 67
- **Por domínio**: Tenancy (8) · LGPD (10) · WhatsApp (12) · Pipeline (8) · Atendimento (8) · IA (14) · Billing (5) · Voz (4)
- **Por tipo**: Hard constraint (45) · Default com override (15) · Soft policy (7)
- **Com override permitido**: 15
