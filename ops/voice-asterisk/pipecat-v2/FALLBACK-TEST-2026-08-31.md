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
