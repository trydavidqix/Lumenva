# Task 8 — tentativa de chamada real com Agent OS e `VOICE_MEDIA_LISTEN_MS=800`

Data da tentativa: 2026-08-31 (UTC)

## Escopo

Esta tentativa tinha dois objetivos: confirmar que o worker de produção continuava ativo
com `VOICE_MEDIA_LISTEN_MS=800` e medir o intervalo entre o fim da fala do interlocutor e o
início do primeiro áudio TTS do Agent OS.

O checkout observado foi `main` em `56260cea7736b9133db2fd816e5fdb8c5df3fa7f`. O ficheiro
`.infisical.json` não versionado foi preservado e não entra nesta evidência.

## Configuração confirmada antes da chamada

- Worker: `tsx workers/voice-sip-worker/main.mjs`, diretório `/opt/voice-prod-run/repo`.
- Porta de health: `8091`; `GET /healthz` respondeu `200` com `status=ok`.
- `VOICE_MEDIA_LISTEN_MS=800`.
- `VOICE_MEDIA_EXTERNAL_HOST` configurado para o IP público da VPS.
- Sidecar STT/TTS ativo em `127.0.0.1:8500`.
- Asterisk ativo com RTP `10000–20000` e SIP UDP `5060`.

Nenhum segredo, token, número de telefone, áudio ou identificador completo de chamada foi
registado neste documento.

## Método

O dono iniciou chamadas pelo softphone SIP registado como extensão de teste. O log do worker
foi monitorizado em tempo real. Foram procurados `StasisStart`, erros de encaminhamento,
`voice_media_*`, STT, turno Agent OS e TTS.

## Resultado observado

Foram observadas duas tentativas consecutivas durante a janela de monitorização:

1. Primeira tentativa: canal SIP entrou no bridge em `2026-08-31T10:37:21.925Z`; o canal
   RTP externo recebeu `StasisStart` em `2026-08-31T10:37:23.461Z`; chamada terminou em
   `2026-08-31T10:37:34.699Z`.
2. Segunda tentativa: canal SIP entrou no bridge em `2026-08-31T10:37:46.449Z`; o canal
   RTP externo recebeu `StasisStart` em `2026-08-31T10:37:48.056Z`; chamada terminou em
   `2026-08-31T10:37:59.853Z`.

Em ambas, o worker registou a rejeição:

```text
Asterisk ARI GET /ari/channels/<redacted>/variable?variable=SIP_CONNECTION_ID failed: 404
```

Não apareceu `voice_media_attach`, `voice_media_turn`, TTS ou qualquer marcador de primeira
resposta de áudio. Logo:

- áudio TTS do Agent OS: **não provado nesta tentativa**;
- timestamp de primeira resposta TTS: **não disponível**;
- latência fim-da-fala até TTS: **não mensurável**;
- `voice_calls`/`voice_call_events` para um turno Agent OS: **não provado**;
- resultado Task 8 nesta tentativa: **NOT_PROVEN**.

Os eventos RTP foram vistos no Asterisk, incluindo contadores RTP não nulos, portanto a falha
observada ocorreu no encaminhamento/identificação do evento pelo worker antes de qualquer turno
STT/Agent OS/TTS. Os muitos `voice_sip_event_rejected` de eventos Asterisk auxiliares não foram
tratados como sucesso nem como causa única além do erro explícito de `SIP_CONNECTION_ID`.

## Decisões

### Latência

Nenhuma decisão de aceitabilidade pode ser fechada com esta tentativa. O valor histórico de
aproximadamente `5.5–6s` continua uma referência de arquitetura, não uma medição nova com
`VOICE_MEDIA_LISTEN_MS=800`. Streaming/VAD incremental continua item futuro; não foi implementado.

### Processos manuais

Não foram parados nesta tentativa porque o worker manual ainda é necessário para reproduzir e
corrigir a falha de `SIP_CONNECTION_ID`. A unidade `voice-sip-worker.service` existente está
inativa e aponta para o runtime antigo `/opt/voice-sip-test`; não é uma migração systemd válida
do worker de produção. A decisão de desligar todos os processos manuais deve ser reaplicada
depois de uma tentativa live bem-sucedida ou de uma decisão explícita de abandono do teste.

