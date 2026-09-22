# Plano — Voice Notifications: Twilio + Asterisk + WAHA

**Branch:** `voz`  
**Base:** `lumenva-command-center`  
**Repositório:** `trydavidqix/Lumenva`  
**Status inicial:** PLANNED  
**Regra:** não fazer merge para `main` sem autorização explícita do dono.

---

## 1. Objetivo

Transformar a infraestrutura de voz e WhatsApp já existente na Lumenva em um sistema de notificações confiável capaz de:

1. enviar WhatsApp automaticamente pelo WAHA;
2. ligar para um número real pelo Twilio usando o Asterisk/Voice Core existente;
3. receber chamadas no número Twilio e entregá-las ao Voice Core;
4. registrar entrega, resposta, falha, retry e acknowledgement;
5. permitir escalada simples:
   - primeiro WhatsApp;
   - se não houver confirmação dentro da política configurada;
   - realizar chamada telefónica;
6. manter o Maestri fora do caminho crítico das notificações fixas;
7. permitir uso do Maestri apenas quando a decisão realmente exigir raciocínio/orquestração.

O sistema final deve suportar:

```text
Scheduler
  -> Notification Router
      -> WAHA -> WhatsApp
      -> Voice Outbound -> Asterisk -> Twilio -> PSTN/iPhone
```

E inbound:

```text
PSTN/iPhone
  -> número Twilio
  -> Twilio SIP Trunk
  -> Asterisk
  -> Voice Core
  -> Agent OS
```

---

## 2. Decisões arquiteturais

### 2.1 Twilio é carrier, Asterisk continua sendo o gateway interno

Não espalhar `twilio` como provider interno por todo o domínio se não for necessário.

Para o caminho novo:

- carrier externo: Twilio;
- gateway interno: Asterisk;
- provider persistido no Voice Core: `asterisk`, quando a chamada passa pelo Asterisk;
- Twilio fica encapsulado na borda SIP.

Isso aproveita as migrations e contratos já existentes para:

- `voice_sip_connections`;
- `voice_phone_numbers`;
- `voice_worker_endpoints`;
- `voice_calls.provider = 'asterisk'`;
- resolução tenant-safe por conexão SIP verificada.

### 2.2 WAHA continua sendo o canal WhatsApp

Não usar Twilio para WhatsApp.

O repo já possui:

- cliente WAHA;
- envio;
- webhook;
- ingestão;
- mídia;
- retry;
- action `send_whatsapp_message`.

Logo:

```text
Notification Router -> WAHA
```

é o caminho canônico de WhatsApp.

### 2.3 Maestri não fica no caminho obrigatório

Para lembretes fixos:

```text
Scheduler -> Notification Router -> WAHA/Twilio
```

Maestri só participa quando houver necessidade de decisão inteligente, por exemplo:

- escolher canal com base em contexto;
- reagendar com base em calendário;
- interpretar resposta livre;
- aplicar política dinâmica;
- gerar brief;
- coordenar vários agents.

### 2.4 Sem segredos no Git

Segredos ficam no Infisical ou secret store autorizado.

Nunca versionar:

- Twilio Auth Token;
- API Secret;
- SIP Credential List secret;
- ARI password;
- INTERNAL_SECRET;
- chaves TTS/STT;
- números privados adicionais quando não forem necessários no código.

O Git contém somente:

- nomes de env vars;
- templates;
- IDs não secretos quando apropriado;
- documentação operacional;
- testes.

---

## 3. Estado já existente no repositório

### 3.1 WAHA

Já existe implementação relevante em:

- `apps/crm/lib/waha/**`;
- `apps/crm/lib/automation/actions/send-whatsapp.ts`;
- `apps/crm/app/api/v1/webhooks/waha/**`;
- adapters e engines de canal;
- testes de WAHA.

Não reimplementar envio WhatsApp.

### 3.2 Voice outbound legado

Já existe:

- `POST /api/v1/voice/calls`;
- `apps/crm/lib/voice/outbound/service.ts`;
- `apps/crm/lib/voice/outbound/production.ts`;
- `workers/voice-worker/control-server.mjs`;
- endpoint interno `POST /v1/calls`;
- registry de chamadas outbound pendentes;
- criação e lifecycle em `voice_calls`.

Problema atual:

- o production outbound cria chamada com `provider='telnyx'`;
- o worker legado instancia `Telnyx(...)`;
- este caminho não deve ser o destino final da integração Twilio+Asterisk.

### 3.3 Asterisk / SIP / Voice Core

Já existe:

- Asterisk real;
- ARI;
- SIP gateway;
- listener;
- event forwarder;
- media bridge;
- Voice SIP worker;
- STT/TTS adapters;
- Agent OS integration;
- migrations de conexão SIP;
- testes e evidências de chamadas reais.

Arquivos principais:

- `apps/crm/lib/voice/sip/**`;
- `apps/crm/workers/voice-sip-worker/**`;
- `workers/voice-sip-worker/**`;
- `ops/voice-asterisk/**`;
- `supabase/migrations/20260827160000_0131_voice_sip_connections.sql`;
- `supabase/migrations/20260830190000_0133_voice_calls_provider_asterisk.sql`.

### 3.4 Preparação Twilio já existente

Já existem:

- `docs/guides/2026-08-31-owner-guide-twilio-meo-vodafone-bridge.md`;
- `ops/voice-asterisk/twilio-inbound.disabled.conf.example`;
- `ops/voice-asterisk/extensions-twilio-inbound.disabled.conf.example`.

Esses templates são preparação e continuam desativados.

---

## 4. Arquitetura alvo

### 4.1 Outbound

```text
Scheduler
  -> Notification Router
      -> Voice Notification Adapter
          -> Voice Outbound Service
              -> Asterisk Originator
                  -> PJSIP endpoint do Twilio
                      -> Twilio SIP Trunk
                          -> PSTN
                              -> telefone destino
```

### 4.2 Inbound

```text
PSTN
  -> Twilio DID
      -> Twilio Elastic SIP Trunk
          -> Asterisk PJSIP
              -> contexto dedicado
                  -> Set(SIP_CONNECTION_ID=...)
                  -> Stasis(...)
                      -> Voice SIP Worker
                          -> Voice Core / Agent OS
```

### 4.3 WhatsApp

```text
Scheduler
  -> Notification Router
      -> WAHA adapter
          -> WhatsApp
```

### 4.4 Escalada

```text
reminder_due
  -> send WhatsApp
  -> delivery status = delivered
  -> aguarda acknowledgement

se acknowledged:
  -> complete

se timeout:
  -> call via Asterisk/Twilio

se call answered:
  -> mark acknowledged/completed conforme regra

se falhar:
  -> retry limitado
  -> depois failed/escalated
```

---

## 5. Configuração externa Twilio necessária

O número já foi comprado. Antes de qualquer ativação live, confirmar no Twilio Console:

1. DID comprado;
2. capacidade Voice habilitada;
3. Elastic SIP Trunk criado;
4. DID associado ao trunk;
5. Origination configurada para o Asterisk;
6. Termination URI configurada;
7. autenticação escolhida:
   - IP ACL, preferencialmente quando aplicável;
   - ou Credential List;
8. Voice Geographic Permissions para Portugal e demais destinos explicitamente autorizados;
9. região/edge selecionado;
10. codec compatível com Asterisk:
    - PCMU/ulaw;
    - PCMA/alaw quando necessário;
11. TLS/SRTP somente depois de validar compatibilidade ponta a ponta;
12. signaling CIDRs/FQDNs oficiais usados na allowlist;
13. billing e limites de gasto configurados.

### Dados não secretos a registrar no plano operacional

