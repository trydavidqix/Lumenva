# CRM Voice Open-Source Europe — Plano de Implementação

> **Status:** plano canônico registrado em 2026-08-27, aprovado pelo dono do repositório. O código
> atual da branch `implementacao-tokens-voice-core` (ver `docs/handoffs/HANDOFF-voice-core.md` e
> `docs/superpowers/plans/2026-08-27-voice-core-canonical-status.md`) ainda reflete majoritariamente
> a arquitetura ANTERIOR (Telnyx + Deepgram + ElevenLabs, número técnico comprado) — ver seção
> "Relação com a implementação existente" no fim deste documento antes de codar qualquer Fase.
>
> **Progresso:**
> - **Fase 1 — IMPLEMENTADA** (commit `f672eb78`). `VoiceEngine` aceita perfil de voz
>   (preset/customized/cloned, providers piper/kokoro/openvoice); adapter Pipecat criado como
>   scaffold atrás da mesma interface; adapter Patter intacto pra rollback.
> - **Fase 2 — IMPLEMENTADA PARCIAL** (commit `ad8e027d`). `SipGateway` criado
>   (`lib/voice/sip/gateway.ts`); adapter Asterisk/ARI criado (`lib/voice/sip/asterisk-adapter.ts`);
>   resolução conexão→número→organização criada (`resolve-organization.ts#resolveByConnection`);
>   migration `0131_voice_sip_connections.sql` (aditiva, `voice_phone_numbers`/
>   `voice_worker_endpoints` continuam funcionando pelo caminho Telnyx antigo). **Não fiz**:
>   `workers/voice-worker/main.mjs` continua exigindo `TELNYX_PHONE_NUMBER` — o SDK Patter+Telnyx
>   usado hoje pelo worker embute o carrier Telnyx na própria construção (`new Patter({ carrier: new
>   Telnyx(...), phoneNumber, ... })`); `technical_phone_e164` está espalhado por toda lógica de
>   direção/contexto/faturamento do worker. Trocar isso sem quebrar o caminho de rollback exige o
>   runtime Pipecat da Fase 3 — não dá pra fazer isolado sem meio-rewire arriscado. Fase 2 fica
>   "pronta pro Fase 3 consumir", não "worker já fala SIP".
> - **Fase 3 — IMPLEMENTADA PARCIAL** (commit `bac49768`). Adapters STT/TTS/clone
>   criados atrás dos ports provider-neutros já existentes (`lib/voice/runtime/stt-port.ts`,
>   `tts-port.ts`): `lib/voice/stt/faster-whisper-adapter.ts` (rejeita transcrição vazia sem
>   inventar turno, valida locale antes de tocar no client); `lib/voice/tts/voice-catalog.ts`
>   (catalogação por idioma/país/género/nome/qualidade/licença/latência, licença incompatível
>   nunca entra no catálogo); `lib/voice/tts/piper-adapter.ts` e `kokoro-adapter.ts`
>   (`cancel()` aborta a stream real, pra barge-in); `lib/voice/clone/openvoice-adapter.ts`
>   (clonagem é caminho separado — `cloneProfileId` fixo na construção, nunca aceita override de
>   voz por chamada, exige consentimento verificado antes de qualquer criação de perfil,
>   revogação independente). `VoiceTtsOptions` ganhou campo opcional `voice` (voiceId/style/
>   speed/pitch) pra esses adapters saberem qual voz falar — antes só carregava `locale`.
>   **Não fiz**: nenhum desses adapters está ligado ao worker de produção nem a um processo
>   Pipecat/faster-whisper/Piper/Kokoro/OpenVoice real — são seams testáveis (interface + client
>   injetado), não integração viva. `whisper.cpp` (fallback sem GPU) não tem adapter ainda. A
>   troca de fato do worker (`workers/voice-worker/main.mjs` de Patter/Telnyx pra Pipecat) segue
>   pendente — é o mesmo bloqueio descrito na Fase 2.
> - **Atualização 2026-08-28 (Fase 3, fatia real do "próximo fio a puxar" do HANDOFF)**:
>   implementado `lib/voice/sip/asterisk-ari-client.ts` (`createAsteriskAriConnection`) — cliente
>   ARI real (REST + WebSocket, protocolo público do Asterisk: `POST /ari/channels`,
>   `POST /ari/channels/{id}/answer`, `DELETE /ari/channels/{id}`,
>   `ws://.../ari/events?app=...&api_key=...`), implementando a interface `AriClient` já definida
>   em `lib/voice/sip/asterisk-adapter.ts` (sem alterar aquele arquivo) e estendendo com
>   `AriConnection`/`AriEventStream` (`connectEvents`/`answer`/`hangup`). Testado em
>   `lib/voice/sip/asterisk-ari-client.test.ts` contra um servidor ARI falso local real (HTTP +
>   WebSocket via `ws`, não `vi.fn()`) cobrindo originate feliz/401/500, answer, hangup (incluindo
>   404 real de canal inexistente) e stream de eventos em ordem com `close()` real. Também um
>   smoke test como processo Node de verdade,
>   `workers/voice-sip-worker/ari-listener.smoke.mjs` (`npx tsx ...`), provando
>   conectar → `StasisStart` → `answer` → `close` fora do runner de testes. Gate completo
>   (`bash scripts/verify-voice-core.sh`, com as duas linhas novas) verde, `pnpm typecheck` limpo.
>   **Estado: `IMPLEMENTED` + `VERIFIED PROVIDER-FREE`, nunca `VERIFIED LIVE`** — não há Asterisk
>   real nesta sessão (sandbox sem GPU, sem rede até a VPS de produção). **Não fiz, de propósito**:
>   nenhum `PipecatRuntime`/`FasterWhisperClient`/`PiperClient`/`KokoroClient` concreto —
>   investigado e marcado `BLOCKED EXTERNAL` (são processos Python/ML sem contrato de servidor
>   documentado neste repo, viabilidade de rodar num sandbox sem GPU não confirmada; ver
>   `workers/voice-sip-worker/README.md` para o raciocínio completo). Nenhum listener de produção
>   de longa duração foi criado — só a prova do cliente/protocolo. `main.mjs` continua idêntico.
> - **Atualização 2026-08-28 (segunda fatia, mesma data): mais eventos ARI reconhecidos.**
>   `lib/voice/sip/asterisk-adapter.ts#parseInboundEvent` reconhecia só `StasisStart`; agora
>   também aceita `StasisEnd` e `ChannelHangupRequest` (os dois jeitos do Asterisk sinalizar fim
>   de chamada, dependendo de quem desliga e quando) — a mesma normalização/isolamento de tenant
>   (`SIP_CONNECTION_ID` obrigatório, `resolveOrganizationByConnection`) se aplica aos três; o
>   campo `eventType` do `NormalizedSipCallEvent` retornado agora carrega o tipo real, não mais
>   `"StasisStart"` hardcoded. Qualquer outro tipo (`ChannelDestroyed` etc.) continua rejeitado
>   como antes — teste existente preservado. 2 testes novos (`asterisk-adapter.test.ts`), suíte
>   11/11 verde, `pnpm typecheck` limpo, gate completo (`bash scripts/verify-voice-core.sh`)
>   verde. **Não fiz**: nenhuma interpretação do que um evento de término *significa* pro estado
>   da chamada (isso é do consumidor/listener, ainda não construído — ver
>   `workers/voice-sip-worker/README.md`), e não mexi em como `direction` (hoje sempre
>   `"inbound"` neste adapter) deveria se comportar pro lado Stasis de uma chamada outbound
>   originada — ficou como estava, fora de escopo desta fatia.
> - **Atualização 2026-08-28 (terceira fatia, mesma data): listener real ligado ao resolver de
>   tenant.** `lib/voice/sip/asterisk-listener.ts` (`createAsteriskAriListener`) conecta o
>   `AriConnection` ao `SipGateway.parseInboundEvent` — cada evento bruto do stream ARI vira um
>   `NormalizedSipCallEvent` (`status: "normalized"`) ou um resultado `"rejected"` (tipo não
>   suportado, tenant desconhecido, etc.) **sem derrubar o loop**, porque um Asterisk real manda
>   tipos de evento que o gateway não reconhece o tempo todo. Testado com o resolver de tenant
>   **de verdade** (`createVoiceOrganizationResolver`, não uma função mockada) contra um banco
>   falso em memória com o mesmo formato de `voice_sip_connections`/`voice_phone_numbers` — prova
>   real de que conexão SIP → número → organização funciona ponta a ponta, não só que uma função
>   foi chamada. Extraído `lib/voice/sip/testing/fake-ari-server.ts` (helper de servidor ARI falso
>   HTTP+WS real, compartilhado agora por `asterisk-ari-client.test.ts` e
>   `asterisk-listener.test.ts`, sem duplicar a lógica do servidor). Smoke test do processo real
>   (`workers/voice-sip-worker/ari-listener.smoke.mjs`) estendido pra provar
>   conectar → normalizar `StasisStart` → sobreviver a um evento não suportado →
>   normalizar `ChannelHangupRequest` → fechar, como processo Node de verdade via `tsx`. 4 testes
>   novos do listener, suíte `lib/voice/sip/` inteira 23/23 verde, `pnpm typecheck` limpo, gate
>   completo verde. **Não fiz, de propósito**: nenhum encaminhamento do evento normalizado pro CRM
>   — `app/api/internal/voice/event` foi desenhado pro mundo Telnyx (`voice_call_id` +
>   `technical_phone_e164`), o mundo SIP/BYOC identifica por `connectionId`, e não existe
>   spec/contrato dizendo como mapear um pro outro (ou se a rota deveria mudar). Inventar esse
>   mapeamento seria criar regra de negócio sem PRD por trás — fica registrado como a próxima
>   decisão explícita a tomar, não implementado às cegas. Também não construí reconexão automática
>   do WebSocket em caso de queda, nem liguei isso a um Asterisk real.
> - **Atualização 2026-08-28 (quarta fatia, mesma data): reconexão automática do WebSocket.**
>   `createAsteriskAriListener` agora reconecta sozinho com backoff exponencial
>   (`reconnectDelayMs` inicial, dobra até `maxReconnectDelayMs`, sem teto de tentativas — um
>   Asterisk inalcançável é condição pra continuar tentando, não pra desistir) quando o stream
>   termina **sem** `close()` explícito ter sido chamado; um `close()` explícito continua
>   encerrando o iterador de vez, sem reconectar. `wait` é injetável pra testes não dependerem de
>   tempo real. Testado com uma queda de conexão forçada de verdade (`dropConnection()` novo em
>   `lib/voice/sip/testing/fake-ari-server.ts`, via `socket.terminate()` — sem handshake de
>   fechamento limpo, simulando queda de rede/reinício de servidor) contra o mesmo servidor real
>   HTTP+WS, provando que o listener volta a normalizar eventos no socket novo sem intervenção. 2
>   testes novos (reconecta sozinho; não reconecta depois de `close()` explícito), rodados 5x
>   seguidas pra descartar flakiness de timing — todas verdes. Smoke test estendido provando a
>   mesma reconexão como processo real via `tsx`. Suíte `lib/voice/sip/` inteira verde, gate
>   completo verde. **Não fiz**: nenhum limite de tentativas nem alerta/observabilidade quando o
>   listener fica reconectando repetidamente (isso pertenceria ao processo de produção real, que
>   ainda não existe); e o encaminhamento pro CRM continua a mesma decisão pendente da fatia
>   anterior.
> - **Atualização 2026-08-28 (quinta fatia, mesma data): decisão do dono do repositório —
>   estender a rota existente em vez de criar uma nova.** `app/api/internal/voice/event` agora
>   aceita dois caminhos de binding mutuamente exclusivos, validados por `.superRefine()`:
>   `technical_phone_e164` (Telnyx, inalterado) OU `connection_id` + `phone_e164` (SIP/BYOC) —
>   nunca os dois, nunca nenhum. O caminho novo faz join em `voice_sip_connections`
>   (`gateway='asterisk'`, `verified=true`, `enabled=true`) → `voice_phone_numbers`
>   (`connection_id`), com a mesma lógica de direção (`vc.direction='inbound' and
>   vc.called_number=phone_e164` / `outbound` com `caller_number`) que o caminho Telnyx já usa —
>   `organization_id` nunca vem do corpo da requisição, só do join, no caminho novo e no antigo.
>   7 testes novos (`app/api/internal/voice/event/route.test.ts`, seguindo o padrão de mock de
>   `getRequestPool` já usado em outras rotas do repo — não é `test:db`/Postgres real, é unitário
>   com pool falso, proporcional ao tamanho da mudança); teste de contrato estático existente
>   (`tests/unit/voice-worker-tenant-binding-contract.test.ts`) continua verde sem alteração.
>   `pnpm typecheck`, `pnpm lint`, `pnpm lint:tenant-filter` e gate completo verdes.
>   **Não fiz, de propósito — e é o motivo de isto ainda não fechar o ciclo**: não existe, em
>   lugar nenhum, um equivalente SIP/BYOC de `app/api/internal/voice/context` (a rota que cria a
>   row `voice_calls` para uma chamada Telnyx nova). Sem essa peça, um `voice_call_id` pro mundo
>   SIP nunca existe pra essa rota nova encontrar — ou seja, **o listener (`asterisk-listener.ts`)
>   ainda não chama essa rota**, porque chamaria sempre em vão. Essa é a próxima decisão real, e
>   descobri isso só ao tentar fechar o encaminhamento de ponta a ponta: estender só o `/event`
>   não bastava. Também confirmei uma fronteira de segurança já documentada
>   (`workers/voice-worker/README.md`: "The worker has no database credentials") — quando o
>   listener SIP virar processo de produção, a resolução de tenant também precisa ser uma chamada
>   HTTP pro CRM, não uma conexão direta a Postgres a partir do worker.
> - **Fase 4 — IMPLEMENTADA PARCIAL** (commit `e9dc37e2`). Versionamento imutável do
>   perfil de voz (`lib/voice/engine/voice-profile-version.ts` — publicar sempre acrescenta,
>   nunca reescreve uma versão antiga; `activeVersion` é um ponteiro, rollback é publicar de
>   novo apontando pra versão anterior); validação runtime do perfil
>   (`lib/voice/engine/voice-profile-schema.ts`, espelha os tipos de `contracts.ts`); cadeia de
>   fallback clonada→Kokoro→Piper→transferência humana/falha segura
>   (`lib/voice/tts/fallback-chain.ts` — nunca troca locale/género silenciosamente, só provider/
>   voz). `app/api/v1/voice/config/route.ts` ganhou `POST` (publica versão nova, audita) e o `GET`
>   retorna o perfil ativo + histórico. `_form.tsx` ganhou seção "Voz do agente" (idioma/género/
>   provider/voiceId, botão "Publicar" separado do "Salvar" de sempre). **Não fiz**: prévia de
>   áudio, upload de gravação para clonagem, teste da voz clonada — passos 5/7/9 da interface do
>   cliente do plano ficam pra depois; exigem manuseio real de mídia (upload/playback) que essa
>   sessão não construiu. Nenhum teste E2E/Playwright novo — a tela em si não é coberta pelo gate
>   (só typecheck+build a protegem de quebrar), a lógica por trás dela é.
> - **Fase 5 — IMPLEMENTADA PARCIAL** (commit `f4853c80`). Matriz de idiomas criada
>   (`lib/voice/tts/language-matrix.ts`): tier 1 (7 idiomas do plano) + tier 2 (16 locales,
>   "bálticas" expandido em lv+lt); `evaluateLanguageReadiness` computa PASS/PARTIAL/
>   NOT_SUPPORTED a partir dos 8 checks do plano (voz M/F, pronúncia, números/datas/nomes,
>   latência, interrupção, chamada telefónica, licença) — só PASS com os 8 verdadeiros, só
>   NOT_SUPPORTED com nenhum. `buildLanguageReadinessRegistry` rejeita locale fora das duas
>   tiers em vez de aceitar silenciosamente. `isLanguageOfferable` é a única pergunta que o
>   runtime deveria fazer antes de oferecer um idioma — não existe fallback automático de
>   idioma aqui nem em `fallback-chain.ts` (Fase 4), consistente com a regra do plano. **Não
>   fiz**: nenhum teste real rodado contra voz nenhuma — isso é infraestrutura de
>   status/gate, não os 16+7 testes de pronúncia/latência/interrupção/chamada reais em si, que
>   exigem os adapters da Fase 3 ligados a processos vivos. Sem persistência (não decidi ainda se
>   o registry mora em `organizations.settings` como o resto ou vira tabela — falta migration se
>   for tabela).
> - **Fase 6 — AUDITADA, GAP FECHADO PARCIAL** (commit `fce93bd9`). Comparei os 13
>   testes unitários exigidos pelo plano contra a suíte existente:
>
>   | Teste exigido | Estado |
>   |---|---|
>   | seleção de voz por locale | JÁ COBERTO — `voice-catalog.test.ts` |
>   | escolha masculina/feminina | JÁ COBERTO — `voice-catalog.test.ts` |
>   | velocidade, tom e estilo | JÁ COBERTO — `piper-adapter.test.ts`/`kokoro-adapter.test.ts` |
>   | perfil clonado exige consentimento | JÁ COBERTO — `openvoice-adapter.test.ts` |
>   | perfil revogado não pode ser usado | **GAP FECHADO** — `clone-profile-registry.ts` novo |
>   | voz inexistente é rejeitada | JÁ COBERTO — `voice-catalog.test.ts` (null) + `clone-profile-registry.test.ts` (clone) |
>   | voz de outro tenant é rejeitada | **GAP FECHADO** — `clone-profile-registry.ts` novo |
>   | idioma sem voz aprovada falha com segurança | JÁ COBERTO — `fallback-chain.test.ts` |
>   | fallback respeita a mesma língua | JÁ COBERTO — `fallback-chain.test.ts` |
>   | transcript vazio não gera resposta | JÁ COBERTO — `faster-whisper-adapter.test.ts` + `evals.test.ts` |
>   | interrupção cancela TTS | JÁ COBERTO — `piper-adapter.test.ts`/`kokoro-adapter.test.ts` (`cancel()`) |
>   | evento duplicado não duplica chamada | JÁ COBERTO (pré-existente) — `repository.test.ts` |
>   | evento tardio não reabre chamada | JÁ COBERTO (pré-existente) — `voice-worker-tenant-binding-contract.test.ts` |
>
>   Criei `lib/voice/clone/clone-profile-registry.ts`: `assertCloneProfileUsable`/
>   `isCloneProfileUsable` rejeitam perfil de clone desconhecido, revogado, ou de outra
>   organização — antes disso nada checava posse nem revogação entre `openvoice-adapter.ts`
>   (que só sabe criar/revogar) e `fallback-chain.ts` (que só recebe `cloneAvailable` como
>   booleano de fora, sem função nenhuma pra computar esse booleano). Esse é o elo que faltava.
>
>   **Testes de integração (11 itens do plano)**: nenhum é testável sem infraestrutura viva —
>   Asterisk real, Pipecat real, SIP/BYOC real, reinício de worker real, perda de conexão real.
>   Três têm um proxy provider-free hoje (`simulator.test.ts`/`evals.test.ts` provam o caminho
>   CRM→Agent OS sem processo externo nenhum: Pipecat→STT→Agent OS→TTS, transferência humana,
>   encerramento); isolamento entre organizações já é coberto por
>   `voice-worker-tenant-binding-contract.test.ts` e `asterisk-adapter.test.ts`. Os outros 6
>   (Asterisk/ARI inbound, Asterisk/ARI outbound, SIP/BYOC real, perda de conexão, timeout de
>   STT, timeout de TTS, worker reiniciado durante chamada) ficam `BLOCKED EXTERNAL` — não vou
>   fabricar teste de integração contra nada que não existe.
>
>   Gate completo: 47 arquivos, 198 testes (era 194).
> - **Fase 7 — não implementada** (homologação/lançamento — depende inteiramente de ativação
>   externa: número real, Asterisk real, credenciais reais).
>
> **Atualização 2026-08-27 (sessão de infraestrutura, fora do código deste plano)**: validado
> ao vivo, na VPS de produção (`root@2.29.8.225`), que Asterisk/ARI/PJSIP cabe e funciona como
> gateway SIP standalone — ainda **sem** nenhum consumidor Pipecat conectado, então isso NÃO
> avança nenhuma Fase 3-7 de código, só prova que a peça de telefonia da Fase 2/7 é viável
> nesse host:
> - Asterisk instalado nativo via systemd (não Docker, ~55MB RAM) — cabe na VPS atual (2 CPU,
>   3.7GB RAM). Pipecat + faster-whisper NÃO cabem aqui (precisam 1-2GB+ RAM, idealmente GPU);
>   vão precisar de VPS separada quando a Fase 3 for ligada a um processo real.
> - ARI (REST+WebSocket) só em `127.0.0.1:8088`, nunca exposto publicamente.
> - Endpoint PJSIP de teste `1000` criado, registro e chamada validados ponta a ponta com
>   Zoiper (iOS) via UDP/5060.
> - **Firewall Hetzner Cloud (`lumenva-crm-firewall`) estava bloqueando UDP/5060 e UDP/8000-8100**
>   — root cause do 408 Request Timeout inicial; não era problema do telefone, da rede do
>   telefone, nem do `iptables`/`ufw` da própria VPS (esses já estavam abertos). Corrigido
>   adicionando as duas regras Incoming na Hetzner Cloud Console.
> - **Bug de config encontrado e corrigido**: AOR nomeada `1000-aor` (diferente do nome do
>   endpoint `1000`) causava `AOR '' not found for endpoint '1000'` no `res_pjsip_registrar` —
>   REGISTER autenticava certo (401→200 do digest) mas falhava ao gravar o contact. Fix: renomear
>   a AOR pra bater com o nome do endpoint (`[1000] type=aor`, padrão usual do pjsip.conf).
> - Dialplan de teste (`voicecore-test` context, `Answer()` → `Stasis(voicecore-test)`) confirmado
>   recebendo e atendendo chamada real (CDR `ANSWERED`). Erro esperado e correto nesse ponto:
>   `Stasis app 'voicecore-test' doesn't exist` — não há nenhum app ARI escutando ainda, porque
>   Pipecat (Fase 3) não está ligado a esse Asterisk. Esse é exatamente o próximo fio a puxar
>   quando a Fase 3 for da fase "adapter testável" pra "processo vivo".
> - Nenhuma mudança de código neste repositório resultou dessa sessão — é só configuração de
>   infraestrutura na VPS (systemd units, `/etc/asterisk/*.conf`) e uma regra de firewall na
>   Hetzner Cloud Console. Nada pendente de commit.

