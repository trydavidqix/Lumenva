# HANDOFF — Voice Core SIP/BYOC — 2026-08-28

## Estado curto

- Branch alterada: `origin/implementacao-tokens-voice-core`.
- Último commit: `d3c97cbd8d3ca8ca5616e05f23411e52520a5a3a`.
- `main` não foi alterada.
- Checkout consolidado: `codex/crm-consolidated` em `54e86839486849ad5b14a19851eb1f3696d93605`.
- Voice Core ainda não foi integrado no checkout consolidado.
- Bridge SIP/BYOC foi instalada isoladamente na VPS e testada parcialmente contra Asterisk/ARI real.
- Não declarar `final-green`, `VERIFIED LIVE` ou produção de voz ativa.

## Decisão de produto

O cliente mantém o próprio número. O CRM entra no meio usando SIP/BYOC. Não comprar, trocar ou
atribuir número técnico ao cliente. A voz deve respeitar tenant, agente, idioma europeu, voz,
velocidade, tom e estilo configurados. Clonagem é opcional e exige consentimento, revogação e
eliminação verificáveis.

## O que foi feito

- Cliente ARI real HTTP + WebSocket.
- Eventos ARI `StasisStart`, `StasisEnd` e `ChannelHangupRequest` normalizados.
- Listener com resolução real de tenant e reconexão com backoff.
- Rotas internas `/event` e `/context` aceitando SIP/BYOC.
- Cliente CRM HTTP e forwarder de eventos.
- Worker persistente `workers/voice-sip-worker/main.mjs` com `/healthz` e shutdown gracioso.
- Migração/fix de chave composta para compatibilidade com `contacts`.
- Correção para buscar `SIP_CONNECTION_ID` via ARI REST quando `channelvars` não vem no evento.
- Documentação de handoff da sessão Claude preservada na branch Voice Core.

## Como foi validado

- Suíte Voice: 43 ficheiros, 199 testes PASS no checkout da branch Voice Core.
- Smoke do listener: PASS, incluindo conexão, rejeição segura de evento não suportado, reconexão
  e forward para CRM falso.
- ARI real na VPS: autenticação HTTP PASS; Asterisk 22.5.2 ativo; dialplan `voicecore-test`
  confirmado.
- Worker isolado na VPS: serviço systemd de teste ativo; `GET http://127.0.0.1:8091/healthz`
  respondeu `status: ok`.
- Banco da VPS: tabelas Voice aplicadas após autorização explícita; dados temporários de teste
  removidos.

## O que não foi provado

- Gate completo `bash scripts/verify-voice-core.sh` no último commit: `NOT_PROVEN`; `pnpm typecheck`
  terminou por `JavaScript heap out of memory` no runner atual.
- Chamada inbound/outbound completa por SIP/PSTN.
- Áudio bidirecional real entre Asterisk e Pipecat.
- faster-whisper, Piper/Kokoro e OpenVoice em processos live. O benchmark isolado CPU de
  faster-whisper, Piper e Kokoro foi concluído em Colab; ver a evidência referenciada abaixo.
- Transferência humana em telefone real.
- Latência, custo, disponibilidade e comportamento sob reinício em chamada real.
- Interface completa para escolha, prévia, consentimento e clonagem de voz.

## Pendências e resolução

- **Endpoint SIP:** registrar extensão/softphone real e confirmar `Available`; depois testar
  inbound/outbound. O servidor não consegue registrar o iPhone sozinho.
- **Identidade da conexão:** manter `SIP_CONNECTION_ID` no dialplan antes de `Stasis`; a leitura
  via ARI REST já foi adicionada para eventos sem `channelvars`.
- **Áudio:** ligar RTP/media bridge Asterisk ao Pipecat; conectar STT e TTS reais. O benchmark
  isolado confirmou faster-whisper CPU-viável, Piper marginal e Kokoro mais lento que tempo real;
  ainda falta testar streaming/paralelismo num host candidato. Manter Asterisk e worker na VPS de
  telefonia; colocar modelos ML num host separado se memória/GPU exigirem.
