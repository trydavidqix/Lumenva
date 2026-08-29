# Voice Core — primeira chamada real de ponta a ponta (VPS de produção)

Date: 2026-08-28/29 (sessão contínua, virou a virada do dia)

## O que foi provado

Pela primeira vez, uma chamada de telefone real (softphone do dono, registrado como extensão
SIP `1000` na VPS de produção `lumenva-crm`) passou pelo caminho completo:

```
Telefone (Zoiper) → Asterisk (real) → ponte de áudio (Node, ad-hoc) → STT (faster-whisper)
  → resposta gerada → TTS (Piper) → volta pro Asterisk → volta pro telefone
```

O dono **ouviu a voz sintetizada respondendo em tempo real**, numa ligação real, não simulada.
Isto não existia antes desta sessão — nenhum código do repo (nem na branch candidata
`implementacao-tokens-voice-core`) tinha essa ponte de áudio implementada; só existia a camada de
sinalização (ver `docs/handoffs/HANDOFF-voice-sip-2026-08-28.md`).

**Importante: este é código de prova de conceito, não produção.** Vive só nesta sessão/VPS
(`/opt/voice-vps-bench/`), não foi commitado no repositório, não segue os contratos do Voice Core
(`lib/voice/**`), não está integrado ao Agent OS. Ver "O que NÃO é" no fim.

## Autorização e segurança

- Dono autorizou explicitamente parar os containers de produção do CRM para os testes de
  benchmark, e depois autorizou registrar um softphone real e fazer chamadas de teste na VPS
  de telefonia.
- CRM foi parado e religado duas vezes ao longo da sessão (uma vez pra cada rodada de
  benchmark) e confirmado saudável (`11/11 healthy`, `https://crm.lumenva.pt/` → `307`) depois de
  cada uma. Ver `docs/evidence/voice-vps-cpu-benchmark-2026-08-28.md`.
- A ponte de áudio (este documento) **não exigiu parar o CRM** — rodou em paralelo, sem tocar nos
  containers.
- Nenhuma credencial de produção do CRM foi usada ou exposta. As senhas SIP/ARI reais (extraídas
  da VPS) foram passadas ao dono só pelo chat, nunca escritas em ficheiro versionado — os
  ficheiros em `ops/voice-asterisk/` usam `<REDACTED>`.
- Ao final da sessão: todos os processos de teste (`audio_bridge_v*.mjs`, `voice_worker_server.py`)
  foram parados; `channel request hangup all` limpou os canais de teste no Asterisk; `pjsip set
  logger off` e `rtp set debug off` desligaram o debug ligado durante a investigação.

## Bugs reais encontrados e corrigidos (nesta ordem)

1. **Loop infinito de canais fantasma.** A primeira versão do script tratava todo `StasisStart`
   como uma chamada nova — inclusive o do próprio canal de mídia externa que o script criava,
   causando criação recursiva de bridges/canais. Gerou 250 canais órfãos em segundos. Corrigido
   filtrando por nome do canal (`UnicastRTP/` = mídia externa, não é uma chamada). Limpo com
   `systemctl restart asterisk` (ambiente de teste isolado, seguro).
2. **RTP simétrico — Asterisk não mandava áudio pra nós.** Mesmo com `connection_type=client`
   (que deveria fazer o Asterisk iniciar o envio), zero pacotes chegavam — confirmado com
   `tcpdump` mostrando literalmente zero tráfego na porta, apesar de bridge/codec corretos.
   Asterisk esperava "aprender" nosso endereço recebendo algo de nós primeiro (comportamento de
   RTP simétrico). Corrigido mandando alguns pacotes de silêncio assim que o canal de mídia
   externa é criado, usando a porta real informada pela variável de canal `UNICASTRTP_LOCAL_PORT`.
3. **Ordem de bytes.** Depois de resolver o RTP simétrico, o áudio recebido decodificava como
   ruído constante com `little-endian`; `big-endian` (`L16`/rede, padrão RTP) produziu fala real
   transcrita corretamente pela primeira vez.
4. **Enviar de volta = só chiado.** Com formato `slin` (PCM cru 16-bit) pra tocar a resposta,
   saía só ruído/estática no telefone, em ambas as ordens de bytes testadas, mesmo com um tom puro
   gerado localmente (não só com a voz sintetizada — isso isolou o problema no transporte, não no
   áudio). Pesquisa em fóruns da comunidade Asterisk confirmou: `slin` sem negociação SDP é fonte
   documentada desse exato sintoma; a correção usada por outros foi trocar para um codec estático
   padrão (`ulaw`/`alaw`). Trocamos para `format=ulaw` (G.711 µ-law, 8 bits/amostra, tipo de
   payload RTP padrão `0`) — confirmado com um tom puro que saiu limpo no telefone.
