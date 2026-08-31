# Asterisk-v2 + Pipecat prototype

Configuração versionada da prova de conceito isolada usada na VPS em 2026-08-31.
É uma instalação paralela: não substitui o Asterisk de produção (`5060`) nem o worker
`workers/voice-sip-worker/main.mjs`.

## Componentes

- Asterisk oficial `22.11.0`, compilado em `/opt/asterisk-v2/`.
- SIP UDP em `5061`.
- RTP UDP `10000–20000`.
- `chan_websocket` + `res_http_websocket`.
- `pipecat-ai==1.1.0` e `pipecat-asterisk==0.1.3` em `/opt/voice-vps-bench-v2/`.
- `OpenAIRealtimeLLMService` usando o modelo configurável por `OPENAI_REALTIME_MODEL`;
  o valor validado no protótipo foi `gpt-realtime`.

## Segredos

`OPENAI_API_KEY` é injetada em runtime pelo Infisical. A senha SIP de `1000` é mantida apenas
na configuração local protegida da VPS. Os placeholders deste diretório nunca devem ser
preenchidos e commitados.

## Dialplan

- `700`: gravação isolada (`Record()`), usado para provar RTP.
- `701`: encaminha para `WebSocket/pipecat-v2` com codec `slin16` e protocolo JSON.

## Execução da aplicação

```bash
export OPENAI_API_KEY="$(infisical secrets get OPENAI_API_KEY --env=prod --projectId=<PROJECT_ID> --plain --silent)"
/opt/voice-vps-bench-v2/bin/python /opt/voice-vps-bench-v2/pipecat_v2.py
```

O processo escuta apenas `127.0.0.1:7860`; o Asterisk conecta-se a ele através de
`websocket_client.conf`. Não iniciar esta configuração sem validar memória e sem manter o
firewall/RTP da instância isolada separado da produção.

## Estado da prova

O fluxo foi comprovado com WebSocket sintético e com ligação real controlada na instância
isolada. Robustez (reconexão, queda da API, chamadas longas, fallback e saudação de produção)
continua sendo Fase 2; este diretório registra o protótipo exato, não um pacote de produção.