- **Número do cliente:** receber credenciais SIP/BYOC da operadora e criar a conexão no CRM; não
  criar número novo.
- **Vozes:** catálogo europeu primeiro; depois preview, perfil de voz, consentimento, revogação e
  clonagem OpenVoice opcional.
- **Gate final:** rodar o script completo num runner com heap suficiente no snapshot integrado;
  corrigir qualquer falha antes de rollout gradual.

## Invariantes

- Nunca aceitar `organization_id` do corpo como autoridade.
- Resolver tenant pela conexão SIP verificada.
- Não reabrir chamada terminal por evento atrasado.
- Não trocar `provider_call_id` já estabelecido.
- Agente `shadow` não fala.
- Recording fica OFF até policy/consentimento/disclosure aprovados.
- Não mergear para `main` sem autorização explícita.

## Atualização — investigação de 2026-08-28 (mesma data, sessão posterior)

Ler `workers/voice-sip-worker/main.mjs` e `workers/voice-sip-worker/README.md` direto no
commit `d3c97cbd` confirma: **a camada de sinalização já não é scaffold**, é entrypoint de
produção real (ARI → validação de tenant local via Postgres → listener com reconexão automática
→ forwarder chamando `/context`/`/event` do CRM por HTTP real), testado ponta a ponta com
Postgres nativo e servidor ARI falso reais. O item "Áudio" da lista de pendências acima foi
investigado a fundo: **não é mais tarefa de código pendente, é bloqueio de infraestrutura**
(`BLOCKED EXTERNAL` no próprio README do worker) — Pipecat/faster-whisper/Piper/Kokoro são
processos Python/ML que a VPS atual (2 CPU/3.7GB) não aguenta; decisão de host fixo tem custo
recorrente e precisa de autorização explícita do dono antes de provisionar.

Também achado: existe uma implementação **anterior e mais ampla** na mesma branch — Telnyx +
Patter + Deepgram + ElevenLabs (com LiveKit opcional só para takeover humano) — que este
documento e `open-source-europe.md` não descreviam. É geração antiga, superada pela decisão de
2026-08-27 registrada aqui, mantida como rede de segurança; não apagar sem decisão explícita.

Deploy do Asterisk usado na VPS **não está versionado no Git** (config manual). Antes de
escrever qualquer docker-compose/systemd, extrair a config real de lá — tarefa detalhada no novo
handoff abaixo.

## Atualização — reteste real na VPS de produção (2026-08-28, sessão posterior)