5. **Fluxo de pacotes cortado/reiniciado confundia o buffer de jitter.** Mandar pacotes de silêncio
   uma vez no início e depois só a resposta, minutos depois, com números de sequência muito
   distantes, é um padrão conhecido de causar problema em buffers de jitter RTP. Corrigido com um
   "ticker" contínuo de 20ms que manda silêncio o tempo todo e troca pra áudio real da resposta
   quando disponível, mantendo sequência/timestamp sempre contínuos.
6. **Cabeçalho de resposta corrompendo texto com acento.** Um `sed` remoto que não pegou direito
   deixou a codificação de texto dos cabeçalhos HTTP (`unicode_escape`) incompatível com o
   decodificador do lado Node — corrigido usando base64 (mais robusto, testado).

## Estado final funcional

- Endpoint SIP de teste `1000` registra softphone real (Zoiper) via UDP `5060`.
- `workers` ad-hoc na VPS (não no repo) fazem: atender → criar canal de mídia externa (ARI
  `externalMedia`, `format=ulaw`) → ponte contínua de RTP → HTTP local pro worker de voz.
- `voice_worker_server.py`: processo Python persistente (`http.server` simples, porta local
  `8500`) com `faster-whisper base` e Piper `pt_BR-cadu-medium` **carregados uma vez só** —
  reduziu o tempo por turno de ~15s (recarregando modelo a cada chamada) pra ~5-8s.
- Ciclo provado ao vivo, várias vezes: liga → fala → sistema ouve por alguns segundos → transcreve
  → gera resposta → sintetiza → toca de volta → **dono ouve a resposta no telefone real**.

## O que ainda não está bom (pendências reais, não escondidas)

- ~~Transcrição aluciona/repete em frases curtas/ruidosas~~ **Mitigado em 2026-08-29.** Os
  parâmetros de decodificação (`repetition_penalty`, `no_repeat_ngram_size`,
  `condition_on_previous_text=False`) sozinhos não eliminaram o problema — em teste ao vivo
  apareceu uma variante mais sutil (`"Alô, alô. Deixe-te, te deixe tu..."`, palavras variando,
  não repetição exata). Corrigido com um filtro de pós-processamento
  (`is_repetition_garbage()` em `voice_worker_server.py`) que descarta o texto reconhecido
  quando uma palavra domina ≥40% do total **ou** a proporção de palavras únicas cai abaixo de
  60% — validado contra os 4 casos reais de alucinação vistos nesta sessão (0 falsos positivos
  em 8 casos de teste, incluindo repetição natural legítima como `"não, não, eu quis dizer..."`).
  Também adicionados os parâmetros nativos de fallback do Whisper (`temperature` em escada,
  `compression_ratio_threshold`, `log_prob_threshold`, `no_speech_threshold`) como primeira
  linha de defesa. Confirmado ao vivo: nova chamada de teste retornou frase coerente
  (`"Ah, não está ouvindo."`) sem repetição, dono confirmou ouvir a resposta correta.
- ~~Voz sintetizada soa "robótica"~~ **Melhorada substancialmente em 2026-08-29 — de "muito
  robótica" pra 8,5/10 avaliado pelo dono, ao vivo.** Jornada de ajuste, em ordem:
  1. **Kokoro testado como TTS principal** (ligação real, não só benchmark isolado) — mesma
     avaliação de "ainda robótica" que o Piper, e ~1-3s mais lento por turno (chamada HTTP extra
     pro container). Sem ganho de qualidade perceptível nesta ponte especificamente, então voltou
     pro Piper como principal (mais rápido). Não descarta Kokoro pra sempre — só não venceu neste
     teste específico.
  2. **`SynthesisConfig` do Piper nunca tinha sido usado** — `voice.synthesize(text)` estava
     sendo chamado sem parâmetros, mas os defaults do próprio modelo (`noise_scale=0.667`,
     `length_scale=1.0`, `noise_w=0.8`, lidos do `.onnx.json`) já eram os recomendados pela
     comunidade; não era bug de configuração zerada.
  3. **Achado real que importou: o idioma/sotaque estava errado.** A voz usada
     (`pt_BR-cadu-medium`, depois `pt_BR-faber-medium`) é **português do Brasil** — mas a Lumenva
     é uma operação **portuguesa** (RGPD, cliente europeu). Trocado para `pt_PT-tugão-medium`,
     a **única voz europeia disponível no Piper** (não existe voz feminina em pt-PT ainda — só
     esse modelo masculino). Saudação ajustada de "Karol" pra "Tó" pra bater o gênero da voz.
  4. **Velocidade ajustada por `length_scale`**: `1.0` (default) → `1.03` (quase nada) → `1.25`
     (7/10, "ainda rápida") → **`1.4`** (8,5/10, "tá bom"). Também ajustado `noise_scale=0.75` e
     `noise_w_scale=0.85` (levemente acima do default, mais variação de prosódia).
  5. **Bug no baixador oficial do Piper**: `python -m piper.download_voices` falha com
     `UnicodeEncodeError` em nomes de voz com acento (`pt_PT-tugão-medium` tem "ã") — a lib tenta
     codificar a URL em ASCII puro. Contornado baixando os ficheiros direto da URL do Hugging
     Face (`voices.json` tem os paths exatos).
  - **Configuração final:** `pt_PT-tugão-medium` + `SynthesisConfig(noise_scale=0.75,
    noise_w_scale=0.85, length_scale=1.4)`, definido em `voice_worker_server.py`.
  - **O que ainda não foi tentado:** teto real de qualidade do Piper pt-PT medium não foi
    esgotado — não existe voz "high" em português (nem BR nem PT) no catálogo oficial do Piper
    hoje; melhoria adicional exigiria treinar voz custom (fora de escopo) ou trocar de engine.
