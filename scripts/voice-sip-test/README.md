# Teste isolado Twilio → OpenAI Realtime via SIP

Este diretório é descartável e não é integrado ao CRM. O servidor recebe o webhook OpenAI `realtime.call.incoming`, aceita a chamada em `POST /v1/realtime/calls/{call_id}/accept` e abre o sideband WebSocket documentado para enviar a primeira resposta.

## Variáveis

Defina no ambiente (não grave chaves neste diretório):

```bash
export OPENAI_API_KEY='[sua chave do projeto]'
export OPENAI_WEBHOOK_SECRET='[segredo do webhook criado no Console OpenAI]'
export PORT=8000
```

O `OPENAI_WEBHOOK_SECRET` é necessário para validar a assinatura do webhook; `OPENAI_API_KEY` autentica o `accept` e o WebSocket.

## Rodar localmente

Requer Node.js 22 ou superior. Dentro deste diretório, instale as dependências explicitamente e inicie:

```bash
pnpm install
pnpm dev
```

Não execute esses comandos sem autorização se a instalação/download ainda não tiver sido autorizado.

## URL pública

Para um teste pontual, **ngrok** é o caminho mais simples: `ngrok http 8000`. Copie a URL HTTPS gerada e registre `https://<dominio-ngrok>/` como webhook OpenAI para o evento `realtime.call.incoming`. O domínio gratuito é aleatório e muda ao reiniciar; atualize o webhook nessa situação. Cloudflare Tunnel também pode expor a porta, mas exige configuração adicional.

## Configuração Twilio confirmada na documentação

O tutorial oficial Twilio para esta integração usa **Elastic SIP Trunking**, não um webhook TwiML `<Dial><Sip>`: crie um SIP Trunk, em Origination adicione `sip:<OPENAI_PROJECT_ID>@sip.api.openai.com;transport=tls`, associe o número Voice ao trunk e então ligue para esse número. O webhook HTTP OpenAI é configurado separadamente no Console OpenAI.

O `<Dial><Sip>` é um recurso TwiML genérico para endpoints SIP e não é o fluxo mostrado pelo tutorial oficial Twilio Realtime. Não misture os dois caminhos neste teste.

## Limites Trial

As páginas oficiais da Twilio não são consistentes: a página de limites do Elastic SIP Trunking diz que SIP Trunking só fica disponível após upgrade; a página oficial de limitações do Trial diz que é possível configurar **1 Elastic SIP Trunk** e **1 número**, com chamadas apenas de/para números verificados, aviso de Trial antes de conectar, máximo de 10 minutos por chamada e até 4 chamadas simultâneas. Portanto, confirme no Console da conta do dono antes de tentar; se a criação/associação do trunk estiver bloqueada, o teste específico não é possível sem upgrade.

## Fontes oficiais

- Twilio, tutorial Realtime + Elastic SIP Trunking: https://www.twilio.com/en-us/blog/developers/tutorials/product/openai-realtime-api-elastic-sip-trunking
- OpenAI, eventos de webhook (`realtime.call.incoming`): https://developers.openai.com/api/reference/resources/webhooks
- OpenAI, aceitar chamada SIP: https://developers.openai.com/api/reference/python/resources/realtime/subresources/calls/methods/accept
- Twilio, limites e Trial de SIP Trunking: https://www.twilio.com/docs/sip-trunking/scale-and-limits
- Twilio, limitações detalhadas de contas Trial: https://help.twilio.com/hc/en-us/articles/360036052753-Twilio-Free-Trial-Limitations
- Twilio, TwiML `<Sip>` (recurso genérico): https://www.twilio.com/docs/voice/twiml/sip
