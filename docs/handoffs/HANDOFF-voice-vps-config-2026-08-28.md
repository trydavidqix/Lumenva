# HANDOFF — Extrair config real do Asterisk + avaliar viabilidade do áudio de IA — 2026-08-28

Este handoff é para a sessão/agente com acesso à VPS de telefonia (Asterisk 22.5.2). Duas tarefas
independentes, pode fazer em qualquer ordem.

**Atualização 2026-08-28:** Tarefa 1 foi executada em leitura remota. A configuração redigida está
em [`docs/evidence/voice-vps-config-2026-08-28/README.md`](../evidence/voice-vps-config-2026-08-28/README.md).
Tarefa 2 foi concluída em sandbox hospedado do Google Colab, sem acesso à VPS. O benchmark corrigido
usou áudio de aproximadamente 10 segundos, Python 3.12.13 e CPU-only; os números estão em
[`docs/evidence/voice-colab-cpu-benchmark-2026-08-28.md`](../evidence/voice-colab-cpu-benchmark-2026-08-28.md).
Não houve uso de credenciais de produção, alteração no Asterisk ou integração com chamada real.

**Atualização 2026-08-28 (sessão posterior, Claude direto na VPS de produção):** o dono pediu e
autorizou explicitamente reteste real na VPS `lumenva-crm` (não sandbox), depois de perceber que
o Colab tinha ~3x mais RAM que a VPS de verdade. Containers de produção parados
(`docker compose -f docker-compose.prod.yml stop` + `docker stop` em mem0/graphiti/neo4j),
`faster-whisper` e Piper instalados num venv em `/opt/voice-vps-bench/` e medidos: RTF ≈
`0.07–0.08` pros dois — bem mais rápido que no Colab, apesar da VPS ter menos RAM. Containers
religados e verificados saudáveis (`https://crm.lumenva.pt/` → `307`) logo depois; nenhum dado de
produção foi tocado. **Kokoro também foi testado**, numa segunda passagem no mesmo dia (o dono
pediu explicitamente): `kokoro==0.9.4` exige Python `<3.13` e a VPS só tem `3.14` via apt, então
rodou dentro de um container Docker descartável `python:3.12-slim` (`docker run --rm`, nada ficou
instalado no sistema) — RTF `0.497–0.717`, reverte o `FAIL` do Colab (RTF ~2.0). Números completos
e o que esse teste **não** prova (carga concorrente, streaming, CRM+Asterisk rodando junto) em
[`docs/evidence/voice-vps-cpu-benchmark-2026-08-28.md`](../evidence/voice-vps-cpu-benchmark-2026-08-28.md).

## Contexto

- Branch de código: `origin/implementacao-tokens-voice-core` @ `d3c97cbd8d3ca8ca5616e05f23411e52520a5a3a`.
- A camada de sinalização SIP/BYOC (ARI, listener, forwarder pro CRM) já está implementada e
  testada — não mexer nela sem motivo. Ver `docs/handoffs/HANDOFF-voice-sip-2026-08-28.md`.
- O que falta são duas lacunas de infraestrutura, não de código: config do Asterisk não
  versionada, e viabilidade do áudio de IA (Pipecat/faster-whisper/Piper/Kokoro) não confirmada.
- Não declarar `final-green`, `VERIFIED LIVE` ou produção de voz ativa. Não mergear para `main`
  sem autorização explícita. Não ativar `VOICE_LIVE_ENABLED=true`.

## Tarefa 1 — extrair config real do Asterisk da VPS

**Por quê:** a instância de teste na VPS foi configurada manualmente, fora do Git. Ninguém tem
os ficheiros reais salvos. Escrever um docker-compose/systemd "de memória" arrisca divergir do
que já roda lá — o objetivo é capturar o que já funciona, não reinventar.

**O que fazer (somente leitura, não alterar nada na VPS):**

1. Copiar os ficheiros de configuração reais do Asterisk usados no teste anterior:
   - `pjsip.conf` (ou `sip.conf` se for chan_sip em vez de PJSIP — confirmar qual)
   - `extensions.conf` (o dialplan, incluindo o contexto `voicecore-test` já confirmado)
   - `ari.conf` / `http.conf` (config da API ARI — usuário, porta, TLS)
   - a unidade systemd usada para o worker de teste (`workers/voice-sip-worker`) — nome do
     serviço, `ExecStart`, variáveis de ambiente, `WorkingDirectory`
   - versão exata instalada (`asterisk -V`) e método de instalação (apt, source, container?)
2. **Redigir qualquer segredo antes de trazer pra fora da VPS** — senha ARI, secrets de SIP
   trunk, credenciais de operadora. Nunca colar credencial em log, documento ou commit.