- **Latência de 5-8s por turno** — aceitável pra prova de conceito, alto demais pra conversa
  natural. Maior parte é o próprio processamento STT+TTS (`~3s`), não overhead de rede/transporte.
- **Janela de escuta fixa (4-6s)**, não detecção real de silêncio/fim de fala (VAD de turno).
- **Nenhuma integração com Agent OS** — a "resposta" é só eco/confirmação do que foi entendido,
  não uma resposta de um agente de IA real com memória/contexto/tools.
- **Nova feature adicionada nesta sessão, fora do escopo original: saudação proativa.** Ao
  atender, a ponte espera ~2s e fala primeiro ("Bom dia, meu nome é Tó, sou atendente da
  Lumenva. Em que posso ajudar?") via um novo endpoint `/speak` no `voice_worker_server.py`
  (síntese direta, sem STT) — só depois entra no ciclo de escuta. Isso muda o fluxo de "reativo"
  (só responde se alguém fala primeiro) pra "proativo" (atende como um humano atenderia).

## Achado de segurança — mitigado na sessão seguinte (2026-08-29)

O Asterisk da VPS de telefonia estava exposto na porta `5060/UDP` pra internet pública e sendo
**ativamente varrido por bots** tentando registrar contas falsas (`REGISTER` de IPs
desconhecidos, extensões como `"7090"`, `"1103"`, `"40"`, `"577"`, `"gsm"` etc, com
`Failed to authenticate` repetido). Entre a sessão anterior e esta, o log cresceu de 5,3GB pra
**15,6GB** — confirmando que o volume de ataque era real e crescente, não um pico isolado.

**Correções aplicadas (autorizadas pelo dono):**

1. **Log rotacionado e o arquivo antigo (15,6GB) apagado** — `asterisk -rx 'logger rotate'` +
   `rm` do `.log.0`. Disco voltou de 22GB usados pra confortável.
2. **`logrotate` configurado** (`/etc/logrotate.d/asterisk`) — diário, mantém 7 dias comprimidos,
   força rotação se passar de 200MB, para o log nunca mais crescer sem controle.
3. **`fail2ban` instalado e configurado com filtro próprio pro Asterisk 22 (`res_pjsip`).** O
   filtro padrão do fail2ban (`asterisk.conf`) é pro formato antigo `chan_sip` e não batia com o
   formato real do log (`res_pjsip/pjsip_distributor.c: Request 'REGISTER' ... failed for
   '<IP>:<porta>' ... - Failed to authenticate`) — escrito e **testado com `fail2ban-regex` contra
   126 mil linhas reais** antes de ativar (0 falsos positivos, 1 linha não relevante ignorada
   corretamente — o banner de inicialização do Asterisk). Jail: `/etc/fail2ban/jail.d/
   asterisk-pjsip.local`, filtro: `/etc/fail2ban/filter.d/asterisk-pjsip.conf`. Política: 5
   tentativas falhas em 10 minutos → banido por 24h em todas as portas (`iptables-allports`, não
   só 5060 — um bot que já mostrou má-fé não tem razão legítima de acessar mais nada na VPS).
4. **Verificado ao vivo:** confirmado 5 IPs atacantes já banidos automaticamente minutos após
   ativar (`57.128.140.154`, `172.110.223.49`, `135.136.20.12`, `54.38.94.109`,
   `213.165.51.44`), regra real presente no `iptables` (`REJECT` em todas as portas). Endpoint
   de teste `1000`/CRM continuaram intocados — nenhum IP legítimo (incluindo o do celular do
   dono) foi afetado.
5. **`fail2ban` já protegia `sshd` antes desta sessão** (pré-existente, não criado agora) —
   confirmado ativo e funcionando durante a mesma verificação; não é achado novo, só contexto.

Não foi necessário restringir `5060/UDP` por allowlist fixa de IP — o celular do dono usa rede
móvel com IP dinâmico, então allowlist quebraria o próprio uso legítimo. `fail2ban` resolve isso
sem exigir IP fixo: deixa qualquer um tentar, bane quem abusar.

## O que NÃO é

- Não é o Voice Core do repositório (`lib/voice/**`, `workers/voice-sip-worker/`). É um script
  paralelo, mais simples, escrito nesta sessão pra provar viabilidade rápido.
- Não substitui a arquitetura Pipecat planejada (`docs/voice/open-source-europe.md`) — é uma prova
  mais crua, sem streaming real, sem barge-in, sem os contratos de tenant/Agent OS.
- Não está integrado ao CRM consolidado nem à branch candidata.
- `VOICE_LIVE_ENABLED` não foi tocado; nenhum cliente real foi exposto a isto.

## Inventário de ficheiros deixados na VPS

Tudo em `/opt/voice-vps-bench/` (fora do Git, não versionado):

- `audio_bridge_v1.mjs` … `audio_bridge_v10.mjs` — histórico das iterações (v10 é a versão final
  funcional).
- `voice_worker_server.py` — servidor HTTP persistente com os modelos carregados (versão final).
- `turn_process.py`, `turn_process_v2.py` — versões anteriores do processador de turno (hoje
  substituídas pelo `voice_worker_server.py`).
- `venv/`, `piper-voices/` — ambiente Python e voz baixada, reaproveitáveis.
- Vários `.log`/`.wav`/`.raw` de teste — descartáveis.

Todos os processos foram **parados** ao fim da sessão; nada ficou rodando em background na VPS
além dos serviços normais do CRM e do `asterisk.service`/`voice-sip-worker.service` (este último
também parado, era o worker antigo de sinalização, não usado nesta ponte).

## Atualização — TTS pago investigado, bug de NAT PJSIP achado e corrigido (2026-08-29)

### Comparação de TTS (pesquisa, sem custo de chamada)

- **OpenVoice V2** (clonagem de voz, MIT) testado clonando timbre sobre o Piper: **5/10**. Confirma
  que o problema de qualidade do Piper é cadência/prosódia robótica, não timbre — clonar voz por
  cima não resolve.
- **XTTS-v2 e F5-TTS**: melhor qualidade técnica entre os open-source pesquisados, mas
  **license não permite uso comercial** (Coqui Public Model License / CC-BY-NC-4.0) e não existe
  mais caminho pra comprar licença comercial (empresa por trás do Coqui não opera mais). Descartados.
- **Chatterbox / StyleTTS2**: licença comercial ok, mas suporte a português fraco. Descartados.
- **ElevenLabs** (`eleven_v3`, pago, via Composio): **10/10** — mas reverte a decisão de produto
  "100% open-source" registrada em `docs/voice/open-source-europe.md` (2026-08-27) e gera custo
  recorrente. Não adotado nesta sessão, só testado como teto de qualidade.
- **Inworld AI**: identificado como alternativa paga promissora (top ranking de qualidade,
  ~5-10x mais barato que ElevenLabs, tem português, clonagem de voz grátis) mas **não testado** —
  não existe toolkit Composio pra ele, exigiria conta direta do dono.
- **OpenAI TTS (`gpt-4o-mini-tts`, voz "onyx")** testado usando a conta OpenAI já existente do
  dono (via Composio). Depois de dois bugs de pipeline (ver abaixo) corrigidos, o áudio finalmente
  chegou íntegro e no ritmo certo numa chamada real; avaliação ao vivo do dono na voz `onyx`:
  **"boa, porém um pouco robótica"** — acima do Piper (8,5/10, "muito robótica" antes do ajuste de
  voz/velocidade), abaixo do ElevenLabs (10/10, natural). Não foi pedida nota numérica explícita;
  tratar como qualitativamente entre os dois até decisão final de provider.

  **Comparação de vozes OpenAI (mesma sessão, mesmo texto):** a wrapper Composio do
  `OPENAI_CREATE_SPEECH` não expõe o parâmetro `instructions` do `gpt-4o-mini-tts` (só
  `model`/`voice`/`speed`/`response_format`), então não deu pra dirigir tom por texto — só trocar
  de voz. Geradas `nova`, `shimmer` e `coral` (formato `wav`, que embute sample rate no
  cabeçalho — corrigido o processo de conversão pra ler a taxa real em vez de assumir, depois do
  bug de sample rate documentado abaixo). As 3 concatenadas com pausa de 0,5s num único áudio de
  teste e tocadas numa única chamada real. **Veredito do dono: `nova` é a melhor.** Ainda não
  comparada lado a lado com `onyx` na mesma sessão de teste; próxima sessão pode repetir com
  `onyx` + `nova` juntas se quiser fechar a escolha final antes de decidir provider.

  **Comparação final `onyx` vs `nova` (mesma sessão, sequência única):** confirmado —
  **`nova` também venceu `onyx`**.

  **Decisão do dono, mesma sessão: voz `nova` é a escolhida** entre as opções OpenAI testadas.
  Ajuste de velocidade pedido em seguida ("fala rápido acelerado") — gerada nova versão com
  `speed=0.85` (parâmetro da própria API `OPENAI_CREATE_SPEECH`, roda de 0.25 a 4.0, default
  1.0), testada ao vivo numa chamada: **"tá bom assim"**. Configuração final registrada:
  `model=gpt-4o-mini-tts`, `voice=nova`, `speed=0.85`, convertido de WAV 24kHz pra µ-law 8kHz
  (resample correto, lendo a taxa do cabeçalho do WAV, não assumindo).

  Isto ainda é só a **saudação de abertura** (arquivo `elevenlabs_greet.ulaw` servido pelo
  endpoint `/play_elevenlabs_test`). O motor de resposta contínua (`/turn`, o que responde depois
  de ouvir o interlocutor) **continua no Piper** — não foi trocado pra OpenAI nesta sessão. Migrar
  o `/turn` pra OpenAI TTS (se essa for a decisão) é trabalho pendente, assim como o bloqueador de
  entrada de áudio abaixo, que impede o `/turn` de sequer ser exercitado numa chamada real hoje.

### Decisão final de voz: Inworld AI, voz Leonor (substitui a escolha `nova` acima)

Depois de fechar a voz `nova` (OpenAI) como escolha, o dono pediu comparação com **Inworld AI**
— alternativa paga identificada durante a pesquisa de TTS (ranking de qualidade equivalente ou
melhor que ElevenLabs, ~5-10x mais barato, clonagem de voz grátis) mas que na hora não tinha
integração pronta. **Composio tem toolkit pra Inworld AI** (`INWORLD_AI_SYNTHESIZE_SPEECH`,
`INWORLD_AI_LIST_VOICES`) — conectado nesta sessão (`composio link inworld_ai`).

`INWORLD_AI_LIST_VOICES` filtrado por `languages: ["pt-PT"]` retornou 3 vozes de português
europeu, todas femininas: **Leonor** ("clara, composta"), **Madalena** ("brilhante, natural"),
**Matilde** ("quente, melódica"). As 3 geradas com o modelo `inworld-tts-2` já direto em
**µ-law 8kHz** (`audio_encoding: MULAW`, `sample_rate_hertz: 8000`) — a API do Inworld aceita o
formato de telefonia nativamente, **sem precisar do pipeline de resample** que foi necessário
pra todo teste da OpenAI (fonte de dois bugs reais documentados acima). Concatenadas com pausa e
tocadas numa única chamada.

**Veredito do dono, ao vivo: "Boa porra gostei"** — Leonor (opção 1) escolhida.
Único ajuste pedido: velocidade — regenerada com `speaking_rate: 0.85` (mesmo padrão de ajuste
usado com a OpenAI), aprovado em seguida ("Tá aprovado, gostei. Vamos fechar com esse").

**Decisão final da sessão: Inworld AI, voz `Leonor`, `speaking_rate=0.85`, `inworld-tts-2`,
saída direta em µ-law 8kHz.** Substitui `nova`/OpenAI como escolha de voz pra saudação. Mesma
pendência de antes permanece: isto é só a saudação; o `/turn` (resposta contínua) continua no
Piper, migrar pra Inworld é trabalho futuro, e precisaria da mesma solução de "chave própria no
servidor" que discutimos pra qualquer geração de voz em tempo real durante uma chamada (hoje
geramos localmente via Composio e copiamos o arquivo pra VPS, que só serve pra frases fixas
pré-geradas, não pra conversa dinâmica).