- Twilio DID em E.164;
- nome/ID do trunk;
- termination SIP domain;
- origination target do Asterisk;
- transporte;
- região/edge;
- lista oficial de CIDRs/FQDNs;
- política TLS/SRTP;
- países permitidos.

### Segredos

Devem entrar no Infisical:

- SIP username/password se Credential List for usada;
- API key/secret se houver automação via REST;
- qualquer token Twilio.

---

## 6. Fases de implementação

# Fase 0 — Baseline e gates

Antes de alterar código:

1. registrar HEAD inicial da branch `voz`;
2. executar os testes atuais de voice e WAHA;
3. guardar resultado dos gates;
4. validar migrations aplicadas/esperadas;
5. confirmar que nenhum segredo existe no diff;
6. não tocar na `main`.

Critério de saída:

- baseline conhecido;
- nenhum teste quebrado antes do trabalho.

---

# Fase 1 — Provider-neutral outbound

Objetivo: remover o acoplamento lógico do outbound a Telnyx.

Hoje `apps/crm/lib/voice/outbound/production.ts` grava `provider='telnyx'`.

Alterar para que o provider seja determinado pela rota real.

Preferência:

- caminho SIP/Asterisk grava `provider='asterisk'`;
- caminho legado Telnyx continua possível apenas como rollback enquanto existir.

Criar abstração clara, por exemplo:

```ts
interface VoiceDialer {
  provider: 'asterisk' | 'telnyx'
  dial(input): Promise<...>
}
```

Não duplicar o domínio de outbound.

Critérios:

- testes cobrem provider correto;
- Telnyx não é escolhido implicitamente;
- fail-closed quando routing for ambíguo.

---

# Fase 2 — Resolver outbound por SIP connection

O `resolveWorker()` atual depende do caminho antigo `voice_phone_numbers -> voice_worker_endpoints`.

Adicionar resolução canônica para:

```text
organization
  -> verified+enabled voice_sip_connections
  -> enabled voice_worker_endpoints
  -> Asterisk route
```

Regras:

- exatamente uma rota elegível para outbound, salvo seleção explícita;
- conexão não verificada nunca pode originar chamada;
- organização nunca vem do body como autoridade;
- destino deve estar em E.164;
- source DID deve pertencer ao tenant/conexão autorizada.

---

# Fase 3 — Twilio inbound no Asterisk

Partir dos templates já existentes.

Criar configuração versionada segura para:

- endpoint `twilio-inbound`;
- identify/allowlist;
- contexto `voice-inbound-twilio`;
- codecs;
- `direct_media=no`;
- `SIP_CONNECTION_ID`;
- `Stasis(...)`.

Não colocar valores secretos no Git.

Gates:

- `pjsip show endpoint twilio-inbound`;
- INVITE recebido;
- DID esperado apenas;
- tenant resolvido pela connection;
- chamada aparece em `voice_calls`;
- áudio bidirecional;
- hangup fecha lifecycle.

---

# Fase 4 — Twilio outbound no Asterisk

Adicionar endpoint/registration/AOR/auth de saída conforme o modo escolhido no Twilio.

Criar dialplan outbound dedicado, sem rota arbitrária.

Exemplo conceitual:

```text
[voice-outbound-twilio]
exten => _X.,1,NoOp(...)
 same => n,Dial(PJSIP/...@twilio-outbound)
 same => n,Hangup()
```

A implementação real deve evitar catch-all inseguro.

Preferência:

- allowlist de destinos/política no aplicativo;
- Asterisk recebe destino já autorizado;
- sem CLI/HTTP público permitindo discar qualquer número.

O Asterisk deve originar a chamada via ARI ou adapter dedicado.

Adicionar ao ARI client capacidade necessária para originate se ainda não existir.

A chamada deve carregar:

- `voice_call_id`;
- connection id;
- tenant context;
- caller/source DID;
- destino E.164;
- correlation id.

---

# Fase 5 — Asterisk Outbound Adapter

Criar um adapter explícito no domínio de voz.

Sugestão de localização:

`apps/crm/lib/voice/outbound/asterisk-adapter.ts`

Responsabilidades:

1. validar E.164;
2. validar connection ativa;
3. registrar/reservar outbound;
4. mandar comando ao worker/Asterisk;
5. correlacionar provider call/channel id;
6. atualizar lifecycle;
7. retornar erro tipado.

Não colocar lógica de negócio do Notification Router dentro do adapter.

---

# Fase 6 — Endpoint interno de notificação por chamada

Criar boundary interno, por exemplo:

`POST /api/internal/notifications/voice`

ou reutilizar a API de voice existente quando isso não duplicar domínio.

Entrada mínima:

```json
{
  "contact_id": "...",
  "purpose": "reminder",
  "notification_id": "...",
  "message": "..."
}
```

Regras:

- autenticação interna;
- nenhum número arbitrário vindo do cliente;
- resolver telefone pelo contact;
- message com tamanho limitado;
- idempotency key obrigatória;
- rate limit;
- audit.

Se a API pública `/api/v1/voice/calls` já atender corretamente, preferir reutilizá-la internamente em vez de duplicar.

---

# Fase 7 — Notification Router

Criar módulo canônico de entrega.

Responsabilidades:

- receber evento de notificação;
- escolher canais permitidos;
- registrar attempts;
- enviar;
- observar status;
- aplicar retry;
- escalada;
- acknowledgement;
- deduplicação.

Contrato conceitual:

```ts
type NotificationChannel = 'whatsapp' | 'voice' | 'email' | 'push'

interface NotificationDelivery {
  notificationId: string
  channel: NotificationChannel
  recipientId: string
  status: 'queued' | 'sent' | 'delivered' | 'acknowledged' | 'failed'
  attempt: number
  idempotencyKey: string
}
```

Antes de criar tabela nova:

- procurar schema existente de notifications/delivery;
- reutilizar estruturas atuais quando suficientes;
- migration nova somente se houver lacuna real.

---

# Fase 8 — Integração WAHA no Notification Router

Usar o action/handler já existente.

Não criar segundo cliente WAHA.

Fluxo:

```text
Notification Router
  -> sendMessageHandler / action existente
  -> WAHA
```

Adicionar metadata/correlation:

- notification_id;
- delivery_attempt_id;
- rule_id;
- contact_id.

---

# Fase 9 — Acknowledgement

Para WhatsApp:

- reconhecer uma resposta explícita autorizada;
- mapear mensagem ao reminder/notification ativo;
- marcar como acknowledged;
- cancelar escalada futura.

A resposta não deve depender de interpretação livre por LLM para um simples "confirmar".

Preferir caminhos determinísticos:

- botão;
- palavra-chave;
- reply correlacionado;
- token curto.

Para chamada:

- opção futura de DTMF;
- ou considerar answered como acknowledgement somente se a política específica permitir.

Não assumir que "tocou" = "confirmado".

---

# Fase 10 — Scheduler

Conectar eventos agendados ao Notification Router.

Para rotina fixa:

```text
schedule_due
 -> create notification
 -> deliver WhatsApp
 -> schedule escalation deadline
```

O Scheduler deve ser:

- timezone-aware;
- idempotente;
- persistente;
- recuperável após restart;
- sem depender de processo em memória para deadlines importantes.

Timezone padrão operacional do owner:

`Europe/Lisbon`

mas o domínio deve suportar timezone por tenant/usuário.

---

# Fase 11 — Política de escalada

Configuração inicial:

```text
T0 -> WhatsApp
T0 + X -> se não acknowledged, ligação
```

Parâmetros configuráveis:

- grace period;
- retries WhatsApp;
- retries voice;
- quiet hours;
- allowed destinations;
- max calls/day;
- cooldown;
- stop on acknowledgement.

Não ligar repetidamente em loop.

Implementar limites duros.

---

# Fase 12 — Conteúdo da chamada

