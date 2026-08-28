# HANDOFF — Extrair config real do Asterisk + avaliar viabilidade do áudio de IA — 2026-08-28

Este handoff é para a sessão/agente com acesso à VPS de telefonia (Asterisk 22.5.2). Duas tarefas
independentes, pode fazer em qualquer ordem.

**Atualização 2026-08-28:** Tarefa 1 foi executada em leitura remota. A configuração redigida está
em [`docs/evidence/voice-vps-config-2026-08-28/README.md`](../evidence/voice-vps-config-2026-08-28/README.md).
Tarefa 2 foi tentada no Codex Cloud (`codex cloud`), mas o cliente respondeu `Error: Device not configured (os error 6)`;
nenhum benchmark foi inventado ou executado na VPS de produção. A leitura remota da Tarefa 1 foi
repetida após autorização em 2026-08-28 e confirmou o conteúdo redigido no diretório de evidência.

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

## O que reportar de volta

Um resumo curto com:

- Tarefa 1: ficheiros extraídos (ou motivo de não ter conseguido), estado do endpoint SIP.
- Tarefa 2: números reais de latência STT/TTS sem GPU, se rodou ou travou.
- Qualquer coisa que **não** foi possível medir — dizer explicitamente, não inferir sucesso.

## Referências

- [`docs/handoffs/HANDOFF-voice-sip-2026-08-28.md`](HANDOFF-voice-sip-2026-08-28.md)
- [`docs/voice/open-source-europe.md`](../voice/open-source-europe.md)
- [`docs/current-state.md`](../current-state.md) §11
- `workers/voice-sip-worker/README.md` (na branch `implementacao-tokens-voice-core`) — raciocínio completo do `BLOCKED EXTERNAL`
