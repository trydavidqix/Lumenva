# Runbook — Twilio ↔ Asterisk ↔ Lumenva Notification Router

**Branch de implementação:** `voz`  
**Status:** preparado para ativação externa; não aplicar em produção antes dos gates.  
**Regra:** segredos ficam no Infisical/secret store, nunca neste repositório.

## 1. Arquitetura canônica

Outbound:

```text
cron_jobs
  -> job_queue(notification_delivery)
  -> Notification Router
  -> Voice route
  -> voice-sip-worker /v1/calls
  -> Asterisk ARI
  -> PJSIP/twilio-outbound
  -> Twilio Elastic SIP Trunk
  -> PSTN
```

Inbound:

```text
PSTN
  -> Twilio DID
  -> Twilio Origination URI
  -> Asterisk twilio-inbound
  -> voice-inbound-twilio
  -> Stasis(voicecore-test)
  -> Voice Core
```

WhatsApp:

```text
cron_jobs
  -> notification_delivery
  -> sendMessageHandler
  -> WAHA
```

Maestri não participa do caminho fixo.

## 2. Contrato de identidade do trunk

O novo caminho usa um identificador lógico único:

`twilio-outbound`

Ele deve ser, ao mesmo tempo:

1. `voice_sip_connections.external_connection_id`;
2. nome do endpoint PJSIP usado pelo outbound;
3. valor de `SIP_CONNECTION_ID` injetado no inbound.

Isso permite que o Voice Core resolva tenant pela conexão verificada sem confiar em Caller ID como autoridade.

## 3. Twilio Console — ação do owner

No Twilio Console:

1. Abra **Elastic SIP Trunking**.
2. Crie um trunk dedicado à Lumenva.
3. Em **Termination**:
   - defina um Termination SIP URI exclusivo;
   - para a VPS europeia, prefira uma URI localizada em Dublin ou Frankfurt;
   - configure Credential List;
   - opcionalmente acrescente IP ACL; se usar os dois, os dois serão exigidos.
4. Em **Origination**:
   - adicione `sip:<ASTERISK_PUBLIC_FQDN_OR_IP>:5060` ou a porta/transporte homologados;
   - não use `sips:`; para TLS a Twilio documenta `sip:` com `transport=tls`.
5. Em **Numbers**, associe somente o DID comprado para o teste.
6. Em **Voice Geographic Permissions**, habilite apenas os destinos necessários, inicialmente Portugal.
7. Configure alertas/limites de gasto.
8. Guarde, fora do chat/Git:
   - SIP username;
   - SIP password;
   - qualquer API key usada para automação administrativa.

Documentação oficial:
- https://www.twilio.com/docs/sip-trunking
- https://www.twilio.com/docs/sip-trunking/sending-sip-to-twilio-best-practices
- https://www.twilio.com/docs/sip-trunking/troubleshooting

## 4. Infisical

Criar/confirmar no ambiente da VPS:

```text
INTERNAL_SECRET=<mesmo segredo usado pelo CRM/voice worker>
TWILIO_SIP_USERNAME=<credential list username>
TWILIO_SIP_PASSWORD=<credential list password>
```

Os dois últimos são usados apenas para renderizar/aplicar a configuração Asterisk; não são necessários no código TypeScript nem devem entrar no Git.

No worker do CRM:

```text
NOTIFICATION_ROUTER_ENABLED=true
VOICE_NOTIFICATION_ENABLED=true
```

Manter ambos `false` até o trunk e o Asterisk passarem pelo teste direto.

## 5. Renderizar Asterisk

Templates versionados:

- `ops/voice-asterisk/twilio-inbound.disabled.conf.example`
- `ops/voice-asterisk/extensions-twilio-inbound.disabled.conf.example`
- `ops/voice-asterisk/twilio-outbound.disabled.conf.example`
- `ops/voice-asterisk/extensions-twilio-outbound.disabled.conf.example`

Renderizar para arquivos fora do Git com os valores reais.

Não alterar/remover o endpoint de teste existente `1000` durante o rollout.

### Outbound

O endpoint PJSIP deve se chamar exatamente:

`twilio-outbound`

O Termination URI deve ser o domínio real do trunk, por exemplo:

`<TRUNK>.pstn.dublin.twilio.com`

Não registrar o trunk. Twilio Elastic SIP Trunking usa Termination URI + autenticação, não SIP REGISTER.

### Dialplan

O ARI origina:

`PJSIP/<DESTINO_E164>@twilio-outbound`

e configura:

- `SIP_CONNECTION_ID=twilio-outbound`
- `VOICE_DIRECTION=outbound`
- `VOICE_CALL_ID=<voice_calls.id>`

Após atendimento, o canal entra em:

`[voice-outbound-twilio] / s / 1 -> Stasis(voicecore-test)`

## 6. Banco

Depois do trunk existir, criar uma conexão verificada para a organização correta.

Modelo conceitual — substituir somente os placeholders não secretos:

```sql
insert into voice_sip_connections
  (organization_id, gateway, external_connection_id, verified, enabled)
values
  ('<ORG_UUID>', 'asterisk', 'twilio-outbound', true, true);
```

Associar o DID já comprado:

```sql
insert into voice_phone_numbers
  (organization_id, provider, phone_e164, enabled, connection_id, ownership_verified_at)
select
  '<ORG_UUID>',
  'asterisk',
  '<TWILIO_DID_E164>',
  true,
  id,
  now()
from voice_sip_connections
where organization_id = '<ORG_UUID>'
  and gateway = 'asterisk'
  and external_connection_id = 'twilio-outbound';
```

