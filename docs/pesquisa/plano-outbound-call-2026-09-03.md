# Plano de ligação outbound Twilio → OpenAI Realtime

Data da pesquisa: 2026-09-03  
Escopo: desenho e pesquisa apenas. Nenhum código foi implementado, nenhuma ligação foi disparada e nenhum commit foi criado.

## Decisão executiva

O desenho geral é viável em conta paga: o backend pede à Twilio uma chamada para o número do dono; quando a pessoa atende, a Twilio executa TwiML que cria uma segunda perna SIP para o endpoint/trunk OpenAI já usado pelo inbound. A OpenAI recebe essa perna como um novo evento `realtime.call.incoming`; o handler atual aceita o `call_id` e abre o sideband WebSocket.

Na conta Trial, há dois bloqueios independentes:

1. O destino precisa ser um número verificado e a chamada reproduz o aviso automático de Trial, solicitando que o destinatário pressione uma tecla antes de prosseguir.
2. A documentação atual de **Try out Voice** lista explicitamente `<Dial><Sip>` entre os nouns bloqueados no custom TwiML de Trial. Portanto, o trecho que ligaria a perna PSTN à OpenAI não pode ser considerado executável no Trial. Não há bypass legítimo documentado; o caminho suportado para funcionalidade completa é upgrade.

A documentação oficial não publica a transcrição integral do áudio automático do aviso em inglês. O plano deve tratar o texto exato como comportamento fornecido pela Twilio, sem inventar uma frase.

## Estado atual confirmado no repositório

`scripts/voice-sip-test/src/server.ts` hoje:

- aceita apenas requisições `POST` do webhook OpenAI;
- valida a assinatura com `OPENAI_WEBHOOK_SECRET`;
- trata `realtime.call.incoming`, extrai `data.call_id` e chama `POST /v1/realtime/calls/{call_id}/accept`;
- abre `wss://api.openai.com/v1/realtime?call_id={call_id}` com `OPENAI_API_KEY` e envia `response.create`;
- não possui cliente Twilio, endpoint para solicitar chamadas, endpoint TwiML ou callback de status Twilio.

O worktree já contém alterações locais não relacionadas. Este documento não deve exigir limpeza, reset ou alteração dessas mudanças.

## Fluxo proposto após upgrade

1. Um operador autorizado chama o novo endpoint interno de outbound, informando o destino em E.164 e uma chave de idempotência.
2. O servidor valida autenticação/autorização, formato do número, allowlist do dono e estado de “armed”/confirmação explícita. Sem essa autorização, responder sem chamar a Twilio.
3. O servidor cria a chamada pela Twilio Calls REST API, com `From` igual ao número Twilio permitido e `To` igual ao número do dono. O request aponta para um endpoint TwiML público do próprio servidor e para callbacks de status.
4. A Twilio disca o PSTN. Depois de atendido, busca o TwiML no endpoint configurado.
5. O TwiML faz `<Dial><Sip>` para o URI/endereço SIP que termina no trunk OpenAI já usado pelo inbound. O URI deve seguir a configuração real do trunk e do projeto, sem inserir segredo no XML.
6. A OpenAI recebe o INVITE SIP como nova chamada recebida e envia `realtime.call.incoming` ao webhook existente.
7. O handler atual aceita esse novo `call_id` com o payload Realtime já usado e abre o sideband. O `call_id` nasce na OpenAI depois do INVITE; não deve ser pré-criado nem confundido com o `CallSid` da Twilio.
8. Os callbacks Twilio persistem `CallSid`, `CallStatus`, `Direction=outbound-api`, timestamps e erros. O encerramento deve ser observável nos dois lados; `200 OK` de uma API isoladamente não prova que a pessoa atendeu ou ouviu áudio.

### Endpoints a desenhar em `server.ts`

Nomes são propostas, não implementação:

- `POST /api/internal/voice/outbound`: inicia uma única solicitação autorizada. Deve aceitar `to`, opcionalmente `twiml_profile`/instruções não sensíveis e `idempotency_key`; nunca aceitar `from` arbitrário nem URL TwiML arbitrária.
- `POST /api/internal/voice/outbound/twiml`: resposta `application/xml` consumida pela Twilio após atendimento. Retorna somente o `<Dial><Sip>` necessário, com timeout e fallback seguro.
- `POST /api/internal/voice/outbound/status`: recebe `initiated`, `ringing`, `answered` e `completed`, além de `busy`, `no-answer`, `failed` e `canceled` quando aplicável. Validar assinatura Twilio antes de persistir.
- Opcional: `POST /api/internal/voice/outbound/fallback` para falha de busca do TwiML; deve encerrar de forma clara e não tentar chamadas adicionais.

O webhook OpenAI existente permanece o ponto de entrada de `realtime.call.incoming`; não criar um endpoint OpenAI separado para outbound.