**Objetivo:** permitir que cada cliente crie um agent de voz usando o próprio número, escolha uma voz natural por idioma europeu, ajuste o estilo e, opcionalmente, clone uma voz autorizada.

**Arquitetura:** manter o CRM, Agent OS, Supabase, tokens, memória, policies e `VoiceEngine` como autoridade. Substituir Patter, Deepgram e ElevenLabs por adapters open-source, com Pipecat como runtime de voz e Asterisk/ARI como gateway SIP/BYOC.

**Stack definida:**

- Telefonia: Asterisk/ARI, isolado como serviço SIP.
- Runtime de voz: Pipecat.
- STT: faster-whisper.
- TTS principal: Piper para cobertura ampla de idiomas.
- TTS de maior naturalidade: Kokoro quando houver voz aprovada no idioma.
- Clonagem opcional: OpenVoice.
- CRM: `VoiceEngine` atual + Agent OS.
- Número: SIP/BYOC do próprio cliente.

**Restrições globais:**

- Não comprar número técnico.
- Não criar novo CRM, Agent Engine ou banco paralelo.
- Não alterar tokens existentes.
- Não permitir que Pipecat, Asterisk ou TTS executem tools comerciais diretamente.
- Toda ação continua passando pelo Agent OS, policy, tenant e auditoria.
- Gravação e clonagem exigem consentimento.
- Nenhuma voz clonada sem autorização verificável.
- Nenhum provider pago será obrigatório para a primeira versão.