Também foi observado um processo legado `audio_bridge_v15.mjs` em `/opt/voice-vps-bench`; ele
permanece fora do runtime do worker e não foi alterado.

## Limitações e próximo passo

Esta evidência documenta uma tentativa falhada, não uma prova de aceite. É necessário corrigir
ou explicar o `SIP_CONNECTION_ID` ausente no canal Asterisk usado pela chamada, repetir a
chamada com o worker ativo e capturar um log explícito de início TTS antes de decidir sobre
latência ou desligar os processos.

## Investigação posterior e correção mínima (2026-08-31)

A investigação reproduziu o silêncio sem alterar o código inicialmente. O `Dial` rejeitado e
os `ChannelVarset` de QoS foram classificados como ruído de eventos auxiliares: o Asterisk
continuou a enviar e receber RTP, com contadores `rxcount`/`txcount` não nulos. O worker também
chegou a chamar o sidecar `/stt`; o WAV temporário tinha `0,48s`, pico `96` e RMS `16,7`, sem
fala útil.

A causa confirmada foi vazamento de sessões: em cada desligamento, o Asterisk já tinha destruído
o canal quando o listener tentou hidratar `SIP_CONNECTION_ID`. O evento terminal era rejeitado
com `Asterisk ARI GET .../variable?variable=SIP_CONNECTION_ID failed: 404`; por isso o caminho
de `detach()` nunca era executado. As sessões RTP antigas continuavam ativas, acumulando canais
`UnicastRTP` e executando janelas STT silenciosas. A existência de múltiplos sockets RTP órfãos,
o `turn_capture.wav` continuamente sobrescrito e a ausência de qualquer pedido TTS confirmaram
o encadeamento.

Correção mínima aplicada em `workers/voice-sip-worker/main.mjs`: quando um evento terminal é
rejeitado por essa corrida, o worker extrai apenas o `channel.id` do payload já recebido e
desmonta a sessão de mídia correspondente antes de registar a rejeição. Não relaxa a validação
de tenant nem aceita eventos de início sem `SIP_CONNECTION_ID`.

Validação local: `node --check workers/voice-sip-worker/main.mjs` e suíte de voz, 46 testes,
`PASS`. Na VPS, o worker foi reiniciado com `VOICE_MEDIA_LISTEN_MS=800`, os canais de teste
órfãos foram encerrados e `/healthz` voltou a `status=ok` com contadores zerados. A nova ligação
live pós-correção ainda é necessária para confirmar áudio TTS e medir latência; até lá, Task 8
permanece `NOT_PROVEN`.

## Tentativa seguinte e correção do runtime (2026-08-31)

Uma nova chamada de aproximadamente 20 segundos foi observada após a correção de `detach`. O
log específico começou com `StasisStart` em `2026-08-31T10:56:39.552Z` e terminou em
`2026-08-31T10:57:00.238Z`. O Asterisk reportou `rxcount=1010` e `txcount=0` nesse canal.

O primeiro evento foi rejeitado antes de qualquer resolução de tenant ou criação de mídia:

```text
getaddrinfo EAI_AGAIN base
```

Não houve `/stt`, `/api/internal/voice/turn`, TTS nem sessão RTP criada pelo worker. A origem foi
confirmada no ambiente do processo: `SUPABASE_DB_URL` continha aspas simples literais porque o
restart anterior extraiu uma linha `.env` já quoted e passou o valor sem remover as aspas. O valor
efetivo começava com `'postgresql://` e terminava com `postgres'`, invalidando a resolução do
host e produzindo o erro DNS `base`.

O worker foi reiniciado com `SUPABASE_DB_URL` e `INTERNAL_SECRET` extraídos diretamente do
Infisical, sem materializar segredos no repositório nem na linha de comando. `psql` confirmou
`select 1` no URL extraído e `/healthz` voltou a `status=ok` com contadores zerados.

