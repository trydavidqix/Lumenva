# Plano de Implementação Inline — Voice / Twilio / Asterisk / WAHA

**Branch:** `voz`  
**Base:** `lumenva-command-center`  
**Modo de execução:** inline, sem subagents  
**Autorização do owner:** execução autônoma dentro da branch `voz`, sem merge para `main`  
**Fonte funcional:** `docs/VOICE_TWILIO_ASTERISK_PLAN.md`

## 1. Objetivo operacional

Executar o máximo tecnicamente possível dentro da branch `voz` sem parar para pedir aprovação entre etapas, deixando para o owner somente ações que exigem acesso externo, segredo, login, infraestrutura viva ou interação física com o telefone.

Meta de responsabilidade:

- **ChatGPT / execução inline:** 92%
- **Owner:** 8%

Essa divisão não representa "linhas de código", mas a parcela do trabalho total necessária para chegar a live com evidência real.

## 2. O que será executado inline

### Bloco A — baseline e inventário

1. Fixar o HEAD inicial da branch.
2. Inventariar Voice Core, WAHA, Scheduler, banco, migrations e Asterisk.
3. Identificar contratos duplicados/legados.
4. Definir o caminho canônico Twilio -> Asterisk -> Voice Core.
5. Preservar Telnyx apenas como rollback enquanto necessário.
6. Não tocar na `main`.

**Owner necessário:** não.

### Bloco B — tornar outbound provider-neutral

1. Remover hardcode de `provider='telnyx'` do novo caminho.
2. Introduzir seleção explícita do dialer/provider.
3. Fazer o novo caminho registrar `provider='asterisk'`.
4. Manter compatibilidade com o legado quando segura.
5. Fail-closed em routing ambíguo.
6. Cobrir com testes.

**Owner necessário:** não.

### Bloco C — resolver conexão SIP/BYOC

1. Resolver `voice_sip_connections` verificadas e ativas.
2. Resolver `voice_worker_endpoints` por connection.
3. Vincular DID/phone number ao tenant correto.
4. Impedir cross-tenant.
5. Exigir E.164.
6. Rejeitar conexão não verificada.

**Owner necessário:** não.

### Bloco D — Asterisk/Twilio inbound versionado

1. Evoluir os templates `twilio-inbound.disabled.conf.example`.
2. Separar parâmetros públicos de segredos.
3. Criar contexto dedicado de inbound.
4. Propagar `SIP_CONNECTION_ID`.
5. Restringir DID esperado.
6. Preparar allowlist de signaling.
7. Documentar TLS/SRTP sem ativar antes de homologação.
8. Criar validações/testes de contrato dos templates.

**Owner necessário:** apenas fornecer/confirmar dados reais do trunk na hora de ativar.

### Bloco E — Asterisk/Twilio outbound

1. Criar configuração PJSIP de outbound para o Twilio.
2. Criar rota dedicada, sem catch-all inseguro.
3. Implementar originate via ARI/adapter.
4. Propagar:
   - voice_call_id;
   - connection_id;
   - tenant;
   - source DID;
   - destino;
   - correlation id.
5. Bloquear números/destinos não autorizados.
6. Gravar lifecycle.

**Owner necessário:** não para o código; sim para credencial/trunk live.

### Bloco F — Asterisk outbound adapter

Criar adapter canônico com:

- validação E.164;
- connection verificada;
- destination policy;
- originate;
- correlation;
- lifecycle;
- erros tipados;
- idempotência;
- testes.

**Owner necessário:** não.

### Bloco G — Notification Router

Criar um único domínio de entrega:

```text
Scheduler
  -> Notification Router
      -> WAHA
      -> Voice
```

O router terá:

- notification_id;
- delivery attempts;
- channel;
- status;
- retry;
- acknowledgement;
- escalation;
- deduplicação;
- idempotency key;
- auditoria.

Antes de criar schema novo, reutilizar tabelas existentes quando suficientes.

**Owner necessário:** não.

### Bloco H — integrar WAHA existente

1. Reutilizar `sendMessageHandler` / action existente.
2. Não criar segundo cliente WAHA.
3. Adicionar correlation metadata.
4. Registrar delivery.
5. Integrar inbound reply para acknowledgement.

**Owner necessário:** não.

### Bloco I — acknowledgement determinístico

Implementar confirmação sem depender de LLM para casos simples:

- resposta explícita;
- token/reply correlacionado;
- botão quando suportado;
- estado `acknowledged`.

Ack cancela chamadas pendentes.

**Owner necessário:** não.

### Bloco J — Scheduler

1. Evento persistente `schedule_due`.
2. Notification criada de forma idempotente.
3. WhatsApp enviado.
4. Deadline de escalation persistido.
5. Recovery após restart.
6. timezone-aware.
7. Sem Maestri no caminho crítico.

**Owner necessário:** não.

### Bloco K — escalation WhatsApp -> call

Fluxo inicial:

```text
T0: WhatsApp
T0 + grace period:
  se acknowledged -> STOP
  senão -> Voice call
```

Adicionar:

- retry limitado;
- cooldown;
- limite diário;
- quiet hours;
- stop on acknowledgement;
- proteção contra loops.

**Owner necessário:** não.

### Bloco L — privacidade da mensagem de voz

Default:

`Tens um lembrete programado. Confere a aplicação para os detalhes.`

Não falar informação sensível automaticamente.

LLM não é necessário para um reminder simples.

**Owner necessário:** não.

