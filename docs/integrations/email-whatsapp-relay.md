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

## Como testar a GPT Action

Depois de importar `docs/integrations/email-whatsapp-relay.openapi.yaml` no editor do GPT e configurar a autenticação Bearer, o dono/admin deve:

1. Abrir o GPT no editor, selecionar **Preview** e pedir um teste explícito com um `message_id` novo e dados fictícios (não use conteúdo de e-mail real).
2. Confirmar a caixa de aprovação apresentada pelo ChatGPT antes da chamada. Esta Action é de escrita (`x-openai-isConsequential: true`); não desative a confirmação.
3. Verificar que o resultado é `accepted: true` e que a conversa de destino é a do proprietário configurado. Não peça nem aceite envio para outro número.
4. Repetir o mesmo `message_id` somente para conferir a resposta deduplicada; não envie mensagens WhatsApp reais durante o teste sem autorização operacional separada.

Curl equivalente de referência (token apenas como placeholder):

```bash
curl -sS -X POST 'https://crm.lumenva.pt/api/internal/notifications/email' -H 'Authorization: Bearer <INTERNAL_SECRET>' -H 'Content-Type: application/json' --data '{"message_id":"test-message-001","thread_id":"test-thread-001","from":"sender@example.com","to":"owner@example.com","subject":"Teste","summary":"Resumo fictício para validação","action":"Nenhuma ação real","deadline":"sem prazo","urgency":"baixa","source":"manual-test"}'
```

### Configuração manual no ChatGPT Workspace (admin/dono)

O login e as aprovações abaixo são obrigatoriamente humanos. No editor do GPT, abra **Configure → Actions → Create new action**, cole ou importe o conteúdo do OpenAPI e confirme que o servidor é `https://crm.lumenva.pt`. Em **Authentication**, escolha **API key**, localização **Header**, nome `Authorization`, esquema **Bearer**, e informe o valor de `INTERNAL_SECRET` sem registrá-lo no schema, instruções ou prompts.

No admin do Workspace, abra **Settings → Actions** (a nomenclatura pode aparecer como **Workspace settings → GPTs/Actions**), adicione `crm.lumenva.pt` à allowlist de domínios e salve. Se o Workspace solicitar aprovação da Action, aprove a origem e o endpoint exatamente como aparecem no schema; não permita curingas ou HTTP sem TLS.

Volte ao editor do GPT, valide o schema e mantenha a operação `relayEmailNotification` como ação de escrita/consequencial. Na configuração de confirmação, selecione a opção equivalente a **Always ask for confirmation** para esta operação. Publique apenas depois de o Preview mostrar a confirmação e de um teste com payload fictício retornar `401` quando o token for removido.