Esta chamada não mede latência e não valida áudio. É uma falha de runtime de configuração,
separada do vazamento de sessão RTP corrigido antes. Task 8 continua `NOT_PROVEN` até uma chamada
posterior confirmar `StasisStart` normalizado, `/stt`, Agent OS, TTS e retorno RTP.

## Ligação posterior após as duas correções (2026-08-31)

Foi observada uma ligação nova, distinta das anteriores, entre `2026-08-31T11:03:30.950Z`
e `2026-08-31T11:04:17.938Z`. O worker estava ativo desde `2026-08-31T10:59:17.416Z`, com
`VOICE_MEDIA_LISTEN_MS=800`, e não voltou a apresentar `getaddrinfo EAI_AGAIN base`.

### Cadeia confirmada

- `StasisStart` do canal SIP principal foi normalizado e encaminhado ao CRM; o banco criou a
  chamada e o evento `voice.active` em `2026-08-31T11:03:31.451Z`.
- O Asterisk reportou RTP bidirecional no fim da chamada: `rxcount=2301`, `txcount=2234`,
  perda zero nos campos RTPAUDIOQOS/RTPAUDIOQOSLOSS. O evento `Dial` rejeitado referia-se ao
  canal auxiliar `UnicastRTP`; `ChannelVarset` de QoS e esse `Dial` não interromperam o áudio
  RTP e foram classificados como eventos auxiliares não suportados.
- O sidecar recebeu pelo menos uma janela `/stt`: `/tmp/turn_capture.wav` foi atualizado em
  `2026-08-31T11:04:17.538Z`, com 2.428 samples, 0,3035 s, RMS aproximadamente 73,9 e pico
  308. O sinal gravado era praticamente silêncio, não fala útil.
- Não houve `voice_media_turn_failed`, `voice_media_attach_failed` ou
  `voice_sip_event_forward_failed`. Não houve TTS.
- Não houve execução Agent OS correlacionada no banco: a tabela `ai_agent_runs` não recebeu
  uma execução durante essa janela, e não há evento de turno no log do worker.

### Causa confirmada desta ligação

O worker chegou ao ciclo RTP -> `/stt`, mas o `/stt` devolveu texto vazio para as janelas
capturadas. Isso é demonstrado pelo caminho de controle: o código só chama
`brainClient.runTurn` depois de `heardText.trim()` não vazio; uma falha no STT, Agent OS ou TTS
teria emitido `voice_media_turn_failed`, que não apareceu. O WAV efetivamente persistido nessa
ligação contém apenas energia residual muito baixa. Portanto, o silêncio ouvido nessa chamada
aconteceu antes do Agent OS: não foi rejeição do `Dial`, não foi a corrida de `SIP_CONNECTION_ID`
no detach e não foi a configuração de banco quoted já corrigida.

O `detach` não deixou canais Asterisk ativos após o desligamento (`core show channels concise`
ficou vazio), e os contadores de health do worker permaneceram `forwardFailures=0`. A limpeza
interna da sessão não é exposta como métrica, portanto não se afirma mais do que essa evidência
permite.

### Limite da prova

Esta ligação confirmou RTP e `/stt`, mas não confirmou fala útil chegando ao decodificador nem
Agent OS/TTS. A causa imediata do zero áudio está confirmada como STT vazio sobre uma janela
quase silenciosa; a origem de essa janela não conter fala (microfone/interlocutor ou conteúdo
RTP) ainda requer captura de payload/energia durante uma nova fala real. Task 8 permanece
`NOT_PROVEN`; não há medição de latência válida nem decisão final sobre a arquitetura de
streaming/VAD.

## Medição após instrumentação com `VOICE_MEDIA_LISTEN_MS=800` (2026-08-31)

Antes desta medição, o processo vivo foi inspecionado: `VOICE_MEDIA_LISTEN_MS=800`, sidecar em
`127.0.0.1:8500`, worker em `/opt/voice-prod-run/repo`, porta `8091`, health `ok`. Logs
estruturados marcaram o fim da janela, `/stt`, `/turn`, `/speak` e primeiro frame, sem áudio,
transcript ou segredo. Os testes locais passaram: 46 testes de voz.

Foram observadas três ligações consecutivas. IDs foram redigidos; a correlação foi feita
internamente pelo `voice_call_id`.