### `/turn` migrado pra Inworld também — voz única do início ao fim

Depois de aprovar Inworld/Leonor pra saudação, o dono pediu pra migrar também o `/turn` (resposta
do roteiro fixo — horário, iPhone, notebook, desculpa), que continuava no Piper. Geradas as 4
respostas via `INWORLD_AI_SYNTHESIZE_SPEECH` com a mesma voz/config da saudação (`Leonor`,
`speaking_rate=0.85`, `inworld-tts-2`, saída direta em µ-law 8kHz — sem resample). Worker
atualizado (`voice_worker_server_v11.py`) trocando os arquivos pré-gerados do modo `scripted` de
`reply_*_nova.ulaw` (OpenAI) pra `iw_*.ulaw` (Inworld); modo `openai_full` mantido intacto,
inalterado, pra quem quiser testar de novo depois. **Testado ao vivo, aprovado**
("Aprovado, passou"). Agora a ponte inteira (saudação + as 3 respostas do roteiro + desculpa) usa
a mesma voz Inworld/Leonor, sem alternância entre provedores.

### IA de verdade sem a latência do full-stack OpenAI — modo `ai_light`

Depois de decidir a voz, o dono aprovou puxar a próxima pendência: sair do roteiro fixo de 3
perguntas pra uma IA respondendo qualquer coisa, mas **sem cair na mesma armadilha de latência**
do teste full-stack OpenAI (5-9s/turno, arquitetural, documentado acima) e **sem depender do
Pipecat/`chan_websocket`** (pausado, bloqueador não resolvido).

