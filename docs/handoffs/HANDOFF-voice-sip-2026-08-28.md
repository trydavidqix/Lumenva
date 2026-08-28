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
- faster-whisper, Piper/Kokoro e OpenVoice em processos live.
- Transferência humana em telefone real.
- Latência, custo, disponibilidade e comportamento sob reinício em chamada real.
- Interface completa para escolha, prévia, consentimento e clonagem de voz.

## Pendências e resolução

- **Endpoint SIP:** registrar extensão/softphone real e confirmar `Available`; depois testar
  inbound/outbound. O servidor não consegue registrar o iPhone sozinho.
- **Identidade da conexão:** manter `SIP_CONNECTION_ID` no dialplan antes de `Stasis`; a leitura
  via ARI REST já foi adicionada para eventos sem `channelvars`.
- **Áudio:** ligar RTP/media bridge Asterisk ao Pipecat; conectar STT e TTS reais. Manter Asterisk
  e worker na VPS de telefonia; colocar modelos ML num host separado se memória/GPU exigirem.
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

## Próximo passo

1. **VPS (handoff dedicado):** extrair `pjsip.conf`/`extensions.conf`/unidade systemd reais e
   avaliar viabilidade do áudio de IA — ver
   [`HANDOFF-voice-vps-config-2026-08-28.md`](HANDOFF-voice-vps-config-2026-08-28.md).
2. **Decisão do dono:** aprovar (ou não) custo recorrente de host para Pipecat/faster-whisper/
   Piper/Kokoro, depois de ver o resultado da viabilidade acima.
3. Registrar endpoint SIP/softphone real e executar chamada controlada, capturando o primeiro
   trace completo.
4. Só depois integrar seletivamente no consolidado e repetir o gate no snapshot final.

## Referências

- [`docs/voice/open-source-europe.md`](../voice/open-source-europe.md)
- [`docs/current-state.md`](../current-state.md) §11
- [`ARCHITECTURE.md`](../../ARCHITECTURE.md) — camada Voice Core
- [`HANDOFF-voice-vps-config-2026-08-28.md`](HANDOFF-voice-vps-config-2026-08-28.md) — tarefa VPS seguinte
- Branch: `origin/implementacao-tokens-voice-core`
