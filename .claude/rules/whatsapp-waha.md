---
paths:
  - "apps/crm/lib/waha/**"
  - "apps/crm/app/api/**"
  - "infra/supabase/**"
---

# WhatsApp / WAHA no CRM

> Regra operacional resumida. O contrato do produto pertence à fonte canônica do domínio em `docs/index.md`. PRD/Spec 03 e business rules W-xx são o contrato detalhado.

## Plataforma e engine

- Canal primário do MVP: **WAHA Plus**.
- Engine default: **NOWEB**.
- WEBJS é exceção para features que realmente dependem dele (por exemplo recursos interativos/stickers quando a fonte atual exigir); não troque engine sem necessidade.
- Uma sessão pertence a uma organização e representa um número/canal com lifecycle próprio.

## Auth e webhooks

- No servidor WAHA, a API key é configurada como **SHA512 hex** do plaintext.
- O cliente DeskcommCRM envia o **plaintext** em `X-Api-Key`; não use `Authorization: Bearer` para uma rota WAHA que não aceite esse contrato.
- Plaintext fica apenas em secret/env apropriado; nunca em repo/log.
- Webhook usa **HMAC-SHA512** e comparação timing-safe sobre o corpo cru quando o contrato exigir.
- Assinatura inválida falha antes de confiar/processar payload.

## Idempotência inbound

Mensagem inbound é deduplicada por chave tenant-aware, historicamente:

```text
unique (organization_id, external_id)
```

Colisão `23505` é no-op idempotente e não deve disparar side effects duplicados. Ordene timeline pelo timestamp do canal (`sent_at`) quando mensagens podem chegar fora de ordem.

## Anti-banimento

Estas são regras operacionais de produto, não dicas:

- conversa 1:1: **1 mensagem a cada 1.2s** + jitter aleatório de até **800ms** por sessão;
- campanha: **1 mensagem a cada 5s** + jitter;
- warm-up de número novo: **7–14 dias** antes de alto volume/campanha;
- escalada/limites diários seguem PRD/business rules da sessão; não invente aumento;
- campanha usa spinning de copy e mínimo de variações conforme PRD atual;
- automações/campanhas respeitam janela default **7h–22h** no timezone do tenant;
- domingo é evitado por default/configurável para automações;
- janela de 24h/guards de automação seguem W-04/IA-01; humano pode ter exceção explícita conforme produto.

Não contorne fila/throttle para “responder mais rápido”.

## STOP / opt-out

Inbound text que casa com a regra vigente de STOP — incluindo `STOP`, `PARAR`, `SAIR`, `UNSUBSCRIBE` e `CANCELAR` como palavra de opt-out — bloqueia o contato e impede outbound automatizado.

- marque `contacts.is_blocked=true` pelo fluxo canônico;
- registre activity/audit correspondente;
- campanha/IA/recovery automatizado não envia para contato bloqueado;
- desbloqueio/manual override só existe conforme regra de negócio e precisa ser auditável.

A regex exata vive no código/business rule; não mantenha uma cópia mais permissiva que a fonte atual.

## Mídia

Caminho canônico: persistir mídia em Storage e fornecer URL assinada ao WAHA, evitando base64 inline para payloads relevantes e mantendo ownership/retention claros.

Business rule W-08 documenta uma exceção para mídia pequena (<1MB) que pode ser inline, enquanto >1MB deve ir para `whatsapp-media` e >16MB outbound é rejeitada pela UI. Portanto **não transforme “Storage é o caminho canônico” em uma proibição absoluta que contradiz W-08**.

URLs assinadas/TTL e RLS do bucket seguem a spec/runbook atual.

## Multi-device

Webhook da sessão inclui `message.any`, não apenas `message`, para não perder mensagens enviadas em devices vinculados.

Para `fromMe=true`:

- se `external_id` já existe, não duplique;
- se é novo, persista como outbound externo conforme metadata canônica (`sent_via='external_device'` quando aplicável).

## Grupos

Se `chatId.endsWith('@g.us')`, a mensagem pode ser persistida, mas **não cria/atualiza lead por binding CRM** no MVP. Sender de grupo vem do campo de autor apropriado do payload, não deve ser inferido como o próprio group id.

## `recover-stuck-messages`

Regra W-12 e implementação atual:

- outbound `status='sending'` há mais de 5 min é candidato a `failed`;
- update usa claim/condição de status para não vencer corrida com ack real;
- emite `message.failed` para as mensagens realmente marcadas;
- abre um aviso `message_send_stuck` por organização/rodada na Central;
- **não reenvia automaticamente** — duplicar envio pode ser pior que falhar;
- **não toca `queued`**: esse estado tem owner/retry no agent-engine e falhá-lo pelo mesmo timeout perderia mensagem legítima.

Código canônico: `app/api/v1/cron/recover-stuck-messages/route.ts`. Teste canônico: `tests/unit/recover-stuck-messages.test.ts`.

## Crons e secrets

Crons do canal usam secret interno separado do service-role key e falham fechado. Não exponha `INTERNAL_SECRET`, `INTERNAL_CRON_SECRET`, WAHA key ou webhook secret.

## Fontes

- `docs/prd/03-prd-whatsapp-waha.md`
- `docs/specs/03-spec-whatsapp-waha.md`
- `docs/business-rules/00-business-rules-catalog.md` W-01…W-12
- `app/api/v1/cron/recover-stuck-messages/route.ts` para o comportamento atual do recovery
