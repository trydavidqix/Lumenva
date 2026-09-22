# Lumenva — Plano detalhado F1–F8 para Google Cloud

Status: plano de leitura. Nenhuma fase deste documento foi executada.

## Regras de execução

- Preservar worktree, branches e dados existentes.
- Exigir testes antes de cada mudança de comportamento.
- Manter rollback possível até cada cutover ser validado.
- Não usar email, body `organization_id`, claims editáveis ou estado de frontend como autoridade.
- Nenhuma fase toca produção sem aprovação explícita do CEO e Owner.
- F1–F7 exigem revisão de segurança e evidência independente.

## Dependências globais

```text
F0 ambiente
  F1 identidade
    F2 tenant isolation
      F3 RBAC
        F4 MFA
        F5 storage/realtime
        F6 banco por domínio
          F7 adapters e serviços externos
            F8 cutover operacional
```

F5 pode começar em paralelo após F2 aprovar o contrato tenant. F7 pode ser desenhado em paralelo, mas cutover de Upstash depende de F2 e F6. F8 seguro pode começar antes, desde que não injete secrets nem altere produção.

---

## F1 — Identity mapping

Detalhamento completo já está em `docs/architecture/F1-IDENTITY-TENANT-DESIGN.md`.

Resumo: Firebase UID permanece `text` canônico externo; `user_organizations.user_id` continua UUID interno durante transição; tabela de mapping mantém relação imutável e reversível; backfill é idempotente; unmatched users não recebem acesso.

- Esforço: 2–4 dias de desenho, fixtures, backfill dry-run e revisão.
- Dependências: F0.
- Aceite: zero duplicidades, mapping completo ou explicitamente pendente, relatório de colisões, dual-read testado, rollback ensaiado.
- Aprovação: Owner aprova tabela, matching, backfill, duração dual-read e fim da compatibilidade Supabase.

---

## F2 — Tenant isolation e RLS no Cloud SQL

### Ordem de implementação

1. Inventariar toda tabela com `organization_id`, relações indiretas e queries sem filtro.
2. Definir `TenantContext` obrigatório: `userId`, `organizationId`, role, platform-admin status, request ID e auth source.
3. Criar resolução única: Firebase session, mapping F1, membership ativo e organização selecionada apenas se pertence ao usuário.
4. Alterar repositories para receber contexto validado ou falhar antes de SQL.
5. Adicionar query helpers que exigem organization scope para `select`, `insert`, `update` e `delete`.
6. Criar role `app_runtime` sem `BYPASSRLS`.
7. Criar políticas PostgreSQL nativas usando transaction-local settings:

```sql
SET LOCAL app.user_id = '...';
SET LOCAL app.organization_id = '...';
SET LOCAL app.role = '...';
```

8. Aplicar `USING` e `WITH CHECK` conforme operação.
9. Separar runtime, worker, migration e manutenção.
10. Remover qualquer confiança em `organization_id` vindo do request.

### Camadas e arquivos previstos

- `apps/crm/lib/auth/server.ts`: identidade e membership.
- `apps/crm/lib/auth/require-role.ts`: autorização.
- `apps/crm/proxy.ts`: presença de sessão, não decisão final de tenant.
- `apps/crm/lib/tenant/`: contexto e resolução única.
- `apps/crm/lib/database/`: pool, transaction context e query helpers.
- `apps/crm/lib/**/repository.ts`: repositories tenant-aware.
- `apps/crm/app/api/**`: remover filtros derivados de input não confiável.
- `apps/crm/workers/**`: validar tenant no job antes de executar.
- `packages/social-brain/db/src/**`: schemas e repositories compartilhados.
- `supabase/baseline.sql` ou migrations Cloud SQL: somente após aprovação de schema.

### Teste de isolamento obrigatório

Criar dois usuários e dois tenants:

- usuário A pertence à organização A;
- usuário B pertence à organização B;
- cada organização possui fixtures iguais e IDs diferentes.