---

### Fase 1 — Preparar o contrato provider-neutral

**Arquivos principais:**

- `lib/voice/engine/contracts.ts`
- `lib/voice/engine/factory.ts`
- `lib/voice/config.ts`
- `lib/voice/runtime/`

**Alterações:**

- Expandir o `VoiceEngine` para aceitar um perfil de voz.
- Adicionar os modos:

```text
preset
customized
cloned
```

- Definir o perfil com:

```text
locale
gender
voiceId
provider
style
speed
pitch
cloneProfileId
```

- Adicionar providers internos:

```text
piper
kokoro
openvoice
```

- Manter o adapter Patter temporariamente para rollback.
- Criar o adapter Pipecat sem mudar o contrato usado pelo Agent OS.
- O `VoiceEngine` deve continuar expondo:

```text
startSession()
events()
speak()
interrupt()
transfer()
end()
```

**Regra:** o Agent OS envia texto e recebe transcrição. Ele não conhece detalhes de Piper, Kokoro, OpenVoice ou Pipecat.

---

### Fase 2 — Trocar o número técnico por SIP/BYOC

**Arquivos principais:**

- `lib/voice/telnyx/`
- `lib/voice/identity/`
- `workers/voice-worker/`

**Alterações:**

- Criar uma interface `SipGateway` para receber e iniciar chamadas.
- Implementar Asterisk/ARI como primeiro gateway.
- Aceitar a conexão SIP/BYOC fornecida pela operadora do cliente.
- Associar:

```text
conexão SIP
        ↓
número E.164
        ↓
organização
        ↓
agent de voz
```

- Inbound:
  - validar conexão;
  - validar número chamado;
  - resolver organização;
  - localizar contacto;
  - iniciar sessão do agent.

- Outbound:
  - exigir organização, contacto, agent e objetivo;
  - validar que o número pertence à organização;
  - usar o Caller ID do próprio cliente;
  - rejeitar chamadas sem conexão verificada.

- Remover a obrigação de:

```text
TELNYX_PHONE_NUMBER
```

- Manter Telnyx apenas como adapter opcional quando for o carrier SIP escolhido pelo cliente.
- Eliminar a regra "um worker por número técnico".
- O worker passa a estar ligado à conexão SIP e resolve o número por chamada.

**Segurança:**

- conexão desconhecida: rejeitar;
- número não verificado: rejeitar outbound;
- tenant ambíguo: rejeitar;
- assinatura inválida: rejeitar;
- evento duplicado: ignorar sem criar novo efeito;
- chamada terminal: não reabrir.

---

### Fase 3 — Criar o runtime de voz open-source

**Arquitetura do worker:**

```text
Asterisk/ARI
      ↓
Node voice-worker
      ↓
Pipecat runtime
      ↓
faster-whisper
      ↓
Agent OS do CRM
      ↓
Piper ou Kokoro
      ↓
Asterisk/ARI
```