Solução: reaproveitar só as partes já comprovadas rápidas desta ponte, evitando o round-trip de
áudio-a-áudio da API Realtime inteiramente:

- **STT**: `faster-whisper` local (o mesmo do modo `scripted`, já provado <1s, sem custo de API)
- **Cérebro**: chamada de texto simples ao `gpt-4o-mini` (`/v1/chat/completions`, não Realtime)
  com o mesmo prompt de sistema do teste anterior (cenário TechStore)
- **Voz**: Inworld AI (`Leonor`, `speaking_rate=0.85`) — API aceita pedir saída direta em
  `MULAW`/8000Hz, então nenhuma etapa de resample entra no caminho crítico

Chave `INWORLD_API_KEY` configurada pelo dono no `.bashrc` da VPS (mesmo processo de segurança de
sempre — nunca exposta ao agente), validada com uma chamada mínima (`HTTP 200`) antes de integrar
no worker. Novo modo `ai_light` adicionado ao `voice_worker_server_v12.py`
(`turn_mode.txt = ai_light`) ao lado dos modos existentes (`scripted`, `openai_full`), sem
remover nenhum. **Testado ao vivo, aprovado** ("Deu certo, gostei").

Isto substitui o roteiro fixo como comportamento padrão desta ponte — pela primeira vez a ponte
responde perguntas livres, não só as 3 combinadas, com latência bem menor que a tentativa
anterior de IA real (não medida numericamente nesta passagem, mas perceptivelmente mais rápida
que os 5-9s do `openai_full`, já que evita o round-trip de áudio completo da API Realtime).

