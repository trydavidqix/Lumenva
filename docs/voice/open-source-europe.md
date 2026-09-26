# Voz open-source para linhas europeias

**Última sincronização:** 2026-08-28

**Estado em 2026-08-28:** camada de sinalização SIP/BYOC (controle da chamada) implementada e
testada de ponta a ponta na branch candidata, incluindo teste parcial contra Asterisk/ARI real na
VPS. A viabilidade isolada de `faster-whisper`, Piper e Kokoro foi medida em Colab CPU e, para
`faster-whisper`/Piper, também **na própria VPS de produção real** (containers parados com
autorização explícita, religados e verificados saudáveis depois) — resultado bem melhor que no
Colab. **Na mesma noite, um script ad-hoc (fora do repo, prova de conceito) provou pela primeira
vez uma chamada telefónica real de ponta a ponta** — softphone real → Asterisk → ponte de
áudio → STT → resposta → TTS → volta ao telefone, com o dono ouvindo a resposta ao vivo. Ver
[`docs/evidence/voice-vps-real-call-bridge-2026-08-28.md`](../evidence/voice-vps-real-call-bridge-2026-08-28.md).
Isto prova viabilidade técnica da arquitetura, não é ainda a integração real nos contratos do
Voice Core (`lib/voice/**`) nem tem Agent OS — streaming, detecção de fim de fala e qualidade de
voz continuam pendentes, ver "O que falta antes de ligar".

**Checkout documentado:** `codex/crm-consolidated` em `54e86839486849ad5b14a19851eb1f3696d93605`.

**Branch candidata:** `origin/implementacao-tokens-voice-core` em
`d3c97cbd8d3ca8ca5616e05f23411e52520a5a3a`. Essa branch contém a implementação SIP/BYOC e o
handoff da sessão Claude, mas não é a branch atual do CRM e ainda não prova operação telefónica em produção.

## Decisão de produto

O cliente mantém o próprio número. O CRM entra no meio da ligação por SIP/BYOC, sem comprar ou
substituir o número do cliente.

No CRM, o cliente poderá configurar idioma e locale europeu, voz masculina ou feminina quando
existir voz aprovada, voz, velocidade, tom e estilo. Clonagem é opcional e só pode ocorrer com
consentimento verificável e revogável.

Se a voz escolhida não estiver disponível ou falhar, o sistema mantém o idioma e usa uma voz
aprovada compatível ou transfere para uma pessoa. Nunca troca idioma ou tenant em silêncio.

## Arquitetura acordada

```text
número do cliente / operadora SIP
        -> Asterisk/ARI (gateway SIP/BYOC)
        -> Pipecat (runtime de voz)
        -> faster-whisper (STT)
        -> Agent OS / CRM (memória, políticas, tools, auditoria)
        -> Piper ou Kokoro (TTS)
        -> ligação do cliente
```

OpenVoice fica isolado para clonagem opcional. O CRM, Agent OS, Supabase, tokens, memória,
políticas, tenant e auditoria continuam sendo a autoridade. O runtime de voz não executa tools
comerciais diretamente.

Stack open-source escolhida para a primeira versão: Asterisk/ARI, Pipecat, faster-whisper, Piper,
Kokoro e OpenVoice.

## Duas gerações de código na mesma branch

A branch candidata carrega implementação de **duas gerações**, não caminhos concorrentes em
aberto:

- **Antiga (produção nessa branch hoje):** Telnyx (carrier pago) + Patter + Deepgram (STT pago)
  + ElevenLabs (TTS pago). LiveKit já foi obrigatório num desenho ainda mais antigo; hoje é só
  opcional, reservado a takeover humano pelo navegador.
- **Nova, aprovada pelo dono em 2026-08-27 (a desta página):** Asterisk/ARI + Pipecat +
  faster-whisper + Piper/Kokoro + OpenVoice, 100% open-source.

A antiga fica como rede de segurança até a nova provar chamada real; não é para apagar sem
decisão explícita.

## Estado confirmado

Na branch candidata há contratos provider-neutral, adapters de SIP, cliente ARI real, listener,
reconexão, rotas CRM, forwarder, worker SIP/BYOC, adapters de STT/TTS, catálogo de vozes,
clonagem, fallback e testes provider-free.

**Camada de sinalização: confirmada como implementação real, não scaffold**, por leitura direta
do código em `d3c97cbd`. `workers/voice-sip-worker/main.mjs` é o entrypoint de produção: ARI →
validação de tenant local (Postgres) → listener com reconexão automática → forwarder chamando
`/api/internal/voice/context`/`event` por HTTP real. Testado ponta a ponta com Postgres nativo
real e servidor ARI falso (HTTP+WS reais). Na VPS, o worker rodou como serviço de teste isolado,
`/healthz` respondeu, ARI real autenticou (Asterisk 22.5.2, dialplan `voicecore-test`), suíte
Voice passou com 43 ficheiros/199 testes. O teste real encontrou e corrigiu a leitura de
`SIP_CONNECTION_ID` via ARI REST quando o evento não traz `channelvars`.

O gate completo não fechou porque `pnpm typecheck` esgotou heap — limite do runner, não
reprovação do código. O fluxo ainda não conclui uma chamada PSTN/SIP real com áudio.

