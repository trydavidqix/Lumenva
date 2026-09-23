# F7 — Adapters de serviços externos e decisão Upstash/Memorystore

**Status:** gate F7-C0; contrato de desenho. Não troca provider, não altera credencial, não provisiona serviço e não executa chamada real.

## 1. Princípio

Stripe, WAHA, Meta/Instagram, Nuvemshop, Resend e Sentry são dependências externas não migráveis para GCP por decisão da auditoria. F7 troca acoplamento e wiring por interfaces internas; não reimplementa os serviços nem cria provider fantasma. O código de domínio não importa SDK externo diretamente.

Cada adapter deve aceitar dependências injetadas (`fetch`, clock, idempotency store, logger e config), para que testes usem sandbox, fake ou fixture. Credenciais são nomes de configuração/Secret Manager; valores reais nunca entram em código, teste, log ou commit.

## 2. Mapa de boundary

| Provedor | Boundary atual observado | Interface interna F7 | Payload/PII | Credencial e sandbox | Retry/idempotência | Failure/fallback |
|---|---|---|---|---|---|---|
| Stripe | `apps/crm/lib/billing/**`, rotas e webhooks Stripe | `BillingPort` e `BillingWebhookPort` | customer, invoice, payment; minimizar PII | `STRIPE_*`; Stripe test mode e fixtures | idempotency key por operação; retry só transitório | erro explícito; nunca marcar pago sem confirmação; reprocessamento seguro |
| WAHA | `apps/crm/lib/waha/**`, `apps/crm/lib/channels/adapters/waha.ts` | `ChannelTransportPort` | telefone, mensagem e mídia; tenant/auditoria | `WAHA_*`; fake HTTP/local sandbox | backoff limitado; dedupe por message/event id | 503/estado indisponível; não enviar duplicado; não fail-open webhook |
| Meta/Instagram | `packages/integrations/meta/**`, `apps/crm/lib/channels/meta/**`, adapter Meta Cloud | `SocialChannelPort` | tokens nunca no payload; mensagens/templates e IDs externos | Meta test app/fixtures; nomes `META_*` | retry conforme código upstream; hash/idempotency de publicação | circuit breaker; estado pendente/retry manual; sem provider-meta histórico incompatível |
| Nuvemshop | `apps/crm/lib/nuvemshop/**`, `lib/ecommerce/**`, webhooks/actions | `CommercePort` | catálogo, pedido e webhook; redaction de cliente | app/sandbox quando disponível; `NUVEMSHOP_*` | `event_id`/external id e retry-after | webhook rejeitado/auditado; sync pausável; nunca duplicar pedido |
| Resend | `apps/crm/lib/email/resend.ts`, `apps/site/lib/resend.ts` | `EmailPort` | destinatário/template; não logar corpo sensível | domínio/test mode; `RESEND_*` | idempotency quando suportado; dedupe de convite | UI informa não enviado; `accept_url` controlado; retry só seguro |
| Sentry | `apps/crm/lib/sentry/**`, configs Sentry | `ErrorReporterPort` | redaction antes de emitir; zero token/PII | DSN por ambiente; `SENTRY_DSN=off` em teste | não repetir evento em loop; correlation/request id | observabilidade não bloqueia operação; falha fica visível localmente |

O boundary inclui normalização de erro, timeout, redaction, telemetria e classificação de data egress. O adapter pode conhecer o SDK; o domínio conhece somente a interface interna. Requests sempre carregam `organization_id` no contexto confiável, não em campo controlado por cliente.

## 3. Contratos comuns e feature flags

```ts
type ExternalOperationContext = {
  organizationId: string
  requestId: string
  idempotencyKey?: string
  dryRun?: boolean
}

interface ExternalAdapter<Command, Result> {
  execute(ctx: ExternalOperationContext, command: Command): Promise<Result>
}
```

