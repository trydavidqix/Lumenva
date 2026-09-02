---
type: handoff
project: DeskcommCRM
date: 2026-09-02
status: fechado para continuidade em 2026-09-03
audited_against: main @ 8798ae894f7c737bb24178d06570f9bc537a0dbe
---

# Handoff — relay de e-mail para WhatsApp e configuração do ChatGPT Work

## Estado confirmado

`main` está em `8798ae894f7c737bb24178d06570f9bc537a0dbe`, commit de merge da
feature de relay e-mail-WhatsApp. A implementação veio do commit
`5699bc5eb3e7377a34090c8955f2b73685728957`; o push informado pelo dono foi de
`89c90510` para `8798ae89`. Este handoff registra o estado do código integrado;
não houve deploy, alteração de produção, uso de Docker ou envio real de
mensagem durante esta tarefa.

## O que foi feito

O CRM agora expõe o endpoint interno `POST /api/internal/notifications/email`.
Ele recebe um resumo de e-mail produzido pelo Gmail/ChatGPT Work, valida o JSON,
e envia uma notificação de texto para o WhatsApp pessoal do dono por meio da
conversa CRM já existente e do adaptador WAHA existente.

Payload esperado:

```json
{
  "message_id": "identificador-estavel-do-email",
  "thread_id": "identificador-da-thread",
  "from": "remetente@example.com",
  "to": "destinatario@example.com",
  "subject": "Assunto",
  "summary": "Resumo do e-mail",
  "action": "Ação necessária",
  "deadline": "Prazo ou não aplicável",
  "urgency": "normal",
  "source": "gmail-chatgpt-work"
}
```

O acesso é protegido por `Authorization: Bearer <INTERNAL_SECRET>`, validado
pelos helpers de segredo interno. A rota aplica rate limit de 120 requisições por
minuto no bucket `email_notification_relay` e responde com `429`/`Retry-After`
quando o limite é excedido.

A idempotência é tenant-aware e dura 24 horas: `message_id` funciona como a
chave natural equivalente à convenção `Idempotency-Key`, é reservado na tabela
`idempotency_keys` e recebe hash do payload. Repetição com o mesmo conteúdo é
deduplicada; o mesmo `message_id` com conteúdo diferente retorna
`409 idempotency_conflict`; uma reserva ainda em processamento retorna conflito
de estado. A proteção ocorre no servidor antes do efeito de envio.

O destino nunca é escolhido pelo campo `to` recebido. Esse campo faz parte do
payload validado, mas é deliberadamente ignorado como destino. O sistema resolve
o contacto pelo número configurado em `EMAIL_RELAY_OWNER_WHATSAPP_E164`, dentro
de `EMAIL_RELAY_ORGANIZATION_ID`, e usa a conversa mais recente já existente
desse contacto. Não cria conversa nem envia para clientes. Se o contacto ou a
conversa do dono não estiverem autorizados/configurados, o envio falha fechado.

As mutações e estados relevantes deixam audit actions `email.relay_received`,
`email.relay_duplicate`, `email.relay_succeeded` e `email.relay_failed`, sem
copiar conteúdo do e-mail ou credenciais para o audit.

## Como foi feito

- A rota Next.js `app/api/internal/notifications/email/route.ts` define o
  `POST`, o schema Zod, a autenticação, o rate limit, a reserva idempotente e a
  resposta canónica `ok()`/`fail()`.
- A autenticação reutiliza `bearerFromHeader` e `cronSecretMatches`, portanto o
  `INTERNAL_SECRET` segue a mesma fronteira de segredo das rotas internas
  existentes.
- A validação é feita por Zod antes de qualquer consulta de tenant ou efeito
  externo. O tenant vem da configuração do servidor, não do body.
- A tabela `idempotency_keys` guarda `organization_id`, endpoint, chave,
  `request_hash`, resposta, status e expiração de 24 horas; a captura de
  `23505` implementa replay seguro e conflito de conteúdo.
- `checkRateLimit`/Upstash controla o bucket `email_notification_relay` em
  janela de 60 segundos.
- O envio reutiliza `sendMessageHandler` em
  `app/api/v1/messages/_handler`, com actor `webhook_source` e request id, sobre
  a conversa CRM pré-existente resolvida para o número do dono. O adaptador WAHA
  já usado pelo CRM permanece o boundary de entrega.