No checkout atual (`codex/crm-consolidated`), a auditoria confirmou zero ficheiros rastreados em
`lib/voice/**`, `apps/voice-worker/**` e `workers/voice-runtime/**`. Portanto, não há
alteração de código de voz sincronizada nesta branch.

## O que falta antes de ligar

1. Integrar seletivamente o código da branch candidata no CRM, preservando os contratos atuais.
2. ~~Ligar o worker a uma extensão SIP/softphone real e validar o ciclo completo
   inbound/outbound.~~ **Feito com um script ad-hoc fora do repo em 2026-08-28** (não é a
   integração real nos contratos `lib/voice/**`) — primeira chamada real de ponta a ponta
   provada, com 6 bugs de RTP corrigidos no caminho. Falta portar essa lógica pros contratos
   reais do Voice Core. Ver
   [`docs/evidence/voice-vps-real-call-bridge-2026-08-28.md`](../evidence/voice-vps-real-call-bridge-2026-08-28.md).
3. **Benchmark isolado concluído em dois hosts; decisão de host de produção ainda pendente.**
   No Colab `2026.07`/Python `3.12.13`, CPU-only: faster-whisper transcreveu ~11.3 s em
   `1.586–1.645 s`; Piper sintetizou ~11.1 s em `3.828–4.718 s`; Kokoro sintetizou `10.5 s` em
   `21.045–21.571 s`, após carregamento de `6.504 s`. **Reteste em 2026-08-28 na própria VPS de
   produção real** (`lumenva-crm`, AMD EPYC-Genoa, 2 vCPU/3.7GB — containers parados com
   autorização explícita do dono, religados e verificados saudáveis logo depois): faster-whisper
   transcreveu ~13.9 s em `1.009–1.055 s` (RTF ≈ `0.07–0.08`); Piper sintetizou ~14 s em
   `0.958–1.027 s` (RTF ≈ `0.07`) — **bem mais rápido que no Colab**, mesmo com ~1/4 da RAM.
   **Kokoro também foi retestado na VPS**, numa segunda passagem no mesmo dia, dentro de um
   container Docker descartável `python:3.12-slim` (`docker run --rm`, contorna o bloqueio de
   `kokoro==0.9.4` exigir Python `<3.13` sem tocar no sistema da VPS): RTF `0.497–0.717`, reverte
   o `FAIL` do Colab (RTF ~2.0). Os testes provam viabilidade isolada e sequencial, não voz em
   produção sob carga —
   falta testar streaming, paralelismo, o CRM completo rodando junto e o caminho Asterisk
   RTP/bridge→Pipecat antes de decidir se um host novo é necessário. Ver
   [`docs/evidence/voice-colab-cpu-benchmark-2026-08-28.md`](../evidence/voice-colab-cpu-benchmark-2026-08-28.md)
   e [`docs/evidence/voice-vps-cpu-benchmark-2026-08-28.md`](../evidence/voice-vps-cpu-benchmark-2026-08-28.md).
4. ~~Deploy do Asterisk não está versionado no Git~~ **Feito** — `pjsip.conf`/`extensions.conf`/
   `ari.conf`/`http.conf`/unidade systemd extraídos da VPS real e versionados (segredos
   redigidos) em [`ops/voice-asterisk/`](../../ops/voice-asterisk/README.md).
4b. ~~Achado de segurança: Asterisk exposto publicamente na porta 5060/UDP, varrido por
   bots de brute-force~~ **Mitigado em 2026-08-29** — `fail2ban` com filtro próprio pro formato
   `res_pjsip` do Asterisk 22 (testado contra 126 mil linhas reais antes de ativar) + `logrotate`
   configurado. Log tinha chegado a `15,6GB`; rotacionado e limpo. Sem allowlist fixa de IP
   (celular do dono usa rede móvel, IP dinâmico). Detalhe em
   [`docs/evidence/voice-vps-real-call-bridge-2026-08-28.md`](../evidence/voice-vps-real-call-bridge-2026-08-28.md).
5. Cobrir upload, prévia, consentimento, revogação e eliminação da voz clonada.
6. Configurar a conta SIP/BYOC do cliente; o cliente mantém o próprio número.
7. Executar o gate completo num runner com heap suficiente no snapshot integrado.
8. Testar streaming/paralelismo em host candidato, depois inbound, outbound, transferência,
   reinício, perda de conexão, latência ponta a ponta e custo.

9. Só depois avaliar ativação gradual; `VOICE_LIVE_ENABLED=true` não está autorizado por este
   documento.

## Evidência do benchmark CPU

Os comandos, versões, hardware, tempos individuais e limitações estão em
[`docs/evidence/voice-colab-cpu-benchmark-2026-08-28.md`](../evidence/voice-colab-cpu-benchmark-2026-08-28.md).
O teste não usou VPS, credenciais de produção ou chamada telefónica real.

## Regra de sincronização

Este documento é a referência resumida no CRM consolidado. O plano detalhado da branch candidata
deve ser comparado antes de qualquer merge ou cópia. Se houver conflito, vence a arquitetura do
CRM: tenant, Agent OS, policies, tokens, memória, auditoria e Supabase permanecem únicos.