Testar, por API e repository:

1. A lê apenas A.
2. A não lê B por ID, lista, busca, paginação ou agregação.
3. A não insere em B forçando `organization_id` no body.
4. A não move registro A para B via update.
5. A não apaga B.
6. Worker com tenant A não acessa B.
7. contexto ausente falha antes da query.
8. pool reutilizado não vaza `SET LOCAL` entre transações.
9. platform admin usa caminho explícito e auditado.
10. filtros app-level e RLS dão o mesmo resultado.

### Aceite

- suíte cross-tenant verde em dois caminhos independentes;
- nenhuma query tenant-aware sem escopo detectada por lint/review;
- role runtime sem bypass;
- logs não contêm PII ou secrets;
- rollback para caminho anterior validado.

- Esforço: 5–10 dias.
- Dependências: F1.
- Aprovação: CEO/Owner e revisão de segurança antes de qualquer migration ou backfill.

---

## F3 — RBAC e platform admins

### Modelo

| Role | Permissões base |
|---|---|
| `viewer` | leitura tenant-scoped, sem mutações operacionais |
| `agent` | atendimento e ações atribuídas, sem gestão estrutural |
| `manager` | gestão operacional, atribuição e supervisão do tenant |
| `admin` | configuração do tenant, membros, integrações e ações administrativas |

`platform_admins` permanece separado. Ser platform admin não cria membership nem transforma usuário em admin de organização.

### Implementação

1. Catalogar ações atuais por route, Server Action, worker, MCP e CLI.
2. Criar matriz central `role + action + resource`.
3. Fazer autorização após resolver tenant e antes de carregar dados sensíveis.
4. Aplicar mesma facade em API, workers, webhooks internos, MCP e CLI.
5. Manter entitlements separados de role.
6. Auditar mutações, impersonation, suspensão, export e acesso platform-wide.
7. Testar privilege escalation e resource ownership.

### Arquivos previstos

- `apps/crm/lib/auth/require-role.ts`;
- `apps/crm/lib/auth/requirePlatformAdmin.ts`;
- `apps/crm/lib/entitlements/`;
- `apps/crm/app/api/v1/admin/**`;
- `apps/crm/app/actions/**`;
- `apps/crm/lib/mcp/**`;
- `apps/crm/workers/**`.

- Esforço: 3–6 dias.
- Dependências: F1 e F2.
- Aceite: matriz completa, testes de cada role, negative tests, platform admin separado e auditoria verificada.
- Aprovação: CEO/Owner aprova matriz de ações e regras de platform admin.

---

## F4 — Firebase MFA/TOTP

### Passo a passo

1. Inventariar MFA, recovery codes e step-up atuais.
2. Confirmar suporte e limites do Firebase Auth/Identity Platform para MFA TOTP no projeto.
3. Definir enrollment obrigatório por população: platform admins, admins e depois demais roles.
4. Implementar enrollment com sessão recente e confirmação do segundo fator.
5. Implementar challenge no login e step-up para ações sensíveis.
6. Definir recovery: códigos de uso único, hash em armazenamento protegido, consumo atômico, revogação e rotação.
7. Revalidar sessão após enrollment, recovery, troca de password e mudança de role.
8. Revogar sessões após evento de segurança.
9. Testar perda de dispositivo, códigos usados, replay, expiração e downgrade de sessão.
10. Executar rollout por feature flag e manter fallback até aceite.

### Aceite

- admin não acessa superfície protegida sem segundo fator;
- recovery é single-use e auditado;
- sessão antiga não ultrapassa step-up;
- e2e cobre enrollment, login, recovery e revogação;
- rollback não deixa contas bloqueadas.

- Esforço: 4–8 dias.
- Dependências: F1–F3.
- Aprovação: Owner aprova fornecedor, política de recovery, rollout e fallback.

---

