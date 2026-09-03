# Conector MCP de relay de e-mail

O CRM disponibiliza um servidor MCP remoto dedicado em `/api/mcp/relay`. Ele expõe somente a ferramenta `relayEmailNotification`, para que o ChatGPT possa ler o Gmail pelo conector nativo e enviar o resumo para o WhatsApp configurado do proprietário na mesma conversa.

## Segurança

O conector exige OAuth 2.1 Authorization Code com PKCE (S256). Não aceita `INTERNAL_SECRET`, API key estática, token do MCP interno ou bearer em query string. Os access tokens são curtos, opacos, vinculados ao recurso MCP e revogáveis. A autorização usa a senha dedicada `MCP_RELAY_OAUTH_APPROVAL_SECRET`; não reutilize `INTERNAL_SECRET` nessa tela.

O destino não é escolhido pelo ChatGPT. O servidor usa `EMAIL_RELAY_ORGANIZATION_ID` e `EMAIL_RELAY_OWNER_WHATSAPP_E164`, e chama internamente `POST /api/internal/notifications/email`. A idempotência continua sendo a do endpoint existente por `message_id`.

## Configuração

```text
MCP_RELAY_ENABLED=true
MCP_RELAY_OAUTH_APPROVAL_SECRET=<REDACTED_SECRET>
MCP_RELAY_ISSUER=https://crm.lumenva.pt
EMAIL_RELAY_OWNER_WHATSAPP_E164=<E.164>
EMAIL_RELAY_ORGANIZATION_ID=<UUID>
EMAIL_RELAY_DRY_RUN=false
```

O servidor precisa de Upstash Redis configurado para armazenar códigos e sessões OAuth entre instâncias. Em desenvolvimento, o módulo usa memória de processo para testes locais; isso não é apropriado para produção multi-instância.

## Descoberta e ligação no ChatGPT

Use a URL pública `https://crm.lumenva.pt/api/mcp/relay` em Settings → Connectors/Developer mode. O ChatGPT deve descobrir:

- `/.well-known/oauth-protected-resource/api/mcp/relay`;
- `/.well-known/oauth-authorization-server`;
- `/api/oauth/register`;
- `/api/oauth/authorize`;
- `/api/oauth/token`.

Na primeira ligação, aprove a permissão apresentada na tela OAuth. Nas chamadas de escrita, mantenha a confirmação do ChatGPT habilitada.

## Teste local

Use `MCP_RELAY_ENABLED=true` e `EMAIL_RELAY_DRY_RUN=true`, com payload fictício. Não use conteúdo real do Gmail nem peça envio WhatsApp real durante testes. Revogue uma conexão em `/api/oauth/revoke` quando necessário.