## Chamada REST Twilio (payload de desenho)

Endpoint oficial:

`POST https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Calls.json`

Autenticação: HTTP Basic com Account SID e Auth Token/API key armazenados no ambiente de execução. Nunca registrar esses valores.

Payload `application/x-www-form-urlencoded` conceitual:

```text
To=+351XXXXXXXXX
From=+1XXXXXXXXXX
Url=https://<dominio-publico>/api/internal/voice/outbound/twiml
Method=POST
StatusCallback=https://<dominio-publico>/api/internal/voice/outbound/status
StatusCallbackMethod=POST
StatusCallbackEvent=initiated
StatusCallbackEvent=ringing
StatusCallbackEvent=answered
StatusCallbackEvent=completed
Timeout=20
```

Regras relevantes confirmadas pela Twilio:

- `To` aceita número, SIP address ou Client; `From` é obrigatório e, para telefone, deve ser número Twilio ou Verified outgoing caller ID.
- `Url` deve ser absoluta e retorna as instruções TwiML quando a chamada conecta. Alternativamente existe `Twiml` inline (limite de 4.000 caracteres) ou `ApplicationSid`.
- Criações por `POST /Calls` são `outbound-api` e têm limite padrão de 1 CPS; chamadas excedentes entram em fila.
- `SendDigits` envia DTMF depois que a chamada conecta. Não usar isso para tentar contornar a confirmação de Trial: o bloqueio e o aviso são controlados pela Twilio.
- Uma chamada `completed` é cobrada mesmo se atendida por pessoa, IVR ou voicemail.

## TwiML e conexão SIP

No cenário pago, a resposta do endpoint TwiML deve ser equivalente a:

```xml
<Response>
  <Dial answerOnBridge="true" timeout="20">
    <Sip>sip:<PROJECT_ID>@sip.api.openai.com;transport=tls</Sip>
  </Dial>
</Response>
```

O valor exato do URI, região (`region=...`) e eventuais credenciais devem seguir o trunk configurado. O elemento `<Sip>` fica dentro de `<Dial>` e encaminha a chamada para um endpoint SIP. A Twilio documenta que o INVITE contém `AccountSid` e `CallSid`.

Importante: o tutorial oficial da integração Realtime com Twilio usa Elastic SIP Trunking para o caminho de entrada (número associado ao trunk → `sip:<PROJECT_ID>@sip.api.openai.com;transport=tls`). `<Dial><Sip>` é o mecanismo genérico para a perna outbound PSTN → SIP. Validar no Console se o mesmo trunk pode ser usado para a terminação necessária; não assumir que BYOC seja substituto automático do endpoint SIP OpenAI.

## OpenAI Realtime: pontos de integração

O SIP endpoint documentado é:

- `sip:$PROJECT_ID@sip.api.openai.com;transport=tls`; ou
- `sip:$PROJECT_ID@sip-eu.api.openai.com;transport=tls` para residência europeia.

Depois do INVITE, o webhook OpenAI recebe `realtime.call.incoming` com `data.call_id` e `data.sip_headers`. O fluxo do servidor é:

`POST https://api.openai.com/v1/realtime/calls/{call_id}/accept`

Headers: `Authorization: Bearer $OPENAI_API_KEY` e `Content-Type: application/json`.

Payload conceitual compatível com o handler atual:

```json
{
  "type": "realtime",
  "model": "gpt-realtime-2.1",
  "instructions": "...instruções aprovadas...",
  "audio": {
    "input": {"turn_detection": {"type": "server_vad", "create_response": true, "interrupt_response": true}},
    "output": {"voice": "alloy"}
  }
}
```

A resposta `200 OK` do `accept` indica que a perna SIP começou a tocar e a sessão está sendo estabelecida; não é prova isolada de atendimento.

O sideband continua sendo:

`GET wss://api.openai.com/v1/realtime?call_id={call_id}`

com `Authorization: Bearer $OPENAI_API_KEY`. O endpoint `refer` é para transferir uma chamada já ativa e não origina o outbound; o endpoint Realtime Calls via SDP/WebRTC também não substitui a origem PSTN da Twilio.

## Trial: aviso, tecla e bloqueios

Fatos oficiais:

- Só números verificados podem ser chamados; a conta pode verificar até cinco números e o número do cadastro é adicionado automaticamente.
- A chamada trial sai de um número trial Twilio e fica limitada ao país do cadastro.
- A Twilio reproduz um aviso de conta Trial antes de executar o fluxo e solicita que o destinatário pressione qualquer tecla para continuar. A documentação consultada não dá o texto integral do áudio automático em inglês.
- A página **Try out Voice** lista `<Dial><Sip>` e outros nouns (`<Dial><Number>`, `<Stream>`, `<Application>`, entre outros) como bloqueados no custom TwiML trial. Quando encontrados, são substituídos por mensagem `Say` de indisponibilidade.
- A restrição de destinatários verificados e as limitações de funcionalidade são removidas no upgrade. Não foi encontrada alternativa legítima para suprimir o aviso/keypress ou habilitar `<Dial><Sip>` mantendo a conta Trial.
- Documentação de Trial também aponta limite de 10 minutos por chamada e concorrência limitada; confirmar o valor vigente no Console antes de qualquer execução.