## F5 — Storage e Realtime

### Storage: GCS privado

1. Criar bucket privado por ambiente, uniform bucket-level access e retention definida.
2. Usar prefixo obrigatório `organization_id/...`.
3. Proibir `publicUrl()` para dados privados; retornar signed URL de curta duração.
4. Validar tenant antes de gerar URL.
5. Registrar checksum, MIME, tamanho, owner, origem e timestamp.
6. Implementar dual-write apenas para novos objetos idempotentes.
7. Backfill por lote, checksum e relatório de divergências.
8. Shadow-read GCS com fallback controlado ao storage anterior.
9. Cutover por bucket/domínio.
10. Remover fallback apenas após janela de observação e backup.

### Realtime

Escolher entre:

- WebSocket em Cloud Run com Pub/Sub para fan-out; ou
- SSE para leitura unilateral, Pub/Sub como barramento e polling para reconciliação.

Contrato obrigatório:

- evento contém `event_id`, `organization_id`, aggregate, version, occurred_at e payload mínimo;
- cliente autentica antes de assinar;
- servidor deriva tenant da sessão, nunca do canal pedido;
- ordering por aggregate version, não por relógio do cliente;
- reconnect envia cursor/event ID;
- eventos duplicados são ignorados por `event_id`;
- gap dispara resync por API tenant-scoped;
- autorização é revalidada em reconnect;
- Pub/Sub não é fonte final de verdade: Postgres continua autoridade.

- Esforço: storage 4–8 dias; realtime 7–12 dias.
- Dependências: F2; realtime depende também de contrato de eventos.
- Aceite: testes de URL cross-tenant, backfill checksum, reconnect, ordering, duplicate, gap, revocation e carga.
- Aprovação: CEO/Owner aprova bucket, retenção, custos, protocolo realtime e janela de dual-write.

---

## F6 — Banco domínio-a-domínio com Drizzle

### Ordem recomendada

1. **Tabelas sociais/content já parcialmente convertidas**: schemas e repositories existentes reduzem risco.
2. **Workspaces, social accounts, content items, variants, media, approvals e publish jobs**: domínio isolado e contratos claros.
3. **Audit/event log/job queue**: base para dual-write, receipts e workers.
4. **CRM catálogo e configurações não sensíveis**: pipelines, tags, templates e configurações.
5. **Conversations/messages/channel sessions**: alto volume, realtime e PII; migrar após F2/F5.
6. **Contacts/leads/customer 360**: PII, merges, RGPD e relações profundas; migrar depois de isolamento comprovado.
7. **AI agents/RAG/memory/credentials**: dependem de autorização, criptografia e jobs.
8. **Billing/entitlements/Stripe state**: por último; não migrar sem Owner approval.

### Ciclo por domínio

1. Mapear tabela, FKs, RPCs, triggers, policies, indexes e consumers.
2. Criar schema Drizzle equivalente em branch isolada.
3. Escrever testes de contrato e isolamento antes do adapter.
4. Implementar repository com interface existente.
5. Rodar shadow-read: lê Cloud SQL e compara resultado sem mudar resposta.
6. Adicionar parity checks: contagem, IDs, hashes normalizados, nullability e timestamps.
7. Dual-write somente para operações idempotentes e com receipt.
8. Reconciliar divergências antes de cutover.
9. Ativar leitura Cloud SQL por feature flag e observar métricas.
10. Manter rollback para leitura anterior até janela de aceite.

### Aceite por domínio

- schema e FKs equivalentes;
- parity sem divergências não explicadas;
- testes unitários, integração, tenant e carga verdes;
- retry idempotente;
- rollback ensaiado;
- nenhum segredo ou PII em logs;
- Owner aprova cutover do domínio.

- Esforço: 2–5 dias por domínio simples; 1–3 semanas por domínio CRM/PII.
- Dependências: F1/F2; conversas dependem F5; billing depende decisão própria.
- Aprovação: cada domínio exige aceite; billing e PII exigem Owner explícito.