**Responsabilidades do Pipecat:**

- receber áudio;
- detectar início e fim da fala;
- executar VAD;
- enviar áudio para STT;
- enviar a transcrição ao CRM;
- receber a resposta do Agent OS;
- converter texto em áudio;
- suportar interrupção do agent;
- controlar turnos;
- emitir eventos de latência e erro.

**Responsabilidades do CRM:**

- identidade do tenant;
- contexto do contacto;
- agent escolhido;
- memória;
- tools;
- policies;
- approvals;
- transferência humana;
- histórico;
- auditoria;
- custos e métricas.

**STT:**

- usar faster-whisper como padrão;
- usar whisper.cpp apenas como fallback para máquinas sem GPU;
- definir modelo por capacidade do servidor;
- validar idioma pelo `locale` da chamada;
- rejeitar transcrição vazia sem inventar turno.

**TTS:**

- Piper para idiomas europeus com menor custo de infraestrutura;
- Kokoro quando a voz tiver melhor naturalidade no idioma;
- catalogar vozes por:

```text
idioma
país
género
nome
qualidade
licença
latência
```

- não disponibilizar vozes cujo modelo tenha licença incompatível com o produto.

**Clonagem:**

- OpenVoice como adapter separado;
- nunca misturar clonagem com o caminho normal de TTS;
- exigir gravação autorizada;
- validar qualidade e idioma;
- gerar um `cloneProfileId`;
- o runtime recebe apenas o identificador do perfil;
- áudio original e artefactos ficam em armazenamento privado;
- permitir revogação e eliminação do perfil;
- bloquear uso de voz de terceiros sem consentimento.