Para notificações sensíveis, a chamada não deve falar detalhes privados por padrão.

Mensagem padrão segura:

```text
"Tens um lembrete programado. Confere a aplicação para os detalhes."
```

O conteúdo específico pode ser opt-in por política.

O Voice Core pode ser usado para conversa somente quando necessário.

Para reminder simples, evitar gastar LLM se TTS determinístico resolver.

---

# Fase 13 — Observabilidade

Registrar:

- notification_id;
- delivery attempt;
- channel;
- provider;
- voice_call_id;
- provider_call_id/channel id;
- timestamps:
  - queued;
  - started;
  - ringing;
  - answered;
  - completed;
  - failed;
- latency;
- retries;
- failure reason;
- acknowledgement.

Nunca guardar:

- auth tokens;
- SIP secrets;
- áudio por padrão;
- conteúdo sensível desnecessário.

Adicionar métricas:

- delivery success rate;
- answer rate;
- acknowledgement rate;
- retry rate;
- provider error rate;
- custo estimado por chamada quando disponível.

---

# Fase 14 — Segurança e antifraude

Obrigatório antes de produção:

1. Geo Permissions mínimas;
2. destination allowlist;
3. max calls por hora/dia;
4. spend limits/alerts na Twilio;
5. IP allowlist para SIP inbound;
6. TLS/SRTP quando homologado;
7. fail2ban/firewall mantidos;
8. ARI não exposto publicamente;
9. internal endpoints autenticados;
10. idempotency;
11. nenhuma rota pública arbitrária de dial;
12. tenant isolation;
13. caller ID não é autoridade;
14. connection deve estar `verified=true`;
15. recording OFF por padrão.

---

# Fase 15 — Testes automatizados

Criar/expandir testes para:

### Voice

- Asterisk outbound adapter;
- provider selection;
- invalid E.164;
- unverified connection;
- ambiguous connection;
- unauthorized destination;
- duplicate idempotency key;
- provider failure;
- lifecycle terminal;
- retry.

### Notification Router

- WhatsApp success;
- WhatsApp failure;
- escalation timeout;
- acknowledgement cancels call;
- duplicate schedule event;
- restart-safe pending escalation;
- max retry;
- quiet hours.

### Security

- arbitrary destination blocked;
- cross-tenant contact blocked;
- invalid connection blocked;
- secret never logged;
- replay request idempotent.

---

# Fase 16 — Live gates

Não considerar pronto apenas porque o SIP devolveu 200.

## Gate A — Inbound

1. ligar para o DID Twilio;
2. Twilio envia para Asterisk;
3. Asterisk aceita somente rota esperada;
4. Stasis recebe;
5. tenant correto;
6. áudio nos dois sentidos;
7. Voice Core responde;
8. hangup fecha estado.

## Gate B — Outbound

1. criar chamada no CRM;
2. Asterisk origina;
3. Twilio aceita;
4. telefone real toca;
5. atender;
6. áudio nos dois sentidos;
7. correlation correta;
8. completed persistido.

## Gate C — WAHA

1. evento reminder;
2. WhatsApp chega;
3. resposta de confirmação chega pelo webhook;
4. notification fica acknowledged;
5. nenhuma chamada é feita.

## Gate D — Escalada

1. evento reminder;
2. WhatsApp chega;
3. não confirmar;
4. expirar grace period;
5. chamada é originada;
6. telefone toca;
7. status final correto.

---

# Fase 17 — Rollout

Ordem:

1. dev/test;
2. um único número owner;
3. um único tenant;
4. destination allowlist;
5. limites baixos;
6. logs acompanhados;
7. expandir somente depois dos gates.

Feature flags sugeridas:

- `NOTIFICATION_ROUTER_ENABLED`;
- `WAHA_NOTIFICATION_ENABLED`;
- `VOICE_NOTIFICATION_ENABLED`;
- `TWILIO_SIP_ENABLED`;
- `VOICE_ESCALATION_ENABLED`.