---

## F7 — Adapters e serviços não migráveis

### Stripe

Manter Stripe como autoridade de pagamento. Cloud SQL armazena projeção de estado via webhook assinado. Adapter único para checkout, portal, webhook e entitlement. Não duplicar decisão de pagamento no frontend.

### WAHA

Não substituir por GCP. Manter como runtime WhatsApp externo/self-hosted. Hospedar CRM/webhook em GCP é separado de hospedar WAHA. Preservar HMAC, throttle, jitter, STOP e idempotência.

### Meta/Nuvemshop

Manter APIs externas atrás de adapters. Tokens ficam criptografados. Toda chamada leva tenant context e idempotency key. Não mover domínio externo para GCP; mover apenas runtime do adapter quando necessário.

### Resend

Manter como provider de email ou avaliar provider alternativo. GCP não fornece substituição 1:1 de transactional email. Adapter deve separar template, delivery, retry e audit.

### Sentry

Manter para error tracking e scrub de PII. Cloud Logging complementa logs, não substitui tracing, releases e alertas Sentry sem equivalência validada.

### Upstash para Memorystore

Vale a pena apenas se workload estiver na mesma VPC/GCP e exigir baixa latência, controle de rede ou custo previsível em volume alto. Trade-offs:

- Memorystore: latência interna e controle GCP melhores; exige VPC connector, networking, HA e operação.
- Upstash: REST/serverless simples, global e já integrado; custo por uso e dependência SaaS.
- Não trocar sem adapter de rate limit/idempotency, benchmark, fallback e teste de perda de conexão.

- Esforço: adapters 3–7 dias; Upstash/Memorystore 3–6 dias.
- Dependências: F2 para tenant; F6 para persistência.
- Aceite: contratos provider, retries, signatures, idempotency, métricas e rollback.
- Aprovação: Owner para custos, tokens e cutover de qualquer provider.

---

## F8 — Infra GCP-only sem dados/auth

### Pode executar após aprovação de infraestrutura, sem tocar produto

- CI: Node 22/24 definido de modo consistente, pnpm pinado, cache e checks existentes.
- Secret Manager wiring: referências de secrets sem valores, IAM mínimo e validação em ambiente descartável.
- Artifact Registry: repositório, build metadata e permissões de CI; sem deploy.
- Cloud Logging: sinks, labels e retenção não sensível.
- Cloud Scheduler/Tasks: filas/jobs de exemplo ou ambiente dev, sem endpoints de produção.
- Terraform validation/plan: lint, `terraform validate`, plan sem apply.

### Ainda exige CEO/Owner

- `terraform apply` em qualquer ambiente compartilhado;
- Cloud Run deploy ou mudança de tráfego;
- Cloud SQL flags, users, networking, backups, migrations ou data copy;
- Firebase Auth config/MFA;
- GCS bucket real, IAM de produção ou cópia de objetos;
- Pub/Sub/realtime ligado a dados reais;
- Secret values, rotation ou access grants;
- Stripe, billing, PII, tenant policy ou RLS;
- remoção de Supabase/Vercel;
- mudança de DNS, domínio, webhook ou produção.

- Esforço: 1–3 dias para CI/terraform plan; 2–5 dias para wiring dev seguro.
- Dependências: F0; deploy real depende dos gates correspondentes.
- Aceite: plan revisado, IAM mínimo, nenhum secret em logs, testes CI verdes e zero mutação não aprovada.
- Aprovação: CEO/Owner aprova cada apply, ambiente e permissão.

## Gate global de promoção

Nenhuma fase é “pronta” por compilação apenas. Exigir:

1. testes automatizados relevantes;
2. evidência de isolamento e autorização;
3. parity/observability;
4. rollback comprovado;
5. revisão independente;
6. aprovação CEO/Owner registrada.