Associar o control endpoint HTTPS do SIP worker em `voice_worker_endpoints.connection_id`.

Antes de habilitar voz no Notification Router, criar a política fail-closed do tenant. Durante o rollout inicial, autorize **somente o telefone físico de teste**:

```sql
insert into notification_delivery_policies (
  organization_id,
  timezone,
  voice_escalation_enabled,
  allowed_voice_destinations,
  whatsapp_max_attempts,
  voice_max_attempts,
  max_voice_calls_per_hour,
  max_voice_calls_per_day,
  voice_cooldown_seconds,
  quiet_hours_start,
  quiet_hours_end
)
values (
  '<ORG_UUID>',
  'Europe/Lisbon',
  true,
  array['<TEST_DESTINATION_E164>']::text[],
  2,
  1,
  2,
  4,
  600,
  '22:00',
  '07:00'
)
on conflict (organization_id) do update set
  voice_escalation_enabled = excluded.voice_escalation_enabled,
  allowed_voice_destinations = excluded.allowed_voice_destinations,
  updated_at = now();
```

A allowlist é de correspondência E.164 exata. Lista vazia = nenhuma chamada outbound permitida. A aplicação também aplica cooldown e tetos horários/24h antes de reservar `voice_calls`; duas reservas concorrentes da mesma organização são serializadas por advisory lock.

Nunca criar duas rotas Asterisk habilitadas para a mesma organização sem seleção explícita: o resolver falha fechado em ambiguidade.

## 7. Reload controlado

Antes:

```bash
asterisk -rx "pjsip show endpoints"
asterisk -rx "core show channels concise"
```

Depois de instalar as configurações renderizadas:

```bash
asterisk -rx "pjsip reload"
asterisk -rx "dialplan reload"
asterisk -rx "pjsip show endpoint twilio-outbound"
asterisk -rx "pjsip show endpoint twilio-inbound"
```

Reiniciar o voice SIP worker somente depois que o Asterisk aceitar a configuração.

## 8. Firewall

Liberar somente sinalização/mídia necessárias de acordo com a lista oficial atual da Twilio.

Não copiar IPs antigos de blog/issue para firewall permanente.

Fonte canônica:
https://www.twilio.com/docs/sip-trunking

Manter:

- ARI em loopback/rede privada;
- fail2ban;
- `direct_media=no`;
- nenhuma rota pública para originar número arbitrário.

## 9. Gate A — inbound

1. Flags de Notification Router podem continuar OFF.
2. Ligar de outro telefone para o DID Twilio.
3. Confirmar no Twilio que o INVITE foi originado.
4. Confirmar no Asterisk:
   - endpoint identificado;
   - contexto `voice-inbound-twilio`;
   - `SIP_CONNECTION_ID=twilio-outbound`;
   - `StasisStart`.
5. Confirmar no CRM:
   - tenant correto;
   - `voice_calls.provider='asterisk'`;
   - estado chega a terminal no hangup.
6. Confirmar áudio nos dois sentidos.

PASS exige áudio + lifecycle, não apenas SIP 200.

## 10. Gate B — outbound direto

Antes de ligar o Notification Router:

1. manter destination allowlist limitada ao telefone de teste;
2. originar uma única chamada governada;
3. confirmar Request-URI E.164 para o Termination URI Twilio;
4. telefone real deve tocar;
5. atender;
6. confirmar:
   - `VOICE_CALL_ID` preservado;
   - `connecting -> active -> completed`;
   - áudio bidirecional;
   - nenhum segundo `voice_calls` criado pelo `StasisStart`.

## 11. Gate C — WAHA

Com `NOTIFICATION_ROUTER_ENABLED=true` e voz ainda OFF:

1. criar reminder pela rota interna;
2. cron dispara `notification_delivery(initial)`;
3. WhatsApp chega via pipeline existente;
4. mensagem contém `CONFIRMAR XXXXXX`;
5. responder exatamente o token;
6. `notification_requests.status='acknowledged'`;
7. o token não deve gerar turno de IA.

## 12. Gate D — escalada

Depois do Gate B:

1. `VOICE_NOTIFICATION_ENABLED=true`;
2. criar reminder com grace period curto de teste;
3. não responder no WhatsApp;
4. cron de phase `voice` dispara;
5. Notification Router reserva `voice_call_id` antes do dial;
6. telefone toca uma vez;
7. retry não pode duplicar uma chamada que já esteja `connecting/active/completed`.

## 13. Mensagem padrão

O default deliberadamente não expõe dados sensíveis:

> Tens um lembrete programado. Confere a aplicação para os detalhes.

O WhatsApp acrescenta apenas o token operacional de confirmação.

## 14. Rollback

Ordem:

1. `VOICE_NOTIFICATION_ENABLED=false`;
2. `NOTIFICATION_ROUTER_ENABLED=false`;
3. desabilitar `twilio-outbound`/origination no trunk;
4. reload Asterisk;
5. manter tabelas e histórico;
6. não apagar migrations;
7. não remover o caminho Telnyx legado até a nova rota passar os live gates.

## 15. Critério de ativação

Só marcar LIVE depois de:

- inbound PASS;
- outbound PASS;
- WhatsApp PASS;
- acknowledgement PASS;
- escalada PASS;
- idempotência observada em retry;
- firewall/Geo Permissions/spend limits revisados;
- nenhum secret presente no Git/log.
