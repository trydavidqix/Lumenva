# Relay de e-mail para WhatsApp

O endpoint interno `POST /api/internal/notifications/email` recebe o resumo produzido pelo Gmail/ChatGPT Work e envia uma notificação somente para o número do dono, usando o mesmo `sendMessageHandler` e adaptador WAHA do CRM.

## Configuração

Defina no ambiente do servidor:

```text
EMAIL_RELAY_OWNER_WHATSAPP_E164=<número E.164 do dono>
EMAIL_RELAY_ORGANIZATION_ID=<UUID da organização>
EMAIL_RELAY_DRY_RUN=false
```

O número `to` do payload não é usado como destino. O contato e uma conversa existente são resolvidos pelo número configurado e pela organização configurada. A rota não cria conversa nem envia para clientes.

## Chamada pelo ChatGPT Work

O ChatGPT Work não recebe, por esta rota, um webhook automático que inicie uma conversa. O fluxo suportado é uma GPT Action (ou um custom app MCP): o Work lê o Gmail, produz o resumo e chama a URL HTTPS pública do CRM com uma especificação OpenAPI e autenticação Bearer configurada no Workspace.

Configure a Action para enviar:

```http
POST https://<domínio-do-crm>/api/internal/notifications/email
Authorization: Bearer <INTERNAL_SECRET>
Content-Type: application/json
```

O domínio precisa estar permitido pelo Workspace e a ação de escrita pode exigir aprovação do utilizador/admin. Não exponha o segredo em schema, prompt, URL ou logs. O endpoint deve permanecer atrás de HTTPS e autenticação.

## Idempotência e limites

`message_id` é a chave natural, armazenada em `idempotency_keys` por 24 horas. Repetição equivalente é suprimida; o mesmo ID com conteúdo diferente retorna conflito. O rate limit usa `checkRateLimit`/Upstash no bucket `email_notification_relay` (`120/min`).

O audit registra recebimento, duplicidade, sucesso e falha sem copiar o conteúdo do e-mail ou credenciais.