### Bloco M — observabilidade

Adicionar correlation completa:

- notification_id;
- delivery_attempt_id;
- voice_call_id;
- provider call/channel id;
- queued;
- ringing;
- answered;
- completed;
- failed;
- acknowledged;
- retries;
- latency;
- reason.

**Owner necessário:** não.

### Bloco N — antifraude / segurança

Implementar no app:

- allowlist;
- max calls;
- cooldown;
- rate limit;
- tenant isolation;
- verified connection;
- idempotência;
- sem arbitrary dial;
- recording off por padrão;
- logs sem secret.

Preparar configuração externa para:

- Twilio Geo Permissions;
- spend alerts;
- IP ACL;
- firewall.

**Owner necessário:** apenas ativar settings externos no Twilio/VPS.

### Bloco O — testes

Criar/expandir:

- unit;
- contract;
- integration;
- migration contract;
- WAHA;
- outbound;
- Asterisk;
- Notification Router;
- scheduler;
- acknowledgement;
- escalation;
- idempotency;
- tenant isolation;
- antifraude.

Usar CI existente quando disponível.

**Owner necessário:** não.

### Bloco P — documentação e runbook

Entregar:

- arquitetura final;
- env vars;
- Infisical keys esperadas;
- Twilio Console checklist;
- deploy VPS;
- rollback;
- troubleshooting;
- live test checklist;
- evidência esperada.

**Owner necessário:** não.

## 3. Os 8% que ficam obrigatoriamente com o owner

### 3.1 Twilio Console — aproximadamente 3%

Ações que exigem acesso à conta:

1. confirmar/selecionar o número comprado;
2. criar ou abrir o Elastic SIP Trunk;
3. associar o DID ao trunk;
4. configurar Origination URI;
5. configurar Termination URI/auth;
6. ativar apenas os países necessários em Geo Permissions;
7. configurar spend alerts/limites.

O agente fornece valores e checklist, mas não possui sessão autenticada da conta Twilio.

### 3.2 Infisical / secrets — aproximadamente 1%

Inserir os segredos indicados pelo código, sem colá-los no chat/Git:

- Twilio/SIP credentials quando usadas;
- API key/secret quando necessário;
- outros segredos de runtime.

O agente define nomes e consumo; o owner insere os valores.

### 3.3 VPS/Asterisk live — aproximadamente 3%

Quando o código/config estiver pronto:

1. aplicar config gerada;
2. reiniciar/reload Asterisk/worker;
3. confirmar firewall/ports;
4. executar comandos live de verificação fornecidos.

Se futuramente existir um connector/SSH autorizado para essa VPS, parte dessa fatia pode ser automatizada.

### 3.4 Teste físico — aproximadamente 1%

O owner precisa:

1. ligar para o DID Twilio;
2. atender a chamada outbound no telefone;
3. confirmar se ouviu/falou;
4. confirmar chegada do WhatsApp quando necessário.

Essa parte não pode ser simulada como prova live.

## 4. Ordem de execução autônoma

A execução inline seguirá esta ordem, sem pedir confirmação entre passos seguros:

1. baseline;
2. provider-neutral outbound;
3. SIP connection routing;
4. Twilio/Asterisk inbound templates;
5. Twilio/Asterisk outbound;
6. Asterisk originate adapter;
7. Notification Router;
8. WAHA;
9. acknowledgement;
10. Scheduler;
11. escalation;
12. observabilidade;
13. segurança;
14. testes;
15. CI/gates;
16. documentação;
17. preparar pacote exato para os 8% do owner;
18. após dados externos, fechar live gates.

## 5. Política de autonomia

Durante os 92%:

- não parar por decisões pequenas;
- resolver erros através do código, testes e documentação oficial;
- fazer commits incrementais;
- não usar subagents;
- não fazer merge para `main`;
- não apagar caminhos antigos antes do novo passar gates;
- não armazenar segredos;
- não ativar produção de forma irreversível;
- manter rollback;
- registrar blockers externos de forma objetiva.

Perguntas ao owner ficam reservadas somente para algo impossível de inferir e que exija uma ação externa real.

## 6. Limite máximo desta execução

### Máximo executável sem acesso adicional

**92% do projeto.**

### Parte externa mínima

**8% do projeto.**

Se forem disponibilizados posteriormente acesso autorizado ao Twilio Console/infra/secret manager por ferramenta apropriada, o limite técnico pode subir. Mesmo assim, o teste físico de atender/ligar pelo telefone continua sendo uma prova do owner.

## 7. Definition of Done para os 92%

A parte inline termina apenas quando:

- código completo está na branch `voz`;
- migrations necessárias estão prontas;
- configuração Asterisk/Twilio está parametrizada;
- nenhum segredo foi commitado;
- router funciona por contratos/testes;
- WAHA está integrado;
- scheduler está integrado;
- acknowledgement cancela escalation;
- escalation gera chamada no adapter;
- lifecycle está coberto;
- segurança/rate limits estão implementados;
- gates automatizáveis passam ou blockers externos estão provados;
- runbook deixa os passos do owner reduzidos aos 8% descritos.

## 8. Definition of Done total

O projeto chega a 100% somente após os passos externos e live gates:

- Twilio trunk real conectado;
- inbound real PASS;
- outbound real PASS;
- áudio bidirecional PASS;
- WhatsApp real PASS;
- acknowledgement real PASS;
- escalation real PASS;
- rollback live documentado.