A frase acima ("Pipecat/faster-whisper/Piper/Kokoro são processos Python/ML que a VPS atual
(2 CPU/3.7GB) não aguenta") era inferência, não medição — corrigida agora com dado real. Com
autorização explícita do dono, os containers de produção foram parados, `faster-whisper` e Piper
instalados e medidos direto na VPS `lumenva-crm` (AMD EPYC-Genoa, 2 vCPU): RTF ≈ `0.07–0.08` para
os dois, mais rápido que no Colab. Containers religados e confirmados saudáveis
(`https://crm.lumenva.pt/` → `307`) logo em seguida; nenhum dado de produção foi alterado. Numa
segunda passagem no mesmo dia (novo ciclo parar/religar, mesma autorização), Kokoro também foi
testado — via container Docker descartável `python:3.12-slim` (`--rm`, contorna o bloqueio de
versão Python sem tocar no sistema da VPS): RTF `0.497–0.717`, reverte o `FAIL` do Colab (RTF
~2.0). **Isto não vira `GO` de produção** — o teste foi sequencial, engine por engine, com o CRM
inteiro parado; falta testar carga concorrente, streaming e o caminho Asterisk RTP/bridge→Pipecat
antes de decidir se um host novo é mesmo necessário. Detalhe completo:
[`docs/evidence/voice-vps-cpu-benchmark-2026-08-28.md`](../evidence/voice-vps-cpu-benchmark-2026-08-28.md).

## Atualização — primeira chamada real de ponta a ponta (2026-08-28, noite, mesma sessão)

O item 3 abaixo ("registrar endpoint e executar chamada controlada") **foi feito e passou dos
próprios objetivos** — não só registrou o softphone, como construiu (fora do repo, prova de
conceito) uma ponte de áudio completa e provou uma conversa real por voz: dono ligou, falou,
sistema ouviu, transcreveu, respondeu por voz sintetizada, e o dono ouviu a resposta no telefone.
6 bugs reais de RTP/formato foram encontrados e corrigidos nesse processo (detalhados no
documento de evidência). Config real do Asterisk foi extraída e versionada em
`ops/voice-asterisk/` (segredos redigidos).

**Isto não substitui a integração real no Voice Core do repositório** — foi feito com um script
Node ad-hoc, fora dos contratos `lib/voice/**`, sem Agent OS, sem os invariantes de tenant que a
seção "Invariantes" abaixo exige. Prova viabilidade técnica, não é o caminho de produção.

Pendências reais que sobraram: latência 5-8s/turno, sem detecção real de fim de fala, sem
integração Agent OS.

Detalhe completo bug a bug:
[`docs/evidence/voice-vps-real-call-bridge-2026-08-28.md`](../evidence/voice-vps-real-call-bridge-2026-08-28.md).

## Atualização — qualidade da voz melhorada, saudação proativa adicionada (2026-08-29)

Achado real: a voz usada era **português do Brasil**, mas a Lumenva é operação **portuguesa** —
trocado para `pt_PT-tugão-medium` (única voz europeia no Piper; masculina, saudação virou "Tó").
Velocidade ajustada (`length_scale=1.4`). Avaliação ao vivo do dono foi de "muito robótica" pra
**8,5/10**. Kokoro foi testado como TTS principal nesta ponte (não só isolado) e não superou o
Piper aqui. Também adicionada saudação proativa: a ponte fala primeiro ao atender, antes de
esperar o interlocutor. Detalhe completo na evidência acima.

## Atualização — alucinação/repetição da transcrição corrigida (2026-08-29)

Filtro de pós-processamento (`is_repetition_garbage()` em `voice_worker_server.py` na VPS)
descarta o texto reconhecido quando uma palavra domina ≥40% do total ou a proporção de palavras
únicas cai abaixo de 60% — pega tanto repetição exata (`"Entendi, entendi..."`) quanto variantes
mais sutis (`"Alô, alô. Deixe-te, te deixe tu..."`). Validado contra os 4 casos reais de
alucinação vistos na sessão anterior, 0 falsos positivos em 8 casos de teste (incluindo
repetição natural legítima). Confirmado ao vivo com nova chamada de teste.

## Atualização — exposição do Asterisk mitigada (2026-08-29)

O achado de segurança acima (Asterisk exposto a brute-force, log crescendo — chegou a 15,6GB
durante a noite) foi corrigido: log rotacionado + `logrotate` configurado, `fail2ban` instalado
com filtro próprio pro formato `res_pjsip` do Asterisk 22 (testado contra 126 mil linhas reais
antes de ativar), confirmado banindo IPs atacantes automaticamente sem afetar endpoint de teste
nem CRM. Sem allowlist fixa de IP (celular do dono usa rede móvel, IP dinâmico). Detalhe na
mesma evidência acima.

## Atualização — comparação de TTS pago, bug de NAT PJSIP achado e corrigido, sample rate corrigido (2026-08-29, sessão posterior)

Pesquisa de alternativas de TTS: OpenVoice (clonagem sobre Piper) ficou em 5/10, confirma que o
problema é cadência/prosódia, não timbre. XTTS-v2/F5-TTS têm melhor qualidade técnica mas
**licença não permite uso comercial** (Coqui não opera mais, sem caminho pra licença paga).
Chatterbox/StyleTTS2 não têm bom suporte a português. ElevenLabs confirmado 10/10 mas reverte a
decisão de produto 100%-open-source. Inworld AI identificado como alternativa paga promissora
(mais barata que ElevenLabs) mas não testado (sem toolkit Composio). OpenAI TTS (`gpt-4o-mini-tts`,
voz onyx) testado com a conta já existente do dono; áudio hoje chega íntegro e no ritmo certo,
avaliação ao vivo do dono: "boa, porém um pouco robótica" — entre Piper (8,5/10) e ElevenLabs
(10/10). Comparação seguinte entre 3 vozes OpenAI (`nova`, `shimmer`, `coral`, mesma frase,
concatenadas com pausa numa única chamada): **dono escolheu `nova`** como a melhor. Testada em
seguida `onyx` vs `nova` lado a lado, mesma chamada: **`nova` confirmada como vencedora final**
entre as vozes OpenAI testadas. **Decisão final registrada:** `nova` com `speed=0.85` (ajuste
pedido pelo dono porque a `1.0` default soava acelerada) — aprovado ao vivo ("tá bom assim").
**Importante:** só a saudação de abertura usa isso hoje; o motor de resposta contínua (`/turn`)
continua no Piper, não foi migrado.

**Substituído depois na mesma sessão por Inworld AI.** Composio tem toolkit pra Inworld
(`INWORLD_AI_SYNTHESIZE_SPEECH`), conectado nesta sessão. 3 vozes de português europeu testadas
(Leonor, Madalena, Matilde) — API já gera direto em µ-law 8kHz, sem precisar do pipeline de
resample que causou bug com a OpenAI. **Decisão final: Inworld AI, voz `Leonor`,
`speaking_rate=0.85`, modelo `inworld-tts-2`** — aprovado ao vivo ("Boa porra gostei... Tá
aprovado, gostei. Vamos fechar com esse"). Substitui `nova` como escolha de voz pra saudação.

**`/turn` migrado pra Inworld também** (`voice_worker_server_v11.py`) — as 4 respostas do modo
`scripted` (horário, iPhone, notebook, desculpa) agora usam `Leonor`/Inworld em vez de Piper,
mesma config da saudação. **Testado e aprovado ao vivo.** Ponte inteira usa uma voz só agora.

**Modo `ai_light` adicionado** (`voice_worker_server_v12.py`) — IA respondendo qualquer pergunta
(não só as 3 do roteiro), sem cair na latência de 5-9s do `openai_full`: STT local
(`faster-whisper`), resposta de texto simples via `gpt-4o-mini` (não Realtime), voz Inworld
(`Leonor`). Chave `INWORLD_API_KEY` configurada na VPS pelo dono. **Testado e aprovado ao vivo.**
Modo padrão da ponte agora é `ai_light` (`turn_mode.txt`); `scripted` e `openai_full` continuam
disponíveis, só trocar o conteúdo do arquivo.

**Skills de agente instaladas (`~/.claude/skills/`, fora do repositório):** `inworld`
(`itechmeat/llm-code`, pronta pra uso — cobre a mesma API já usada aqui) e `9router-tts`
(`decolua/9router`, **em observação** — proxy multi-provider de TTS que exige hospedar um
serviço próprio, `NINEROUTER_URL`, ainda inexistente na infraestrutura do projeto; pendência
pra quando o dono quiser montar um roteador de modelos gratuitos). Detalhe completo na evidência.

**Dois bugs reais achados e corrigidos nesta sessão** (detalhe completo, com log/comando, na
evidência linkada abaixo):

1. **NAT PJSIP**: Asterisk mandava RTP pro IP privado (Wi-Fi local) do celular em vez do IP
   público real, achado só depois de ativar `rtp set debug`/`pjsip set logger` durante uma
   chamada real (não dava pra ver isso só com o self-test local). Fix:
   `rtp_symmetric=yes` + `rewrite_contact=yes` + `force_rport=yes` no endpoint `[1000]` de
   `/etc/asterisk/pjsip.conf`. Confirmado corrigido pra sentido servidor→celular via dados
   móveis (Wi-Fi doméstico tinha NAT mais teimoso). **Sentido celular→servidor confirmado
   resolvido depois, na mesma sessão**: chamadas seguintes (dados móveis) mostraram
   `Captured 32000/32160 bytes` (janela cheia) em vez de 0, e o ciclo completo funcionou —
   dono falou "Bom dia, tudo bem? Como é que você está.", `faster-whisper` transcreveu
   **palavra por palavra correto**, Piper respondeu em modo eco. Estatísticas do próprio
   Zoiper confirmaram de forma independente (RX/TX pareados, 0% perda, 0 jitter). Não foi
   isolado se foi o fix de NAT, a troca pra dados móveis, ou os dois juntos — tratar como
   resolvido no cenário testado (dados móveis) e reconfirmar se o uso for majoritariamente
   Wi-Fi.
2. **Sample rate errado** na conversão do áudio de teste OpenAI (assumi 24kHz sem verificar,
   arquivo já era 8kHz) — causou áudio "cagado"/lento. Diagnosticado sem custo de API rodando o
   mesmo PCM pelo faster-whisper em 5 taxas candidatas e comparando qual transcrição fazia
   sentido; corrigido revertendo pra conversão direta (sem resample).

Processos da ponte (`audio_bridge_v14.mjs`, `voice_worker_server.py`) **continuam rodando na
VPS** ao fim desta sessão.

## Atualização — teste full-stack OpenAI + descoberta de `pipecat-asterisk` (2026-08-29, sessão seguinte)

Testado pipeline 100% OpenAI ao vivo (transcrição via `gpt-4o-transcribe`, resposta via
`gpt-4o-mini` real — não mais roteiro fixo — voz `nova`): qualidade aprovada (8/10, "muito bom"),
mas **latência de 5-9s por turno** (3 chamadas de API sequenciais: transcrever, pensar, falar,
cada uma esperando a anterior terminar 100%). Root cause identificado por pesquisa (não suposição):
sistemas de produção (Pipecat, LiveKit Agents) chegam a 0,7-1,1s porque fazem tudo em **streaming
sobreposto** (transcrevem enquanto você ainda fala, começam a falar a resposta antes da IA
terminar de gerar o texto inteiro) — o nosso script faz tudo sequencial, sem sobreposição.

**Achado concreto via `gh search repos`**: existe uma biblioteca pronta e mantida,
[`pipecat-asterisk`](https://github.com/NikolayShakin/pipecat-asterisk) (PyPI, 22 estrelas,
`pushedAt` 2026-06-25), que conecta Asterisk ao framework Pipecat via **WebSocket nativo do
Asterisk** (`chan_websocket`) em vez de RTP cru + ARI externalMedia (o caminho que usamos a
sessão toda). O exemplo real do repositório (`examples/pipecat_asterisk/ws_server.py`) mostra
pipeline completa: Asterisk → WebSocket → Pipecat (VAD via Silero) → Gemini Live (áudio-a-áudio
nativo) → volta pro Asterisk, tudo em streaming.

**Comparação formal feita** (remontar o script atual vs recomeçar com Pipecat +
`pipecat-asterisk`): recomendação é **recomeçar com Pipecat**. Motivo: a classe inteira de bugs
que consumiu a maior parte desta sessão (RTP indo pro IP errado, NAT, sample rate, registro
duplicado, resposta única sem loop) é especificamente do caminho RTP cru — desaparece ao trocar
para WebSocket. Streaming/VAD/interrupção vêm prontos no framework em vez de precisarem ser
construídos do zero em cima de uma base já frágil.

**Isto não foi implementado nesta sessão** — é decisão de direção para a próxima fase de
integração real, não ajuste na VPS de teste. Pendências reais antes de adotar:
- trocar config do Asterisk de ARI/externalMedia pra `chan_websocket`;
- decidir provider de IA (Gemini Live esbarra no mesmo problema de billing/prepay já documentado
  acima; OpenAI Realtime ou outro com suporte no Pipecat são alternativas a avaliar).

`OPENAI_API_KEY` foi configurada na VPS pelo dono (mesmo processo de before, nunca exposta a
mim) para viabilizar este teste; `GEMINI_API_KEY` também segue configurada de um teste anterior
(sem crédito). Nenhuma das duas foi usada em produção.

## Atualização — tentativa de migração pra Pipecat + `pipecat-asterisk` (pausada, 2026-08-29, sessão seguinte)

Depois de identificar que a latência de 5-9s do teste full-stack OpenAI (seção acima) é
arquitetural (chamadas sequenciais, sem streaming), foi feita uma comparação formal: remontar o
script atual vs recomeçar com Pipecat + `pipecat-asterisk`. **Decisão tomada foi recomeçar com
Pipecat** — motivo documentado na regra nova em `~/.claude/CLAUDE.md` ("não desista cedo, procure
implementação de referência real primeiro"), achada via `gh search repos`.

**Trabalho real feito, tudo isolado da instalação em produção (porta 5060, intocada):**

- Compilado Asterisk 22.11.0 oficial (fonte, não pacote Ubuntu — o Ubuntu só tem 22.5.2, que não
  tem o módulo `chan_websocket`, disponível só a partir de 22.6.0) em prefixo separado
  `/opt/asterisk-v2/`, porta SIP `5061`.
- Regra de firewall nova adicionada no Hetzner Cloud Firewall (UDP 5061) — o Hetzner tem firewall
  de nuvem separado do `iptables` do sistema; sem essa regra, nenhum pacote chega na porta antes
  de tocar no SO.
- `pipecat-ai` (testado 1.8.1 e 1.1.0 — biblioteca `pipecat-asterisk` só declara compatibilidade
  testada com 1.1.0) + `pipecat-asterisk` 0.1.3 instalados em venv separado
  (`/opt/voice-vps-bench-v2/`).
- Pipeline montada com `OpenAIRealtimeLLMService` (áudio-a-áudio nativo da OpenAI, já que o
  Gemini Live segue bloqueado por crédito) — **conexão com a OpenAI confirmada funcionando**
  (session.created/session.updated chegam corretamente, instrumentação direta no código da
  biblioteca provou isso).
- Corrigidos, um de cada vez, seguindo a skill `systematic-debugging`: `ice_support=no` no
  endpoint (ICE vem ligado por padrão no Asterisk novo, não faz sentido pra um softphone comum),
  `rtp.conf` criado do zero pra essa instância nova (não existia, estava tudo no default), faixa
  de porta RTP igualada à instância que funciona (10000-20000), dialplan simplificado pra bater
  com o exemplo oficial (sem `Answer()` manual antes do `Dial(WebSocket/...)`).

**Bloqueador real, não resolvido:** o áudio do celular nunca chega de fato no Asterisk-v2, mesmo
com sinalização SIP e registro funcionando perfeitamente e mesmo celular/rede que funcionam sem
problema na instância antiga (porta 5060). Confirmado por instrumentação direta no código da
biblioteca (o loop de recebimento do Pipecat só processa a mensagem de controle `MEDIA_START`,
nunca um frame de áudio binário) e por teste de isolamento com `Record()` puro no dialplan (sem
Pipecat no meio) — o arquivo de gravação nunca chega a ser criado em nenhuma tentativa real, só
funciona em self-test local (`channel originate`, sem RTP de verdade envolvido). Uma captura
pontual chegou a mostrar o Asterisk mandando RTP de saída pro IP privado interno do celular em
vez do IP público (mesma classe de bug de NAT já resolvida na instância antiga), mas mesmo depois
de confirmar `rtp_symmetric=yes`/`rewrite_contact=yes`/`force_rport=yes` corretos no endpoint,
o problema persistiu — não foi possível confirmar se essa é a causa raiz real ou só um sintoma.

**Mais de 3 tentativas de correção sem sucesso** (regra da própria skill de debugging seguida:
depois disso, parar de tentar mais fixes pontuais e questionar a arquitetura/decisão em vez de
insistir). Pausado por decisão do dono, não abandonado — retomar precisa de sessão dedicada,
idealmente comparando as duas instalações de Asterisk lado a lado com captura de pacote completa
desde o primeiro segundo da chamada (não recortes de ~40s como foi feito aqui).

**Estado ao fim desta sessão:** dono aprovou o caminho da instância antiga (porta 5060) e pediu
limpeza explícita da VPS. `asterisk-v2`, `asterisk-v2-build` e `voice-vps-bench-v2` foram
**removidos do disco** (não só parados) — retomar essa frente no futuro exige recompilar o
Asterisk 22.11.0 do zero (leva ~15-20min, processo documentado acima). Aproveitando a limpeza,
também achados e removidos **containers Docker de teste rodando havia 7-9 horas sem necessidade**
(`openvoice-svc`, `kokoro-svc` — testes de sessões anteriores já concluídos e decididos, nunca
desligados). Limpeza total liberou **14GB** de disco (39GB→25GB usados, depois 37GB→23GB após a
segunda passada dos containers). CRM confirmado saudável (`307` em `crm.lumenva.pt`) e a ponte em
uso (porta 5060) confirmada intacta e rodando depois da limpeza. A instância antiga (porta 5060,
`audio_bridge_v14/v15.mjs` + `voice_worker_server_v9/v10.py`) **continua sendo o único caminho
comprovado funcionando**.

Chave `OPENAI_API_KEY` usada nesse teste continua configurada em `/root/.bashrc` da VPS (nunca
exposta ao agente). `GEMINI_API_KEY` idem, sem crédito, não usada.

## Próximo passo

1. ~~Registrar endpoint SIP/softphone real e executar chamada controlada~~ — **feito**, ver
   atualização acima.
2. ~~Mitigar exposição do Asterisk~~ — **feito** (`fail2ban` + `logrotate`), ver atualização
   acima.
3. ~~Bloqueador: áudio celular→servidor não chegava~~ — **resolvido nesta sessão** (dados
   móveis + fix de NAT), confirmado com ciclo completo fala→STT→resposta funcionando e
   transcrição correta, **na instância antiga (porta 5060)**. Reconfirmar se o uso for
   majoritariamente Wi-Fi.
4. ~~Voz de saudação/resposta decidida, `/turn` no Piper~~ — **feito**: Inworld AI, voz `Leonor`,
   `speaking_rate=0.85`, tanto na saudação quanto nas 3 respostas do roteiro fixo + desculpa.
   Piper não é mais usado nesta ponte.
5. **Migração pra Pipecat + `pipecat-asterisk` pausada, não descartada** — ver seção acima.
   Bloqueador real: áudio celular→Asterisk-v2 (porta 5061) não flui, mesmo celular/rede que
   funcionam na instância antiga. Retomar exige sessão dedicada de comparação lado a lado.
6. ~~IA de verdade respondendo qualquer pergunta~~ — **feito**: modo `ai_light` (STT local +
   `gpt-4o-mini` texto + Inworld TTS), testado e aprovado ao vivo. Não é mais só roteiro fixo.
7. **Decisão do dono:** com sinalização + STT/TTS + ponte de áudio bidirecional + IA de verdade
   provados na instância antiga (porta 5060), avaliar se vale a pena integrar essa ponte nos
   contratos reais do Voice Core (`lib/voice/**`) em vez de manter o script ad-hoc — independente
   do resultado da migração Pipecat, que é otimização de latência, não bloqueador de viabilidade.
8. Só depois integrar seletivamente no consolidado e repetir o gate no snapshot final.
9. **Pendência nova, sem urgência:** avaliar se vale montar um roteador de modelos gratuitos
   (proxy `9Router`, self-hosted) — a skill `9router-tts` já está instalada e pronta pra uso
   assim que esse serviço existir; até lá fica só em observação.

## Referências

- [`docs/voice/open-source-europe.md`](../voice/open-source-europe.md)
- [`docs/current-state.md`](../current-state.md) §11
- [`ARCHITECTURE.md`](../../ARCHITECTURE.md) — camada Voice Core
- [`HANDOFF-voice-vps-config-2026-08-28.md`](HANDOFF-voice-vps-config-2026-08-28.md) — tarefa VPS seguinte
- Branch: `origin/implementacao-tokens-voice-core`