- `lib/env.ts` adiciona e valida `EMAIL_RELAY_OWNER_WHATSAPP_E164`,
  `EMAIL_RELAY_ORGANIZATION_ID` e `EMAIL_RELAY_DRY_RUN`, mantendo
  `INTERNAL_SECRET` obrigatório.
- O contrato operacional já está resumido em
  [`docs/integrations/email-whatsapp-relay.md`](../integrations/email-whatsapp-relay.md).

## O que falta fazer (lado ChatGPT Work / dono)

Esta seção é autocontida para encaminhamento ao administrador do Workspace.

### Achado arquitetural

O ChatGPT Work não chama um webhook nosso por iniciativa própria apenas porque
o endpoint existe. O caminho suportado é o inverso: o dono deve configurar uma
**GPT Action baseada em OpenAPI** dentro do app ChatGPT Workspace. O GPT lê o
Gmail, produz o resumo e, quando decidir que a Action se aplica, chama o
endpoint HTTPS público do CRM. A documentação oficial descreve que Actions
precisam de autenticação e de um schema OpenAPI, e podem ser testadas no Preview:
[`Configuring actions in GPTs`](https://help.openai.com/en/articles/9442513).

### Pré-requisitos e configuração obrigatória

Antes de testar a Action:

1. Disponibilizar uma URL HTTPS pública, estável e permitida pelo Workspace,
   apontando para `POST /api/internal/notifications/email`. Não usar URL local,
   HTTP sem TLS ou endpoint sem autenticação.
2. Publicar ou fornecer ao editor da Action uma especificação OpenAPI válida que
   descreva exatamente essa rota, o payload acima e a resposta/erros esperados.
3. Configurar na Action autenticação de API do tipo **Bearer** (ou header
   customizado equivalente) para enviar `Authorization: Bearer <INTERNAL_SECRET>`.
   O valor real é segredo: não o colocar no schema OpenAPI, prompt, URL, logs,
   screenshots ou documentação compartilhada.
4. Obter aprovação explícita do administrador/owner do Workspace para Actions
   de escrita e para o domínio do CRM. Enviar mensagem é uma ação com efeito
   externo; o Workspace pode exigir aprovação antes da execução e pode bloquear
   domínios ou ações conforme suas políticas. Consulte também
   [`Apps in ChatGPT`](https://help.openai.com/en/articles/11487775-apps-in-chatgpt/),
   que documenta controles administrativos de disponibilidade, domínios,
   permissões e write actions.
5. No ambiente do servidor, configurar os nomes abaixo antes de retirar o
   `EMAIL_RELAY_DRY_RUN` do modo de teste. Os valores reais não pertencem a este
   documento:

   ```text
   INTERNAL_SECRET
   EMAIL_RELAY_OWNER_WHATSAPP_E164
   EMAIL_RELAY_ORGANIZATION_ID
   ```

   `INTERNAL_SECRET` é segredo; `EMAIL_RELAY_OWNER_WHATSAPP_E164` é PII do dono;
   `EMAIL_RELAY_ORGANIZATION_ID` delimita o tenant. Validar a existência do
   contacto e de uma conversa CRM pré-existente para esse número antes do
   primeiro envio autorizado.

### Alternativa de integração

Se o Workspace preferir não usar GPT Action, a alternativa documentada é um
**remote MCP custom app**. Nesse caminho, o administrador precisa permitir
custom apps/MCP no Workspace, publicar o app e configurar a ferramenta para
chamar a mesma rota com o mesmo Bearer, domínio HTTPS e controles de aprovação.
As regras de disponibilidade e publicação de custom apps/MCP estão na seção
“Building your own app” de [`Apps in ChatGPT`](https://help.openai.com/en/articles/11487775-apps-in-chatgpt/).

### Limite desta entrega

O endpoint e o contrato do CRM estão integrados em `main`; ainda não estão
provados neste checkout a URL pública, o schema OpenAPI publicado, a aprovação
administrativa do Workspace, a configuração das três variáveis ou uma entrega
real no WhatsApp. Esses passos pertencem ao dono/infra/admin do Workspace e
devem ser executados e evidenciados separadamente, sem colocar segredos ou PII
em artefatos versionados.

## Gates deste fechamento

Foi feita revisão documental contra `main @ 8798ae894f7c737bb24178d06570f9bc537a0dbe`,
o diff do merge/feature e os testes versionados da rota. Não foram executados
Docker, deploy, migrations remotas, login OAuth, browser actions ou envio real
de WhatsApp. O `pnpm harness:check` deve ser executado após a criação deste
handoff; o resultado deve ser registrado no fechamento da revisão.