---

### Fase 4 — Configuração do agent no CRM

**Arquivos principais:**

- `app/api/v1/voice/config/route.ts`
- `app/app/settings/tenant/voice/_form.tsx`
- `lib/voice/config.ts`

**Interface do cliente:**

1. Escolher idioma/país.
2. Escolher voz masculina ou feminina.
3. Escolher voz específica.
4. Ajustar:
   - tom;
   - velocidade;
   - energia;
   - formalidade;
   - pausas;
   - estilo.
5. Ouvir prévia.
6. Ativar a voz.
7. Opcionalmente enviar gravação para clonagem.
8. Confirmar consentimento.
9. Testar a voz clonada.
10. Associar a voz ao agent.

**Persistência:**

- manter configurações gerais compatíveis com `organizations.settings.voice`;
- guardar apenas referências de perfil, nunca secrets;
- guardar configuração de voz publicada junto da versão do agent quando houver suporte a override por agent;
- configuração publicada deve ser imutável;
- alteração de voz cria nova versão ou nova configuração auditada;
- não alterar tabelas de tokens nem credenciais existentes.

**Fallback:**

```text
voz clonada indisponível
        ↓
voz Kokoro aprovada
        ↓
voz Piper aprovada
        ↓
falha segura ou transferência humana
```

Nunca trocar silenciosamente para uma voz de outro idioma ou tenant.