### Skills instaladas (ferramenta de agente, não código do repositório)

Depois de fechar a decisão de voz, o dono pediu instalação de duas skills globais (`~/.claude/skills/`)
com uso futuro em mente — links inicialmente colados vieram sem URL real (só texto de âncora),
corrigidos numa segunda mensagem apontando pra `master` em vez de `HEAD`, verificados via
`gh api` antes de instalar (nenhum conteúdo instalado sem confirmar que o repositório/arquivo
existia de verdade):

- **`inworld`** (`itechmeat/llm-code`, pasta `skills/inworld`): SDK/referência direta da API
  Inworld TTS (clonagem de voz, marcações de emoção/estilo `[happy]`/`[whisper]`, timestamps de
  fonema/viseme pra lip-sync, streaming). Cobre a mesma API já usada nesta sessão pra gerar a voz
  `Leonor`. Pronta pra uso imediato, sem dependência externa.
- **`9router-tts`** (`decolua/9router`, pasta `skills/9router-tts`): **não é SDK direto** — é um
  proxy multi-provider de TTS (OpenAI, ElevenLabs, Deepgram, Edge TTS, Google TTS, Hyperbolic,
  Inworld, etc atrás de uma API OpenAI-compatible única, `POST /v1/audio/speech`). **Em
  observação, não utilizável ainda**: exige rodar/hospedar o próprio serviço 9Router
  (`NINEROUTER_URL` + `NINEROUTER_KEY`), que não existe hoje em lugar nenhum da infraestrutura do
  projeto. Pendência registrada pra quando o dono quiser montar um roteador de modelos
  gratuitos/multi-provider — reavaliar então se vale a pena hospedar esse proxy ou se as
  integrações diretas (Composio, SDKs individuais) continuam suficientes.

