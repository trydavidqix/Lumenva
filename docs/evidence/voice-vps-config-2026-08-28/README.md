# Configuração real da VPS de voz — 2026-08-28

## Escopo

Leitura remota da VPS `lumenva-crm` (`root@2.29.8.225`). Nenhuma configuração foi alterada,
nenhum serviço foi reiniciado e nenhum segredo foi copiado.

## Asterisk

- Versão: `Asterisk 22.5.2~dfsg+~cs6.15.60671435-1`.
- Binário: `/usr/sbin/asterisk`.
- Instalação: pacote Debian (`dpkg`); serviço nativo `asterisk.service` ativo.
- Transporte PJSIP: UDP em `0.0.0.0:5060`.
- ARI: ativo somente em `127.0.0.1:8088`.
- ARI TLS: não configurado no endpoint observado.
- Endpoint de teste: `1000`, contexto `voicecore-test`, codecs `ulaw` e `alaw`,
  `direct_media=no`, máximo de um contacto.
- Estado observado do endpoint `1000`: `Unavailable`, sem contacto registado no momento da leitura.
- Nenhum trunk SIP/BYOC de operadora foi criado nesta tarefa.

## Dialplan observado

O contexto `voicecore-test` contém:

```text
[voicecore-test]
exten => _X.,1,NoOp(VoiceCore test call from ${CALLERID(num)})
 same => n,Answer()
 same => n,Stasis(voicecore-test)
 same => n,Hangup()
```

O código de produção deve definir `SIP_CONNECTION_ID` antes de entrar em `Stasis`, conforme o
contrato do Voice Core. O valor real de qualquer variável/segredo não foi incluído aqui.

## Worker SIP/BYOC

- Unidade: `voice-sip-worker.service`.
- Estado observado: `active (running)`.
- `WorkingDirectory`: `/opt/voice-sip-test`.
- `ExecStart`: shell que lê usuário/senha ARI do ficheiro local e inicia o worker com `tsx`.
- `ARI_BASE_URL`: `http://127.0.0.1:8088`.
- `ARI_APP_NAME`: `voicecore-test`.
- `SIP_OUTBOUND_CONTEXT`: `voicecore-test`.
- `VOICE_CONTROL_PLANE_URL`: `https://crm.lumenva.pt`.
- Porta de healthcheck: `8091`.
- Secrets (`ARI_PASSWORD`, `INTERNAL_SECRET`, `SUPABASE_DB_URL`) existem apenas via ficheiros de
  ambiente locais e foram redigidos.
- O serviço corre como `root` para este teste; isso não é a configuração final de hardening.
- `NoNewPrivileges=true`, `PrivateTmp=true` e `Restart=on-failure` estão definidos na unidade;
  `User=root` continua sendo um risco de hardening a corrigir antes de produção.

## Resultado

- Asterisk real acessível e ativo: confirmado.
- ARI real autenticável: confirmado anteriormente e serviço ligado.
- Worker de teste ativo: confirmado.
- Softphone/endpoint registado no instante desta leitura: não; `1000` estava `Unavailable`.
- Chamada SIP/PSTN completa com áudio de IA: não provada.

## Limites

Este documento é evidência de configuração, não receita para produção. Não contém credenciais,
IP de operadora, senha SIP, `INTERNAL_SECRET`, URL de banco nem tokens.