---

### Fase 5 — Matriz de idiomas europeus

A implementação não deve prometer todas as línguas antes de testar cada uma.

**Primeira matriz:**

- inglês;
- português de Portugal;
- espanhol;
- francês;
- alemão;
- italiano;
- neerlandês.

**Segunda expansão:**

- sueco;
- dinamarquês;
- norueguês;
- finlandês;
- polaco;
- checo;
- grego;
- romeno;
- húngaro;
- eslovaco;
- esloveno;
- bálticas;
- croata;
- búlgaro;
- ucraniano.

Cada idioma precisa de:

- pelo menos uma voz masculina;
- pelo menos uma voz feminina;
- teste de pronúncia;
- teste de números, datas e nomes;
- teste de latência;
- teste de interrupção;
- teste de chamada telefónica;
- licença validada;
- resultado `PASS`, `PARTIAL` ou `NOT_SUPPORTED`.

Não haverá fallback automático para outro idioma.

---

### Fase 6 — Testes

**Testes unitários:**

- seleção de voz por locale;
- escolha masculina/feminina;
- velocidade, tom e estilo;
- perfil clonado exige consentimento;
- perfil revogado não pode ser usado;
- voz inexistente é rejeitada;
- voz de outro tenant é rejeitada;
- idioma sem voz aprovada falha com segurança;
- fallback respeita a mesma língua;
- transcript vazio não gera resposta;
- interrupção cancela TTS;
- evento duplicado não duplica chamada;
- evento tardio não reabre chamada.