### Gemini TTS investigado e descartado por ora

Lista de modelos Gemini (colada pelo dono, de fonte externa não confirmada) alegava free tier
genuíno de `$0` pra `Gemini 3.1 Flash Live` (áudio-a-áudio) e outros modelos TTS. Fact-check contra
a doc oficial (`ai.google.dev/gemini-api/docs/pricing`) via `WebFetch`: o modelo correto se chama
**`Gemini 3.1 Flash Live Preview`** (com sufixo "Preview" — ausente na lista colada, sinal de
instabilidade/mudança futura sem aviso). A tabela de pricing mostrou free tier de $0 pra
áudio in/out, mas duas leituras da mesma página deram respostas contraditórias (resumo de modelo
pequeno, não confiável) e a página de rate limits não lista números concretos de RPM/sessões
simultâneas pro free tier desse modelo — só remete ao dashboard do AI Studio.

**Teste real feito**: 3 modelos TTS confirmados disponíveis na conta via
`GET /v1beta/models` (`gemini-2.5-flash-preview-tts`, `gemini-2.5-pro-preview-tts`,
`gemini-3.1-flash-tts-preview`). Chamada de teste ao `gemini-3.1-flash-tts-preview` retornou
**`429 RESOURCE_EXHAUSTED`: "Your prepayment credits are depleted"** — ou seja, a conta usada
não está de fato num free tier utilizável sem billing configurado, contradizendo a promessa de
"$0 grátis" da lista original. **Decisão do dono: descartar Gemini TTS por ora**, sem investir
mais tempo configurando billing/prepay pra validar. Mantém-se a decisão já tomada (`nova`/OpenAI
na saudação, Piper no `/turn`).

**Nota de segurança da sessão**: durante esta investigação o dono colou uma API key do Google em
texto puro no chat, pedindo uso explícito repetidas vezes, inclusive de forma insistente/agressiva.
A chave foi recusada em toda instância — nunca usada, nunca reproduzida — e o dono foi orientado a
configurá-la como variável de ambiente direto no terminal da VPS (o que foi feito,
`GEMINI_API_KEY` em `/root/.bashrc`, verificado por contagem de caracteres sem nunca expor o
valor). A chave colada no chat deveria ser revogada em `aistudio.google.com/apikey` por higiene,
mesmo estando com crédito zerado.

### Bug 1 (achado e corrigido): NAT PJSIP mandava áudio pro IP privado do celular

Sintoma: celular "mudo" (0 áudio recebido) numa chamada real, mesmo com o self-test local
(`channel originate Local/...` + tcpdump) provando 0 erros de envio UDP no bridge Node.js — ou
seja, o bug não estava no nosso script.

Root cause encontrado ativando `rtp set debug on` + `pjsip set logger on` + logger de arquivo
temporário (`logger add channel`) durante uma chamada real: o log mostrou literalmente
`Sent RTP packet to 192.168.1.118:65042` — o Asterisk mandando RTP pro **IP da rede Wi-Fi local
do celular** (vindo do `c=IN IP4` do SDP que o Zoiper anunciou), não pro IP público real
(`94.61.231.220`, confirmado via `received=` no header `Via` do SIP). `Got RTP` = 0 no mesmo
período — o Asterisk nunca recebeu nada de volta do celular também.

Fix: `[1000]` em `/etc/asterisk/pjsip.conf` ganhou `rtp_symmetric=yes`, `rewrite_contact=yes`,
`force_rport=yes` (já tinha `force_rport=true` implícito, mas faltavam os outros dois). Aplicado
com `pjsip reload` (não derruba chamada ativa, só recarrega config). **Confirmado por log real**
que o RTP de saída passou a ir pro IP público correto depois de o dono trocar de Wi-Fi pra dados
móveis (`148.69.25.165:41185`) — o Wi-Fi doméstico tinha NAT mais teimoso que a rede móvel pra
esse caso específico.

