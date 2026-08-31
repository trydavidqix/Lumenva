# Fallback Piper — teste sintético

## Método

- Pipeline isolado em `/opt/voice-vps-bench-v2/pipecat_v2.py`.
- Cliente WebSocket sintético enviou `MEDIA_START` com `format=slin16`, `ptime=20`, `optimal_frame_size=640` e 1 segundo de PCM a 16 kHz.
- OpenAI Realtime foi deliberadamente iniciado com `OPENAI_REALTIME_MODEL=gpt-invalid-test` para provocar `invalid_model`.
- O processo foi parado após o teste e a chave temporária removida; produção/Asterisk 5060 não foi tocada.

## Resultado

O log confirmou `openai_realtime_error code=invalid_model` e `openai_fallback_queued reason=realtime_error`. O fallback chamou o sidecar Piper existente em `127.0.0.1:8500`, converteu μ-law 8 kHz para PCM16 16 kHz e escreveu pelo `AsteriskWebsocketOutputTransport`.

Medição no cliente WebSocket:

```text
audio_frames 2
audio_bytes 83590
peak 32124
rms 7079.74
nonzero 41151
```

Isto prova payload de áudio não trivial, não apenas um `TTSSpeakFrame` enfileirado. O primeiro teste revelou uma corrida em que o flow controller ainda não existia; o código agora aguarda a negociação e usa a configuração fixa da instância v2 (`slin16`, 20 ms, 640 bytes) como recuperação se o erro Realtime ocorrer antes de `MEDIA_START` chegar ao output.

Memória após o teste: `MemAvailable=1.3GiB` (`free -h`); nunca caiu abaixo do limite crítico de 300 MiB.

## Regressão do fluxo normal

Após a correção, o pipeline foi reiniciado com o modelo válido `gpt-realtime`, sem erro forçado. O cliente sintético enviou áudio de fala produzido pelo mesmo sidecar Piper, seguido de 800 ms de silêncio para acionar o `server_vad` da Realtime API.

Resultado:

```text
input_pcm_bytes 82478
audio_frames 30
audio_bytes 563200
peak 28046
rms 3258.43
nonzero 274379
```

O log confirmou `pipeline_client_connected`, `MEDIA_START` válido (`slin16`, 20 ms, 640 bytes) e `pipeline_client_disconnected`, sem erros nem mensagens `Trying to process ... StartFrame not received`. O payload de saída inclui a saudação proativa e as respostas geradas pela OpenAI Realtime; a medição demonstra que áudio real continuou a sair pelo transporte depois da introdução do fallback Piper.

Memória no fim: `MemAvailable=1.2GiB`. O processo de teste e a chave temporária foram removidos.

## Investigação de fala espontânea — 2026-08-31 18:09

O log das chamadas reais de 18:05 continha apenas conexão e `MEDIA_START`; não continha `OPENAI_SEND`, eventos Realtime brutos nem traces de início de fala. A versão atualmente em execução também não tinha esses pontos de instrumentação no código. Eles foram reintroduzidos sem registrar corpos de áudio, texto completo ou segredos: apenas tipo do evento e, para diagnóstico, no máximo 120 caracteres de `delta`/`transcript`.

Teste sintético com 8 segundos de silêncio PCM (sem ruído):

```text
true_silence_seconds 8
audio_frames 12
audio_bytes 113920
```

O áudio de saída correspondeu a uma única saudação. Os traces mostraram exatamente um ciclo `response.done`, 11 deltas de transcript (`Olá! Bem-vindo! Como posso ajudar hoje?`) e nenhum `input_audio_buffer.speech_started`/`speech_stopped`, nenhum `response.create` adicional e nenhum erro. Portanto, o modelo não iniciou uma conversa repetida sozinho em silêncio verdadeiro. Ainda não é possível descartar falso positivo de VAD causado pelo áudio RTP real; esse é o próximo teste isolado, com ruído controlado.

## Hipótese 2 — ruído baixo/comfort noise