Consequência: não disparar uma chamada real para “ver se passa”. A única confirmação segura antes de qualquer ligação é verificar no Console o estado da conta, número verificado, disponibilidade do trunk e autorização explícita do dono. Mesmo com número verificado, o caminho Realtime via `<Dial><Sip>` permanece bloqueado se a restrição atual se aplicar à conta.

Alternativas legítimas:

1. Fazer upgrade para conta paga, configurar método de pagamento, manter allowlist do número do dono e então validar o fluxo com uma única chamada autorizada.
2. Permanecer no Trial apenas para testes de chamadas Voice permitidas pelos templates/recursos do Trial; isso não valida a ponte SIP OpenAI.
3. Separar teste provider-free (webhook, validação de assinatura, payloads e TwiML estático) de teste PSTN. Nenhum desses testes prova ligação real ou áudio ouvido.

## Custo de referência

Na página de preços Programmable Voice dos Estados Unidos, a tarifa pay-as-you-go indicada para chamadas de saída locais e toll-free é **US$ 0,0140/minuto**. A mesma página indica **US$ 0,0040/minuto** para a interface SIP. Assim, uma estimativa simples para uma chamada PSTN → perna SIP é:

- US$ 0,0140/min de perna PSTN, mais
- US$ 0,0040/min se a cobrança da interface SIP aplicável incidir, total de referência **US$ 0,0180/min**, antes de número mensal, impostos, recursos adicionais e tarifas do destino.

Não tratar esse total como cotação universal: o preço varia por país/tipo do número, rota e funcionalidades. A página também lista número local a US$ 1,15/mês e toll-free a US$ 2,15/mês. OpenAI Realtime e eventuais gravações/transcrição têm cobrança própria, fora desta estimativa Twilio.

## Estimativa de esforço

- Desenho de contrato, autorização, idempotência e persistência de status: 0,5–1 dia.
- Cliente Calls REST, endpoint TwiML assinado/validado e callbacks: 0,5–1 dia.
- Reuso do handler OpenAI, correlação `CallSid` ↔ `call_id`, timeout e observabilidade: 0,5–1 dia.
- Validação provider-free e revisão de segurança: 0,5 dia.
- Uma única validação PSTN, somente após upgrade e autorização explícita: janela curta, com custo por minuto e possibilidade de cobrança mesmo em voicemail.

Estimativa total: **2–3 dias de engenharia**, sem contar aprovação de upgrade, configuração do trunk, disponibilidade de domínio público/TLS e qualquer correção de infraestrutura de telefonia.

## Gates antes de qualquer implementação ou chamada

1. Aprovação explícita do dono para implementar e, separadamente, para disparar uma ligação real.
2. Conta Twilio paga (ou confirmação documentada de que o recurso necessário não está bloqueado); número do dono verificado em Trial, quando aplicável.
3. Trunk/endpoint SIP OpenAI e residência de dados confirmados no Console.
4. Endpoint TwiML HTTPS público, validação de assinatura Twilio e webhook OpenAI com assinatura validada/idempotência.
5. Testes provider-free passando; nenhum teste local deve ser descrito como prova PSTN, atendimento humano ou áudio ouvido.
6. Limite de custo, timeout, allowlist de destino e mecanismo de kill/encerramento definidos antes do primeiro `POST /Calls`.

## Fontes oficiais consultadas

- Twilio — [Call resource](https://www.twilio.com/docs/voice/api/call-resource)
- Twilio — [Make outbound phone calls](https://www.twilio.com/docs/voice/tutorials/how-to-make-outbound-phone-calls)
- Twilio — [TwiML `<Sip>`](https://www.twilio.com/docs/voice/twiml/sip)
- Twilio — [Try out Voice / Trial restrictions](https://www.twilio.com/docs/usage/trials/try-out-voice)
- Twilio — [Get started with your free trial account](https://www.twilio.com/docs/usage/tutorials/how-to-use-your-free-trial-account)
- Twilio — [Programmable Voice pricing — United States](https://www.twilio.com/en-us/voice/pricing/us)
- OpenAI — [Realtime API with SIP](https://developers.openai.com/api/docs/guides/realtime-sip/)
- OpenAI — [Accept call API reference](https://developers.openai.com/api/reference/resources/realtime/subresources/calls/methods/accept)
- OpenAI — [Hang up call API reference](https://developers.openai.com/api/reference/resources/realtime/subresources/calls/methods/hangup)