### Ligação 1

- `StasisStart`/`voice.active`: `2026-08-31T11:21:25.074Z`.
- Fim da janela com fala: `2026-08-31T11:21:31.476Z`.
- `/stt` terminou: `2026-08-31T11:21:34.016Z` (`2.539s`, 13 caracteres).
- `/turn` terminou: `2026-08-31T11:21:34.083Z` (`67ms`, `blocked`).
- Primeiro frame após `/speak`: `2026-08-31T11:21:34.348Z` (`265ms`, 21.920 bytes).
- Total `StasisStart` -> primeiro frame: `9.274s`; janela -> primeiro frame: `2.872s`.

### Ligação 2

- `StasisStart`/`voice.active`: `2026-08-31T11:22:14.630Z`.
- Fim da janela com fala: `2026-08-31T11:22:25.367Z`.
- `/stt` terminou: `2026-08-31T11:22:27.574Z` (`2.207s`, 33 caracteres).
- `/turn` terminou: `2026-08-31T11:22:27.807Z` (`233ms`, `blocked`).
- Primeiro frame após `/speak`: `2026-08-31T11:22:27.978Z` (`171ms`, 21.456 bytes).
- Total `StasisStart` -> primeiro frame: `13.348s`; janela -> primeiro frame: `2.611s`.

### Ligação 3

- `StasisStart`/`voice.active`: `2026-08-31T11:22:49.466Z`.
- Fim da janela com fala: `2026-08-31T11:22:51.363Z`.
- `/stt` terminou: `2026-08-31T11:22:52.351Z` (`988ms`, 21 caracteres).
- `/turn` terminou: `2026-08-31T11:22:52.405Z` (`54ms`, `blocked`).
- Primeiro frame após `/speak`: `2026-08-31T11:22:52.603Z` (`197ms`, 21.456 bytes).
- Total `StasisStart` -> primeiro frame: `3.137s`; janela -> primeiro frame: `1.240s`.

### Decisão de latência

`800ms` está efetivamente aplicado e não explica sozinho a resposta de 12 segundos. Depois do
fim da janela, o custo variou de `1.240s` a `2.872s`: STT local `0.988–2.539s`, Agent OS/turn
`54–233ms`, e `/speak` até primeiro frame `171–265ms`. O total desde `StasisStart` também
inclui criação da ponte RTP e a duração da fala antes do fechamento da janela, por isso variou
de `3.137s` a `13.348s`.

Decisão: aceitar o comportamento atual como limitação temporária desta prova, registrar
streaming/VAD incremental e STT mais rápido como arquitetura futura, e não implementar streaming
agora. O componente variável dominante observado foi o STT local, não Agent OS nem TTS.

Nas três respostas instrumentadas, o `/turn` devolveu `kind=blocked`; o worker falou o texto
de fallback de 42 caracteres. Os timestamps provam RTP -> STT -> endpoint de turno -> TTS, mas
não provam uma resposta Agent OS speakable/autorizada. Isso é separado da latência e mantém a
prova de aceite do Agent OS incompleta.

## Investigação de `kind=blocked` (2026-08-31)

Os três turnos reais instrumentados (`11:21:34.083Z`, `11:22:27.807Z` e `11:22:52.405Z`) no
log do worker devolveram `kind=blocked`. A leitura do código mostra a causa exata, antes de
qualquer chamada ao supervisor ou ao kernel: `createVoiceTurnService` testa os agentes
`atendimento`, `sales` e `retention` com `createProductAgentVoiceDeliveryAuthorizer`; todas as
três definições têm `autonomyLevel: 'shadow'`, enquanto a política só permite `assisted`,
`autopilot_low_risk` e `autopilot_expanded`. O serviço retorna diretamente
`{ kind: 'blocked', reason: 'voice_delivery_not_authorized' }` quando nenhum dos três passa.