Foram abertas três sessões sintéticas, sem fala, com ruído PCM uniforme limitado a amplitudes ±30, ±120 e ±300, durante 10 segundos cada. O cliente aguardou o encerramento de cada saudação antes de fechar a sessão.

Em conjunto, os traces mostraram três `session.created`, três `response.done` e três `response.output_audio.done`: exatamente uma resposta por sessão, correspondente à saudação proativa. Não apareceu qualquer `input_audio_buffer.speech_started`, `input_audio_buffer.speech_stopped` ou `response.create` adicional.

Conclusão: falso positivo do `server_vad` não foi reproduzido com os níveis de comfort noise testados. Não foi aplicado threshold local nem outro terceiro fix. O comportamento observado pelo dono continua sem causa confirmada e requer captura/medição do RTP real de uma chamada antes de qualquer mitigação.

## Supressão de eco durante fala do bot — teste 2026-08-31

O Context7/documentação oficial do Pipecat recomenda `AlwaysUserMuteStrategy` em `LLMUserAggregatorParams` para suprimir entrada do utilizador enquanto o bot fala. Como o teste anterior ainda permitiu um `speech_started` no eco tardio, foi acrescentado também um `EchoSuppressor` local: descarta `InputAudioRawFrame` durante deltas de áudio do bot e por 800 ms após `response.output_audio.done`.

Teste sintético: a saudação foi reproduzida e cada frame de áudio de saída foi imediatamente reenviado como entrada (eco), sem qualquer fala do utilizador.

```text
greeting_echo_output_frames 8
echoed 8
response.done: 1
input_audio_buffer.speech_started: 0
input_audio_buffer.speech_stopped: 0
response.create adicional: 0
```

O eco foi totalmente impedido de iniciar um novo turno Realtime. A produção não foi alterada.

## Cooldown de 3 segundos — reprodução do atraso real

O `EchoSuppressor` foi aumentado de 800 ms para 3000 ms, cobrindo os atrasos de 1,52 s e 2,24 s medidos na captura SIP. No teste sintético, cada frame da saudação foi reenviado como eco exatamente 2 segundos depois de ser recebido, enquanto ruído residual baixo continuava no input.

Resultado: 7 frames de eco agendados, uma única resposta (saudação), zero `input_audio_buffer.speech_started`, zero `input_audio_buffer.speech_stopped`, zero `response.create` adicional e zero erros. O eco dentro da janela de 3 segundos não abriu novo turno.

## Semantic VAD — teste de eco residual 2026-08-31

Context7 confirmou que o Pipecat expõe `SemanticTurnDetection` com `type="semantic_vad"` e `eagerness` válido em `low`, `medium`, `high` ou `auto`; `create_response` e `interrupt_response` controlam criação automática e interrupção. Foi escolhido `eagerness="low"`, `create_response=True` e `interrupt_response=False` para esperar fala real e não interromper o bot.

Teste sintético: enquanto a saudação era reproduzida, foram enviados vários segundos de ruído residual ±300 e cada frame de saída foi reenviado como eco. Resultado: 8 frames de saída ecoados, uma única resposta/saudação, zero `input_audio_buffer.speech_started`, zero `input_audio_buffer.speech_stopped`, zero `response.create` adicional e zero erros.

## Mitigação VAD e saudação literal — teste 2026-08-31

Foi configurado `server_vad` na sessão Realtime com `threshold=0.68`, `prefix_padding_ms=300` e `silence_duration_ms=750`. A saudação inicial passou a interceptar o primeiro `response.create` e incluir `response.instructions` explícito: `Diga exatamente, palavra por palavra, sem adicionar nada: Boa tarde! Em que posso te ajudar?`.

Com 10 segundos de ruído PCM sem fala, amplitude ±300, os traces mostraram 500 `input_audio_buffer.append`, uma única saudação e zero eventos `input_audio_buffer.speech_started`/`speech_stopped` ou `response.create` adicional. A transcript recebida foi exatamente `Boa tarde! Em que posso te ajudar?`, distribuída pelos deltas `Boa`, `tarde`, `!`, `Em`, `que`, `posso`, `te`, `ajudar`, `?`. Não houve erros.