3. Trazer esses ficheiros (redigidos) para o repo em
   `docs/evidence/voice-vps-config-2026-08-28/` (novo diretório, não versionar segredo) ou
   colar o conteúdo redigido direto na resposta pra próxima sessão escrever o
   docker-compose/systemd em cima do que é real.
4. Reportar: Asterisk registrou algum endpoint/softphone real desde o teste do dia 28? Se sim,
   qual o estado atual (`Available`/`Unavailable`)?

**Não fazer:** não alterar a config ao vivo, não reiniciar o Asterisk, não criar SIP trunk novo,
não tocar em número/credencial de operadora sem autorização explícita separada.

## Tarefa 2 — viabilidade do áudio de IA (sandbox cloud, não a VPS)

**Por quê:** Pipecat/faster-whisper/Piper/Kokoro são processos Python/ML. A VPS atual (2 CPU/
3.7GB) já foi validada como insuficiente. Antes do dono aprovar custo recorrente de um host
fixo, queremos saber se isso sequer roda sem GPU e com que latência — teste em sandbox cloud
efêmero (ex.: Codex Cloud), não na VPS de produção, não precisa de IP público.

**O que fazer:**

1. Instalar `faster-whisper` (modelo pequeno, ex. `tiny`/`base`) num sandbox cloud e medir:
   tempo de transcrição de um áudio curto (~10s) de fala em português/inglês, sem GPU.
2. Instalar Piper e/ou Kokoro (TTS open-source) no mesmo sandbox e medir: tempo pra gerar ~10s
   de áudio a partir de texto curto.
3. Registrar: rodou sem GPU? Quanto tempo cada etapa levou? Isso é rápido o suficiente pra uma
   conversa em tempo real (referência: < ~1-2s de latência total é o que importa numa ligação)?
4. Não é preciso ligar isso ao Asterisk real nem ao worker de produção nesta tarefa — é teste de
   viabilidade isolado, só pra informar a decisão de host.
5. Reportar os números crus (tempo medido, hardware do sandbox) — não arredondar pra "rápido" ou
   "lento" sem o número.

### Resultado executado

- Runtime: Google Colab hosted, runtime `2026.07`, Python `3.12.13`, CPU-only, aproximadamente
  `12.67 GiB` de RAM e `113.94 GiB` de disco; nenhuma GPU foi usada.
- Piper `pt_BR-cadu-medium`, áudio `11.06–11.31 s`: `4.718331 s`, `3.827799 s`, `4.014973 s`.
- `faster-whisper tiny`, CPU `int8`, áudio `11.308125 s`: `1.644854 s`, `1.624598 s`,
  `1.585650 s`.
- Kokoro `pf_dora`, áudio `10.5 s`: carregamento `6.503924 s`; execuções `21.571024 s`,
  `21.044665 s`, `21.127316 s`.
- Todos os três motores instalaram e processaram áudio. `faster-whisper` ficou abaixo do tempo
  real; Piper ficou abaixo do tempo real, mas com latência absoluta de aproximadamente 4 segundos;
  Kokoro ficou aproximadamente duas vezes mais lento que o tempo real.
- Veredito de infraestrutura: não provisionar outra VPS pequena esperando voz interativa. Para
  conversação em tempo real ainda falta testar streaming/paralelismo em host mais forte ou GPU.
- Evidência detalhada: [`docs/evidence/voice-colab-cpu-benchmark-2026-08-28.md`](../evidence/voice-colab-cpu-benchmark-2026-08-28.md).

## Estado após execução

- Tarefa 1: ficheiros extraídos (ou motivo de não ter conseguido), estado do endpoint SIP.
- Tarefa 2: números reais de latência STT/TTS sem GPU estão registrados na evidência; o benchmark
  corrigido de aproximadamente 10 segundos rodou para Piper, faster-whisper e Kokoro.
- Ainda não foi medido: chamada SIP/PSTN real com áudio, streaming, execução paralela, custo de
  host fixo, comportamento sob reinício, integração Pipecat/Asterisk e latência ponta a ponta.
- Não declarar `VERIFIED LIVE`, produção de voz ativa ou `final-green`.


## Referências

- [`docs/handoffs/HANDOFF-voice-sip-2026-08-28.md`](HANDOFF-voice-sip-2026-08-28.md)
- [`docs/voice/open-source-europe.md`](../voice/open-source-europe.md)
- [`docs/current-state.md`](../current-state.md) §11
- `workers/voice-sip-worker/README.md` (na branch `implementacao-tokens-voice-core`) — raciocínio completo do `BLOCKED EXTERNAL`
