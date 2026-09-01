# Plano de investigação: OpenAI Realtime SIP nativo

Data: 2026-08-31  
Escopo: pesquisa e desenho; nenhuma conta, compra, credencial, trunk ou rota de produção foi alterada.

## Conclusão executiva

O número `+351910293287` não precisa ser portado por princípio. O desenho documentado é manter o número no operador SIP atual, se esse operador conseguir terminar o trunk num destino SIP externo por TLS e encaminhar SRTP conforme o SDP, e trocar apenas a rota de entrada para:

```text
sip:<PROJECT_ID>@sip-eu.api.openai.com;transport=tls
```

O endpoint europeu é a opção coerente com a residência europeia documentada pela OpenAI. A documentação usa Twilio como exemplo de provedor, mas não declara exclusividade de Twilio; portanto, “outros provedores funcionam” ainda é uma hipótese de compatibilidade a validar com o operador atual (TLS/FQDN, codecs, SRTP e suporte a URI de destino). Portabilidade só entra no plano se o operador atual não oferecer essas capacidades ou se for decidido mudar de carrier.

## Correção importante sobre a estimativa de preço

O valor público atual de `$0.0131/min` da Twilio é a rota de **termination para Portugal**. A tabela também mostra `$0.4910/min` para Portugal móvel e `$0.0455/min` para móvel com origem no EEE. [Twilio Portugal SIP pricing](https://www.twilio.com/en-us/sip-trunking/pricing/pt)

Na ponte proposta, a chamada é inicialmente feita por MEO/Vodafone para um número Twilio. Isso é uma chamada **recebida/originating no número Twilio**, não uma chamada de termination para um destino PSTN português. A página pública consultada não exibiu um preço para DID fixo português; exibiu apenas mobile `$135/mês` e origination mobile `$0.0067/min`. Portanto, `$0.0131/min` não deve ser usado como custo final da ponte sem uma cotação/lookup do número fixo específico. O preço do DID fixo e da perna inbound precisam ser confirmados no Console ou na API de pricing da conta antes de comprar qualquer coisa. [Twilio Pricing Trunking API](https://www.twilio.com/docs/sip-trunking/pricing-trunking-resource)

O desvio MEO não é “gratuito” no sentido total: a tabela oficial informa ativação gratuita, mas diz que a parcela reencaminhada é paga pelo cliente ao preço da comunicação realizada. [MEO: Preços das funcionalidades](https://conteudos.meo.pt/meo/Documentos/Tarifarios/Tarifarios-Telefone-Funcionalidades-Precario.pdf)

## Evidência documental

- A OpenAI diz para usar um provedor de SIP trunking (exemplo: Twilio), criar o webhook do projeto e apontar o trunk para `sip:$PROJECT_ID@sip.api.openai.com;transport=tls`; para residência europeia, para `sip:$PROJECT_ID@sip-eu.api.openai.com;transport=tls`. [Realtime API with SIP](https://developers.openai.com/api/docs/guides/realtime-sip#overview)
- A mesma página especifica sinalização TCP/TLS na porta 5061 e mídia SRTP bidirecional para as faixas de CIDR publicadas pela OpenAI; a porta de mídia vem do SDP negociado. [SIP signaling and media IP ranges](https://developers.openai.com/api/docs/guides/realtime-sip#sip-signaling-and-media-ip-ranges)
- O exemplo da Twilio compra ou reutiliza um DID, cria um Elastic SIP Trunk e adiciona o URI OpenAI como Origination URI; depois associa o número ao trunk. Isso demonstra roteamento, não uma exigência de portabilidade para Twilio. [Twilio: Configure Twilio SIP Trunking](https://www.twilio.com/en-us/blog/developers/tutorials/product/openai-realtime-api-elastic-sip-trunking#configure-twilio-sip-trunking)

## Fluxo proposto para a Lumenva

```text
DID +351910293287
  -> trunk SIP do carrier atual (ou trunk de teste separado)
  -> sip:<PROJECT_ID>@sip-eu.api.openai.com;transport=tls
  -> OpenAI envia realtime.call.incoming ao webhook do projeto
  -> CRM valida assinatura, idempotência, número/organização e canal
  -> CRM aceita ou rejeita via /v1/realtime/calls/{call_id}/accept|reject
  -> CRM abre sideband WebSocket wss://api.openai.com/v1/realtime?call_id=...
  -> eventos/áudio da sessão Realtime
  -> eventos de término/uso e fechamento idempotente de voice_calls/audit
```

A página SIP afirma que, ao receber o tráfego, a OpenAI dispara `realtime.call.incoming`; desse evento vem `call_id`, usado para aceitar/rejeitar. O `accept` configura modelo, voz, instruções e demais parâmetros, e retorna `200 OK` quando a perna SIP está a tocar e a sessão está a ser estabelecida. [Incoming webhook and accept](https://developers.openai.com/api/docs/guides/realtime-sip#overview), [Accept the call](https://developers.openai.com/api/docs/guides/realtime-sip#accept-the-call)

O webhook é, portanto, o ponto anterior à aceitação da sessão pelo CRM: ele não é um simples callback posterior. A documentação também descreve o sideband como a conexão do servidor para monitorar a chamada, atualizar instruções e tratar tools durante a vida da sessão. [Webhooks and server-side controls](https://developers.openai.com/api/docs/guides/realtime-server-controls#with-sip)

### Mapeamento da lógica CRM

1. Receber somente `POST` assinado. Validar `webhook-signature`, timestamp e `webhook-id`; usar `webhook-id`/`call_id` como chave idempotente. Não confiar em organização enviada pelo cliente.
2. Extrair `From` e `To` dos `sip_headers`. Normalizar E.164 e resolver `To = +351910293287` numa tabela/configuração de números por `organization_id`.
3. Consultar a política de canal `voice`/Product Agent dessa organização. Se não autorizado, chamar `reject` (por exemplo, 486 ou o código decidido pelo produto) e registrar o resultado.
4. Se autorizado, criar/obter o registro `voice_calls` em estado pendente, registrar o audit mínimo sem áudio/segredo e chamar `accept` com o modelo/instruções aprovados.
5. Abrir o sideband WebSocket e executar as ferramentas/ações CRM no servidor. Eventos de encerramento e uso devem fechar `voice_calls` idempotentemente e alimentar o audit/event log; não colocar HTTP dentro de trigger Postgres.
6. Responder rapidamente `2xx` ao webhook depois de enfileirar/assumir o trabalho, sem repetir aceitação em retries. A assinatura deve ser verificada antes de processar.

O exemplo oficial mostra o `accept` e a abertura do WebSocket no tratamento do incoming event. A referência de webhooks lista `realtime.call.incoming` como evento de sessão SIP pendente; não encontrei na documentação SIP um evento dedicado “call ended” que substitua a observação do sideband. O plano deve, portanto, tratar `realtime.call.incoming` como pré-aceitação e usar o sideband/eventos Realtime + reconciliação de usage para o fechamento pós-chamada, confirmando os tipos de evento disponíveis na implementação escolhida.

## Provedor, número e pré-requisitos

### Manter o carrier atual (opção preferida para teste)

Solicitar ao carrier, sem alterar ainda, confirmação escrita de:

- trunk de origination capaz de apontar para FQDN SIP externo `sip-eu.api.openai.com` com TLS/5061;
- SRTP bidirecional e codecs oferecidos compatíveis com o SDP da OpenAI;
- preservação dos headers `From`/`To` necessários para identificar o DID;
- possibilidade de criar um segundo trunk/DID de teste e de reverter a origination para Asterisk.

Se todos forem suportados, a mudança é de destino do trunk, não de titularidade/portabilidade do número.

### Configuração prevista no Asterisk de produção

O arquivo versionado de referência confirma que o Asterisk atual usa PJSIP em `0.0.0.0:5060` e mantém o endpoint de teste `1000`. A implementação futura deve acrescentar um bloco separado, por exemplo `twilio-inbound`, sem modificar o endpoint `1000`:

```ini
; pseudoconfig de plano — não aplicar sem confirmar IPs, TLS e codecs do carrier
[twilio-inbound]
type=endpoint
context=voice-inbound-twilio
disallow=all
allow=ulaw,alaw
direct_media=no
; a autenticação/identificação real será por identify/IP ACL ou TLS,
; conforme o trunk contratado; não inserir senha inventada

[twilio-inbound-identify]
type=identify
endpoint=twilio-inbound
match=<CIDRs-publicados-pelo-Twilio>
```

O contexto `voice-inbound-twilio` deve aceitar somente o DID esperado e entrar no mesmo caminho já comprovado do worker (`Stasis`/ponte de voz), sem `Dial()` arbitrário para números externos. O contexto atual de teste e o endpoint `1000` ficam intactos. Os CIDRs, transporte TLS/SRTP, codecs, `from_domain`/`contact_user` e eventual credential list devem ser obtidos do trunk real e testados em staging; o pseudoconfig acima não é uma instrução de deploy.

No lado Twilio, a documentação diz que a Origination SIP URI pode usar IP ou FQDN do IP-PBX/SBC, que o número discado é carregado no header SIP `Diversion`, e que o trunk possui listas de IP e listas de credenciais para autenticação. Secure Trunking usa TLS para sinalização e SRTP para mídia. [Twilio Elastic SIP Trunking](https://www.twilio.com/docs/sip-trunking)

### Trocar de carrier ou portar

Só considerar portabilidade se o carrier atual não puder fazer o encaminhamento acima. Para esta ponte, o requisito é comprar ou alocar um DID Twilio de teste e fazer o desvio MEO/Vodafone para esse DID; não é necessário portar `+351910293287`. Twilio Elastic SIP Trunking é um caminho documentado e tem custos/contratos próprios; a fonte não afirma que Twilio seja o único carrier. Telnyx, Vonage ou outro carrier só devem ser aceitos após confirmação independente de suporte a SIP TLS/SRTP e disponibilidade de DID português.

## Custos

Há pelo menos três componentes de custo:

1. MEO/Vodafone: a chamada desviada é faturada de acordo com o plano/rota do número de origem. Na MEO, a ativação é gratuita, mas a comunicação reencaminhada é cobrada.
2. Twilio: DID fixo, perna inbound/origination para o número Twilio, uso do SIP trunk e eventuais add-ons. O valor `$0.0131/min` é termination PT e não deve ser aplicado automaticamente à perna inbound desta ponte. [Twilio Portugal SIP pricing](https://www.twilio.com/en-us/sip-trunking/pricing/pt)
3. OpenAI Realtime: Responses são cobrados pelos tokens de entrada/saída; áudio usa tokens por duração. Se input transcription for ativada, ela tem a tabela do modelo de transcrição. A documentação diz explicitamente que atualmente não há custo de bandwidth ou de connections da API. [Managing costs](https://developers.openai.com/api/docs/guides/realtime-costs#understanding-and-managing-token-costs)

Não há taxa OpenAI por webhook descrita na documentação consultada. Isso não elimina custos do endpoint HTTP que o CRM hospedar, observabilidade ou do próprio carrier. O orçamento deve usar os `usage` de `response.done` e os eventos de transcrição, não uma estimativa fixa por minuto; a OpenAI também recomenda medir uma sessão representativa no Playground. [Realtime usage and transcription billing](https://developers.openai.com/api/docs/guides/realtime-costs#input-transcription-costs)

## Echo cancellation e qualidade

A documentação SIP consultada não promete AEC (acoustic echo cancellation) nem apresenta uma configuração de cancelamento de eco no conector; a busca por “echo” na página não retornou uma seção correspondente. Ela documenta apenas os caminhos SIP/SRTP, SDP, codecs e configuração de áudio. Portanto, não é seguro afirmar que a OpenAI assumirá todo o cancelamento de eco. A arquitetura nativa remove o loop local Asterisk/Pipecat, mas o handset/softphone/carrier ainda pode introduzir eco acústico. AEC e comportamento de half-duplex devem ser validados num teste real controlado e, se necessário, resolvidos no endpoint/carrier.

## Teste reversível e rollout

1. Não tocar no trunk/DID de produção. Pedir ao carrier um DID português de teste ou um segundo trunk que possa ser liberado sem afetar `+351910293287`.
2. Criar no projeto OpenAI um webhook de teste para `realtime.call.incoming`, com segredo guardado no mecanismo de secrets do CRM. Implementar o handler em modo “deny by default”: aceitar apenas o DID/organização de teste.
3. Validar DNS/TLS 5061 e SRTP na faixa publicada pela OpenAI; testar `incoming -> reject` primeiro para provar autenticação, assinatura e roteamento sem gerar conversa.
4. Testar `incoming -> accept -> sideband -> hangup` com o DID de teste, registrando somente metadados, latência e usage; comparar áudio/transcrição e ausência de auto-conversa.
5. Rodar testes de silêncio, fala curta/longa, queda do sideband, retry do webhook e chamada rejeitada. Confirmar idempotência de `voice_calls` e audit.
6. Só depois de aprovação explícita, configurar uma janela de canário do número real. Manter o destino Asterisk documentado e pronto para rollback; reverter a Origination URI para o destino anterior se qualquer gate falhar.

## Desvio MEO/Vodafone: o que está confirmado

- A Vodafone documenta os códigos de consulta `*#21#` (todas), `*#61#` (não atende), `*#62#` (desligado/sem rede) e `*#67#` (ocupado). A página consultada encaminha a ativação/desativação para o procedimento da operadora, mas não publicou ali a sintaxe completa de ativação para todos os planos. [Vodafone: verificar reencaminhamento](https://ajuda.vodafone.pt/perguntas-relacionadas/como-verifico-se-um-reencaminhamento-esta-ativo)
- A MEO publica para telefone fixo o código de ativação incondicional `*21*<número destino>` e informa ativação gratuita, mas cobrança da comunicação reencaminhada. Esta fonte é de serviço fixo; a aplicabilidade exata ao número móvel `+351910293287` deve ser confirmada no plano móvel MEO/Vodafone antes de usar o código. [MEO: Preços das funcionalidades](https://conteudos.meo.pt/meo/Documentos/Tarifarios/Tarifarios-Telefone-Funcionalidades-Precario.pdf)
- O procedimento operacional deve ser ativar o desvio no app/área de cliente ou com o suporte da operadora, anotar a hora e o tipo (incondicional versus ocupado/não atende), fazer uma chamada de teste e confirmar a desativação para rollback. Não tratar “ativação gratuita” como “chamada desviada sem custo”.

## Decisões pendentes para o dono

- O carrier atual suporta exatamente SIP TLS para o FQDN europeu da OpenAI, SRTP e codecs do SDP?
- Existe DID/trunk de teste sem alterar o número Lumenva?
- Qual projeto OpenAI e política de residência devem ser usados (`sip-eu` é a opção documentada para Europa)?
- Quais eventos de encerramento/usage serão a fonte canônica para fechar `voice_calls`?
- Qual teto de custo por teste/canário e qual janela de rollback?

## Estado desta pesquisa

Não foram criadas contas, não foram comprados números, não foram alterados trunks, DNS, firewall ou produção, e nenhum segredo foi lido ou persistido. Este documento é um plano técnico; qualquer execução exige decisão posterior sobre carrier, DID de teste, webhook e orçamento.