Flags são server-side, por ambiente e, quando necessário, por organização: `F7_STRIPE_ADAPTER`, `F7_WAHA_ADAPTER`, `F7_META_ADAPTER`, `F7_NUVEMSHOP_ADAPTER`, `F7_RESEND_ADAPTER`, `F7_SENTRY_ADAPTER` e `F7_REDIS_BACKEND`. Ausência ou valor inválido mantém o adapter legado. Flag nenhuma autoriza ignorar autenticação, assinatura, tenant, auditoria ou idempotência.

## 4. Upstash → Memorystore

Memorystore é uma opção de backend Redis dentro do GCP, não substituição automática. O contrato interno deve preservar sliding window, TTL, atomicidade, namespacing por tenant e comportamento fail-closed/fail-safe já documentado. F7-J5 implementa somente interface e fake Redis/testes; não provisiona Memorystore, não cria firewall, não troca default e não exige credencial.

Critério para avaliar a troca: compatibilidade de comandos/latência/TTL, isolamento de rede, custo, observabilidade, failover e rollback para Upstash. Se qualquer requisito não for comprovado, o default continua Upstash.

## 5. Segurança e operação

- Retry não pode repetir cobrança, envio, publicação, convite ou webhook.
- Timeout e erro externo viram código interno estável; segredo, token, body completo e PII não entram em log/Sentry.
- Webhooks validam assinatura/token antes de tocar banco, storage ou provider.
- SSRF é bloqueado por allowlist de origem; URLs externas não são aceitas como autoridade de tenant.
- Toda mutação relevante gera auditoria com `organization_id`, ator e `request_id`; falha de audit é observável.
- Sandbox, fake, stub, dry-run e placeholder devem provar o fluxo antes de qualquer credencial real.

## 6. Dependências e subtarefas

F7-C0 bloqueia a implementação para fixar boundaries e não migrabilidade. Depois, F7-J1/J2/J3/J4/J5 podem rodar em paralelo porque cada um tem allowlist exclusiva:

| Tarefa | Allowlist | Não pode tocar | Saída |
|---|---|---|---|
| F7-J1 | `packages/integrations/stripe/**` e testes do adapter | billing fora do adapter, credenciais | contrato Stripe sandbox |
| F7-J2 | `apps/crm/lib/channels/adapters/waha/**` e testes próprios | Meta, billing, produção | contrato WAHA |
| F7-J3 | `apps/crm/lib/channels/adapters/meta/**`, `apps/crm/lib/channels/meta/**` e testes próprios | provider-meta histórico, secrets | contrato Meta |
| F7-J4 | `packages/integrations/nuvemshop/**`, `packages/integrations/resend/**` e testes próprios | credenciais reais | contratos Commerce/Email |
| F7-J5 | `packages/observability/sentry/**`, `packages/platform/rate-limit/**`, docs/testes próprios | Memorystore real/default | Sentry e Redis backend |
| F7-J6 | `tests/invariants/f7-adapter-matrix.test.ts`, `docs/architecture/F7-ADAPTER-CONTRACTS.md` | adapters | matriz de fallback |
| F7-C1 | revisão Codex | merge/cutover | matriz de segurança |
| F7-H1 | ação Owner por último | qualquer secret/custo/provisionamento | sandbox keys, webhooks e Memorystore reais |

O fluxo é `F7-C0 → J1/J2/J3/J4/J5 em paralelo → J6 → C1 → H1`. Cada Jules instala dependências no sandbox, resolve o próprio ambiente, roda RED→GREEN, confere `git diff --name-only` e reporta resultado limpo. Nenhum Jules faz merge.

## 7. Regras obrigatórias

- `.claude/rules/security.md`
- `.claude/rules/api-contract.md`
- `.claude/rules/audit-observability.md`
- `.claude/rules/testing-verification.md`
- `.claude/rules/multi-tenancy.md`

Credenciais, contas externas, aprovação de custo, webhooks reais e provisioning ficam em F7-H1, por último. Até lá, usar sandbox/fake/fixture/placeholder.