**Testes de integração:**

- Asterisk/ARI para inbound;
- Asterisk/ARI para outbound;
- SIP/BYOC com número do cliente;
- Pipecat → STT → Agent OS → TTS;
- transferência para humano;
- encerramento;
- perda de conexão;
- timeout de STT;
- timeout de TTS;
- worker reiniciado durante chamada;
- isolamento entre organizações.

**Gate local:**

```bash
bash scripts/verify-voice-core.sh
```

O gate deverá incluir:

- contratos do novo `VoiceEngine`;
- adapter SIP;
- adapter Pipecat;
- STT local;
- TTS local;
- clonagem;
- matriz de idiomas;
- isolamento;
- consentimento;
- worker;
- build;
- typecheck;
- tenant lint.

---

### Fase 7 — Homologação e lançamento

**Ordem de ativação:**

1. Testes locais provider-free.
2. Teste com áudio gravado.
3. Teste em browser.
4. Teste com SIP interno.
5. Inbound real usando o número do cliente.
6. Outbound real usando o Caller ID do cliente.
7. Teste de transferência humana.
8. Teste com cada idioma aprovado.
9. Ativação para uma organização.
10. Expansão gradual.

**Métricas obrigatórias:**

- tempo até primeira resposta;
- latência STT;
- latência do Agent OS;
- latência TTS;
- interrupções;
- falhas de áudio;
- transferência;
- duração da chamada;
- custo de infraestrutura;
- qualidade por idioma;
- taxa de fallback;
- chamadas encerradas por erro.

**Critério de sucesso final:**

O cliente consegue:

```text
manter o próprio número
        ↓
ligar o número via SIP/BYOC
        ↓
criar um agent de voz
        ↓
escolher idioma e género da voz
        ↓
escolher voz natural
        ↓
ajustar tom e estilo
        ↓
testar
        ↓
clonar uma voz autorizada, se quiser
        ↓
atender e fazer chamadas reais
```

**Decisão final:** usar Pipecat como runtime open-source acoplado ao `VoiceEngine`; Asterisk/ARI para telefonia; faster-whisper para STT; Piper/Kokoro para vozes; OpenVoice para clonagem. O CRM continua sendo o cérebro e a fonte de verdade. Nenhuma adoção integral de outro projeto será feita.

---

## Relação com a implementação existente (`implementacao-tokens-voice-core`)

Registrado em 2026-08-27 ao lado do gate verde fresco da branch (`bash scripts/verify-voice-core.sh`,
35 arquivos de teste/114 testes, `next build` limpo — ver `2026-08-27-voice-core-canonical-status.md`).

**O que muda de arquitetura, não é incremento:**

| Camada | Implementação atual (branch) | Este plano |
|---|---|---|
| Telefonia | Telnyx, número técnico comprado por org | Asterisk/ARI, SIP/BYOC do cliente |
| STT | Deepgram (adapter atual) | faster-whisper (local/self-host) |
| TTS | ElevenLabs (adapter atual) | Piper (padrão) / Kokoro (naturalidade) |
| Clonagem de voz | não existe | OpenVoice, com consentimento e revogação |
| Runtime de mídia | Patter OSS | Pipecat |
| Modelo de número | 1 worker por número técnico | worker ligado à conexão SIP, resolve número por chamada |

**O que NÃO muda** (os 15 invariantes de segurança do `HANDOFF-voice-core.md` continuam valendo
integralmente): CRM/Agent OS como única fonte de verdade e único runtime de LLM; resolução de
organização antes de qualquer outra coisa; zero lookup cross-tenant; `runModelCall`/Agent Kernel
como seam canônico; Product Agents não promovidos automaticamente; proibição de merge em `main`
sem autorização explícita.

**Como isto deve ser trabalhado:**

- Este documento é o plano canônico para a PRÓXIMA fase do Voice Core — não invalida o trabalho já
  feito e testado na branch atual, que continua sendo a base de código real.
- Antes de abrir a Fase 1 aqui, o próximo agente deve reler `HANDOFF-voice-core.md` e este próprio
  plano juntos — não redesenhar do zero, não descartar os contratos/testes que já existem só porque
  o provider por trás vai trocar (o `VoiceEngine` provider-neutral já existe e é reaproveitado, não
  recriado).
- Continuar seguindo a regra de não mergear `main` sem autorização explícita.
- Continuar trabalhando na mesma branch (`implementacao-tokens-voice-core`) até decisão em contrário.