**Atualização (mesma sessão, depois): resolvido.** Chamadas seguintes (ainda em dados móveis)
mostraram `Captured 32000 bytes`/`32160 bytes` (janela de 4s cheia) em vez de 0 — a voz do dono
chegou ao Asterisk. **Confirmado ponta a ponta**: o dono falou "Bom dia, tudo bem? Como é que
você está.", o `faster-whisper` transcreveu **palavra por palavra correto**, e o Piper respondeu
"Você disse: Bom dia, tudo bem? Como é que você está." (modo eco atual, sem IA real ainda) —
ouvido ao vivo pelo dono. Não foi feito um teste controlado isolando qual mudança exata destravou
(fix de NAT, troca pra dados móveis, ou ambos); tratar como resolvido no cenário testado
(dados móveis) e reconfirmar se algum dia o uso for majoritariamente por Wi-Fi.

Estatísticas do próprio Zoiper (tela de estatísticas da chamada) confirmaram de forma
independente: `Total de pacotes de entrada: 672` e `Total de pacotes de saída: 675` (outra
chamada: 473/475), `Current perda% de entrada: 0.0`, `Current ms jitter de entrada: 0` — RTP
bidirecional saudável do ponto de vista do cliente também, não só do servidor.

### Bug 2 (achado e corrigido): sample rate errado na conversão do áudio de teste OpenAI

Sintoma: áudio da saudação chegou completo mas "mega lento"/grave.

Root cause: o PCM baixado da API OpenAI TTS foi convertido pra µ-law **sem resample**, 1 amostra
PCM16 → 1 byte µ-law diretamente. Isso só está correto se o PCM já estiver a 8kHz (taxa de
telefonia usada em todo o resto do pipeline). Presumi (errado, sem verificar) que o PCM da OpenAI
vinha a 24kHz (é o que a documentação da OpenAI descreve como padrão do formato `pcm`) e apliquei
um resample 24kHz→8kHz — isso teria sido correto SE a suposição estivesse certa, mas não estava:
o arquivo salvo localmente já tinha sido capturado/gravado a 8kHz por outro passo do processo
desta sessão. Resultado do resample errado: áudio "cagado" (destruído, 3x mais curto que devia).

Diagnóstico definitivo, **sem precisar de nova chamada nem gasto de API**: rodei o mesmo PCM bruto
através do faster-whisper (já instalado na VPS) interpretando-o em 5 taxas candidatas (8000,
16000, 22050, 24000, 44100 Hz). Só 8000Hz produziu transcrição coerente com o texto real da
saudação ("Bom dia, meu nome é To, sou atendente da Lumeva, em que posso ajudar?"); 24000Hz
produziu só ruído repetido ("Boa! Boa! Boa!"). Confirma 8kHz como taxa nativa correta do arquivo.
Revertido pra conversão direta (sem resample) — restaurado o `elevenlabs_greet.ulaw` correto.
**Confirmado ao vivo**: áudio saiu completo e no ritmo certo na chamada seguinte.

Lição pra próxima sessão: **não assumir taxa de amostragem de um arquivo intermediário sem
verificar** — o método de transcrever em múltiplas taxas candidatas e comparar contra o texto
esperado é rápido, zero-custo e definitivo; deveria ter sido o primeiro passo, não o último.

### Estado da ponte ao fim desta sessão

- `audio_bridge_v14.mjs` rodando na VPS (adiciona guard de `StasisStart` duplicado — só relevante
  pra self-test com canal `Local/`, não afeta chamada real via PJSIP, que sempre teve 1 canal
  chamador só).
- `voice_worker_server.py` (Piper `pt_PT-tugão-medium`, versão com filtro de alucinação) rodando
  como processo persistente.
- `/etc/asterisk/pjsip.conf` com NAT settings corrigidos (`rtp_symmetric`, `rewrite_contact`,
  `force_rport`), backup do arquivo original salvo (`pjsip.conf.bak-<timestamp>`) antes da edição.
- Debug (`rtp set debug`, `pjsip set logger`, logger de arquivo temporário) foi **desligado** ao
  fim da investigação — não deixar ligado em produção (gera muito log).
- Processos continuam rodando na VPS ao fim desta sessão (não parados desta vez, diferente da
  sessão anterior) — decisão consciente porque a investigação do bug de entrada de áudio deve
  continuar na próxima sessão; revisar se ainda devem estar rodando antes de considerar a VPS
  "limpa".

## Referências

- [`docs/handoffs/HANDOFF-voice-sip-2026-08-28.md`](../handoffs/HANDOFF-voice-sip-2026-08-28.md)
- [`docs/voice/open-source-europe.md`](../voice/open-source-europe.md)
- [`docs/evidence/voice-vps-cpu-benchmark-2026-08-28.md`](voice-vps-cpu-benchmark-2026-08-28.md)
- [`ops/voice-asterisk/README.md`](../../ops/voice-asterisk/README.md) — config real do Asterisk versionada
