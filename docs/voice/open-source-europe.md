# Voz open-source para linhas europeias

**Última sincronização:** 2026-08-28

**Estado em 2026-08-28:** camada de sinalização SIP/BYOC (controle da chamada) implementada e
testada de ponta a ponta na branch candidata, incluindo teste parcial contra Asterisk/ARI real na
VPS. Áudio de IA (Pipecat/faster-whisper/Piper/Kokoro) e chamada telefónica completa continuam
bloqueados por infraestrutura, não por código pendente — ver "O que falta antes de ligar".

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
`lib/voice/**`, `workers/voice-worker/**` e `workers/voice-runtime/**`. Portanto, não há
alteração de código de voz sincronizada nesta branch.

## O que falta antes de ligar

1. Integrar seletivamente o código da branch candidata no CRM, preservando os contratos atuais.
2. Ligar o worker a uma extensão SIP/softphone real e validar o ciclo completo inbound/outbound.
3. **`BLOCKED EXTERNAL` — decisão de host pendente.** Completar o caminho de áudio (Asterisk
   RTP/bridge, Pipecat, faster-whisper, Piper/Kokoro) exige processos Python/ML que a VPS atual
   (2 CPU/3.7GB) não aguenta. Antes de provisionar host fixo (custo recorrente, exige autorização
   explícita do dono), a decisão de 2026-08-28 é testar viabilidade num sandbox cloud efêmero
   (ex.: Codex Cloud) — mede se roda sem GPU e com que latência, sem comprometer mensalidade.
4. **Deploy do Asterisk não está versionado no Git** — a instância da VPS foi configurada
   manualmente. Extrair `pjsip.conf`/`extensions.conf`/unidade systemd reais da VPS antes de
   escrever qualquer receita (docker-compose/systemd), para não divergir do que já roda. Ver
   [`HANDOFF-voice-vps-config-2026-08-28.md`](../handoffs/HANDOFF-voice-vps-config-2026-08-28.md).
5. Cobrir upload, prévia, consentimento, revogação e eliminação da voz clonada.
6. Configurar a conta SIP/BYOC do cliente; o cliente mantém o próprio número.
7. Executar o gate completo num runner com heap suficiente no snapshot integrado.
8. Testar inbound, outbound, transferência, reinício, perda de conexão, latência e custo.
9. Só depois avaliar ativação gradual; `VOICE_LIVE_ENABLED=true` não está autorizado por este
   documento.

## Regra de sincronização

Este documento é a referência resumida no CRM consolidado. O plano detalhado da branch candidata
deve ser comparado antes de qualquer merge ou cópia. Se houver conflito, vence a arquitetura do
CRM: tenant, Agent OS, policies, tokens, memória, auditoria e Supabase permanecem únicos.