Não é guard de horário, conteúdo, STT, número ou falta de agente publicado do tenant. A consulta
ao banco confirmou que o tenant de teste possui agentes ativos/publicados, mas esses registros
nem entram neste guard: a política atual é estática nas definições de Product Agents. Não foi
alterado nenhum dado do tenant nem relaxada a governança. Para obter `kind=reply`, é necessária
uma decisão explícita de promoção de pelo menos um agente conversacional para uma autonomia
permitida para entrega de voz, ou uma política de voz separada aprovada; ambas são mudanças de
governança, não um reparo de infraestrutura.

O fix de cache de `SIP_CONNECTION_ID` foi validado localmente (listener + turn-service: 8 testes)
e subido no worker; uma nova ligação é necessária para provar `voice_calls.state=completed` no
hangup normal. O worker e o sidecar estão novamente ativos com `VOICE_MEDIA_LISTEN_MS=800` e
segredos do Infisical sem aspas literais.

### Processos manuais

Após a prova live, foram encerrados o worker SIP/BYOC, o sidecar STT/TTS e o bridge legado
`audio_bridge_v15.mjs`. A unidade `voice-sip-worker.service` antiga permanece inativa; não foi
promovida a systemd porque aponta para `/opt/voice-sip-test` e não é uma unidade versionada do
runtime de produção. Verificação posterior: portas `8091` e `8500` sem listener e nenhum canal
Asterisk de teste ativo.

### Resultado Task 8

Áudio bidirecional real e medição instrumentada: PASS. Latência conhecida, limitação futura e
destino dos processos documentados: PASS. O encerramento do ciclo de dados ainda não é PASS:
as chamadas continuam com `voice_calls.state=active`, porque os eventos terminais perdem a
hidratação de `SIP_CONNECTION_ID` após o canal ser destruído e são rejeitados pelo listener.
O `detach` de mídia já ocorre nessa corrida, mas a persistência `active` -> `completed` exigida
no plano não foi provada. Portanto a Task 8 global permanece `NOT_PROVEN` até corrigir/validar
esse lifecycle, sem reabrir o problema de RTP.

## Implementação de VAD orientado a silêncio (2026-08-31)

### Causa confirmada

O loop anterior fechava cada turno por `VOICE_MEDIA_LISTEN_MS`, enquanto o consumidor RTP
continuava a acumular pacotes durante STT, Agent OS e TTS. A janela nominal de 2500 ms podia
conter 3–8 s de áudio misturado com silêncio e áudio do próprio bot, fragmentando a
transcrição e contaminando o turno seguinte.

### Mudança

`workers/voice-sip-worker/main.mjs` agora usa um segmentador de atividade por payload RTP
μ-law. Mantém pre-roll de 160 ms, exige 180 ms mínimos de fala e encerra o segmento após 420 ms
de silêncio consecutivo. O consumidor RTP continua único durante a sessão, mas o turn loop
aguarda um segmento fechado em vez de um timer cego. Durante STT/turn/TTS, novos pacotes são
descartados e o segmentador é resetado para não transcrever o áudio do bot como fala do
chamador. `VOICE_MEDIA_LISTEN_MS` permanece apenas por compatibilidade.

Não foi adicionada biblioteca nem modelo: a inspeção da VPS mostrou `webrtcvad`, `silero_vad` e
`torch` ausentes, e `vad_filter` do faster-whisper só atua depois de o lote ser montado. O VAD
leve por energia evita download e footprint adicional na VPS.

### Validação interna

- `workers/voice-sip-worker/voice-activity.test.mjs`: 3 testes PASS — decodificação μ-law,
  pre-roll + corte após silêncio e rejeição de ruído curto.
- `node --check workers/voice-sip-worker/main.mjs`: PASS.
- `main.smoke.mjs` foi atualizado para enviar 240 ms de fala RTP sintética seguidos de 500 ms
  de silêncio antes de esperar `/stt`/`/turn`/`/speak`; permanece dependente de Postgres local
  e fica `SKIPPED` quando `SUPABASE_DB_URL` não está definido.
- Nenhuma ligação real foi feita ou solicitada.

Estado: implementação e teste unitário internos concluídos; a prova completa do worker com
Postgres e RTP sintético aguarda ambiente local com `SUPABASE_DB_URL`. Pronto para o
orquestrador decidir a próxima validação.
