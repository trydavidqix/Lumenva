# Guia do dono: DID Twilio e desvio MEO/Vodafone

Este guia é operacional para o dono. Não cria conta, não compra número e não altera o trunk de produção por si só.

## 1. Antes de comprar

1. Confirmar se a conta telefónica do número `+351910293287` é MEO ou Vodafone.
2. Pedir ao suporte da operadora confirmação de que o serviço móvel permite desvio para um número fixo nacional, incluindo o preço por minuto da parcela desviada.
3. Pedir ao carrier SIP atual (ou à Twilio, se for escolhido outro carrier) um DID fixo português de teste e confirmar o preço mensal e a tarifa inbound/origination aplicável ao prefixo concreto.
4. Não alterar ainda o número real da Lumenva.

## 2. Criar a conta e o DID no Twilio (ação exclusiva do dono)

1. Entrar no Console Twilio e concluir signup, verificação de identidade/empresa e faturação. O agente não deve executar esses passos.
2. Abrir Phone Numbers e procurar Portugal, capacidade Voice e um número geográfico/fixo, se disponível para a conta/região. Confirmar o preço mostrado antes de comprar.
3. Antes da compra, guardar no orçamento: mensalidade do DID, custo de receber a chamada no DID, impostos e eventuais requisitos regulatórios portugueses.
4. Comprar somente um DID de teste, não o número Lumenva.

A página pública de preços consultada mostra para Portugal `$0.0131/min` de termination e `$0.4910/min` de termination móvel, mas não mostrou preço de DID fixo português; o preço deve ser confirmado no Console/API para o número escolhido. [Twilio SIP pricing Portugal](https://www.twilio.com/en-us/sip-trunking/pricing/pt), [Twilio Trunking Pricing API](https://www.twilio.com/docs/sip-trunking/pricing-trunking-resource)

## 3. Criar o Elastic SIP Trunk

1. Em Elastic SIP Trunking, criar um trunk dedicado ao teste.
2. Em Origination, configurar a URI do nosso Asterisk de produção, usando o IP/FQDN público e porta/transporte que forem aprovados para o trunk. Não inventar porta, CIDR ou certificado.
3. Ativar Secure Trunking (TLS para sinalização e SRTP para mídia) se o Asterisk estiver preparado para isso; caso contrário, não ativar no carrier até a configuração TLS/SRTP estar validada.
4. Em Termination/Authentication, preferir IP Access Control List com os IPs/CIDRs de sinalização publicados pela Twilio para o trunk. Credential List só deve ser usada se exigida pelo modo contratado e deve ficar no secret store.
5. Associar apenas o DID de teste ao trunk.
6. Fazer uma chamada para o DID de teste e confirmar no Twilio Console o SIP INVITE, o `Diversion` e a rota para o nosso IP. A Twilio documenta que o número discado aparece no `Diversion` header e que a Origination URI pode apontar para IP ou FQDN do IP-PBX/SBC. [Twilio Elastic SIP Trunking](https://www.twilio.com/docs/sip-trunking)

## 4. O que o agente fará depois de receber os dados reais

O dono deve fornecer apenas os parâmetros não secretos necessários: DID de teste, Origination URI/hostname, transporte, CIDRs Twilio e política TLS/SRTP. Senhas não devem ser coladas no chat; devem ser entregues pelo secret store autorizado.

Só então será possível preencher os templates:

- [`ops/voice-asterisk/twilio-inbound.disabled.conf.example`](../../ops/voice-asterisk/twilio-inbound.disabled.conf.example)
- [`ops/voice-asterisk/extensions-twilio-inbound.disabled.conf.example`](../../ops/voice-asterisk/extensions-twilio-inbound.disabled.conf.example)

O endpoint `1000`, o contexto `voicecore-test` existente e o worker atual permanecerão inalterados. A configuração nova terá contexto dedicado, IP allowlist e rota somente para o connection ID da organização autorizada.

## 5. Ativar o desvio na operadora

### MEO

Para serviço fixo, a MEO publica ativação de desvio incondicional com `*21*<número destino>`; a ativação é gratuita, mas a comunicação reencaminhada é cobrada ao cliente. A fonte é de telefone fixo, por isso a aplicabilidade ao número móvel deve ser confirmada no plano concreto antes de usar o código. [MEO: Preços das funcionalidades](https://conteudos.meo.pt/meo/Documentos/Tarifarios/Tarifarios-Telefone-Funcionalidades-Precario.pdf)

Para o móvel Lumenva, usar primeiro a app/área de cliente MEO ou o suporte, pedir “reencaminhamento incondicional para o DID Twilio de teste” e confirmar a tarifa por minuto. Não ativar desvio condicional sem decidir os tempos de toque.

### Vodafone

A Vodafone documenta estes códigos de consulta:

- `*#21#` — todas as chamadas;
- `*#61#` — quando não atende;
- `*#62#` — desligado/sem rede;
- `*#67#` — ocupado.

A ativação pode depender do plano e da app/área de cliente; confirmar com o suporte antes de usar uma sintaxe de ativação. [Vodafone: verificar reencaminhamento](https://ajuda.vodafone.pt/perguntas-relacionadas/como-verifico-se-um-reencaminhamento-esta-ativo)

## 6. Ordem de teste e rollback

1. Testar primeiro o DID Twilio sem desvio do número real, usando uma chamada direta para o DID.
2. Validar no Asterisk: `pjsip show endpoints`, `pjsip show endpoint twilio-inbound`, logs de INVITE e `Stasis` no contexto dedicado. Não considerar apenas SIP 200 como prova de áudio.
3. Ativar o desvio da MEO/Vodafone somente para uma janela curta e controlada, se o teste direto passar.
4. Fazer uma chamada real para `+351910293287`, confirmar chegada no worker antigo, áudio nos dois sentidos, organização correta, audit e `voice_calls`.
5. Para rollback, desativar o desvio na operadora e remover/desabilitar a associação do DID de teste ao trunk Twilio. O número Lumenva volta a seguir a configuração anterior da operadora.
6. Não apagar o endpoint `1000` nem alterar o contexto de teste durante esta operação.

## 7. Proteções contra fraude

- aceitar INVITE somente dos CIDRs Twilio confirmados;
- usar TLS/SRTP quando o trunk estiver homologado;
- não expor `from-user`/caller ID como autorização;
- não criar rota de saída para números arbitrários;
- manter `direct_media=no`, contexto dedicado e `Stasis` somente;
- limitar o DID/trunk a teste até existir política de custo e rate limit;
- manter fail2ban/firewall e monitorar tentativas rejeitadas;
- registrar metadados, não áudio ou segredos, e tornar o processamento de chamadas idempotente.

## Estado

Este documento e os dois templates são preparação versionada. Nenhuma conta Twilio foi criada, nenhum DID foi comprado, nenhuma senha foi criada, e nenhum arquivo foi aplicado em `/etc/asterisk`.