`VOICE_LIVE_ENABLED` existente continua sendo respeitado onde aplicável.

---

# Fase 18 — Rollback

Rollback deve ser simples:

1. desligar `VOICE_ESCALATION_ENABLED`;
2. desligar `TWILIO_SIP_ENABLED`;
3. desassociar DID do trunk se necessário;
4. desabilitar endpoint PJSIP Twilio;
5. manter WAHA funcionando;
6. não apagar dados históricos;
7. manter caminho Telnyx legado somente se ele estiver validado e deliberadamente escolhido como fallback.

Nunca fazer rollback destruindo migrations ou histórico de `voice_calls`.

---

## 7. O que NÃO fazer

- não criar outro WhatsApp provider;
- não reescrever Voice Core;
- não colocar Maestri no caminho de toda notificação;
- não colocar segredo Twilio no Git;
- não habilitar catch-all PSTN;
- não permitir número arbitrário vindo do browser;
- não usar caller ID como tenant identity;
- não considerar SIP 200 como prova de áudio;
- não fazer merge em `main`;
- não ativar live antes dos gates.

---

## 8. Entregáveis

Ao final:

1. Twilio DID ligado a Elastic SIP Trunk;
2. trunk inbound/outbound funcional;
3. Asterisk configurado;
4. outbound provider-neutral;
5. Asterisk outbound adapter;
6. voice calls usando `provider='asterisk'` no novo caminho;
7. Notification Router;
8. WAHA integrado;
9. Scheduler integrado;
10. acknowledgement;
11. escalation WhatsApp -> call;
12. observabilidade;
13. rate limits/antifraude;
14. testes;
15. evidência live;
16. runbook;
17. rollback documentado.

---

## 9. Acceptance Criteria

O projeto só é considerado concluído quando TODOS forem verdadeiros:

- [ ] branch `voz` isolada e sem alterações na `main`;
- [ ] número Twilio com Voice confirmado;
- [ ] Twilio trunk configurado;
- [ ] inbound Twilio -> Asterisk provado;
- [ ] outbound Asterisk -> Twilio provado;
- [ ] telefone real recebe chamada;
- [ ] áudio bidirecional funciona;
- [ ] Voice Core recebe correlation correta;
- [ ] lifecycle termina em estado terminal correto;
- [ ] WAHA envia notificação real;
- [ ] acknowledgement real cancela escalada;
- [ ] timeout real gera chamada;
- [ ] retries são limitados;
- [ ] idempotência impede duplicatas;
- [ ] destination allowlist ativa;
- [ ] Geo Permissions mínimas;
- [ ] spend/rate limits configurados;
- [ ] nenhum segredo no Git/log;
- [ ] testes unitários/integration gates verdes;
- [ ] evidência live documentada;
- [ ] rollback testado/documentado.

---

## 10. Primeira execução prática

Ordem exata recomendada:

1. confirmar no Twilio os dados não secretos do número e trunk;
2. criar Elastic SIP Trunk;
3. associar o DID;
4. configurar Origination para Asterisk;
5. configurar Termination;
6. preencher templates versionados sem segredos;
7. ativar inbound de teste;
8. provar chamada inbound;
9. implementar originator outbound Asterisk;
10. provar chamada outbound manual;
11. integrar outbound ao Voice Core;
12. criar Notification Router;
13. ligar WAHA;
14. ligar Scheduler;
15. adicionar acknowledgement;
16. adicionar escalada;
17. executar gates;
18. documentar evidência;
19. deixar tudo somente na branch `voz`.

---

## 11. Fonte de verdade desta iniciativa

Enquanto esta branch existir, este documento é o plano canônico para a integração de notificações por voz/WhatsApp com Twilio+Asterisk.

Mudanças de escopo devem atualizar este arquivo primeiro.

Não usar planos históricos como autoridade quando contradisserem este documento; planos antigos servem apenas como evidência/contexto.
