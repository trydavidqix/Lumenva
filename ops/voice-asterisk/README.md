# Voice Core — Asterisk config real, versionada

Origem: extraído por leitura remota da VPS de produção real (`lumenva-crm`,
`root@2.29.8.225`) em 2026-08-28, com autorização explícita do dono. Nenhuma configuração foi
alterada na VPS ao extrair isto; apenas lida e copiada, com segredos redigidos.

## Por que isto existe

A instalação do Asterisk nessa VPS foi feita manualmente e nunca tinha sido versionada — se a
VPS fosse reconstruída, ninguém saberia reproduzir esse estado. Isto fecha essa lacuna, descrita
em `docs/handoffs/HANDOFF-voice-sip-2026-08-28.md`.

## Estado real (2026-08-28)

- Asterisk `22.5.2` instalado via pacote Debian (`dpkg`), serviço nativo `asterisk.service`.
- PJSIP em UDP `0.0.0.0:5060`; um único endpoint de teste (`1000`) para softphone.
- ARI ligado só em `127.0.0.1:8088` (não exposto publicamente).
- Worker de sinalização (`workers/voice-sip-worker/main.mjs`) rodando como serviço systemd
  próprio (`voice-sip-worker.service`), lendo credenciais ARI direto de `ari.conf`.
- **Isto é config de teste, não de produção**: `voice-sip-worker.service` roda como `root`, sem
  hardening de usuário dedicado; não há trunk SIP/BYOC de operadora — só um endpoint de softphone
  pra prova de conceito.

## Ficheiros

| Ficheiro | Vai para |
|---|---|
| `pjsip.conf` | `/etc/asterisk/pjsip.conf` |
| `extensions.conf` | `/etc/asterisk/extensions.conf` |
| `ari.conf` | `/etc/asterisk/ari.conf` |
| `http.conf` | `/etc/asterisk/http.conf` |
| `voice-sip-worker.service` | `/etc/systemd/system/voice-sip-worker.service` |

Todos os segredos aqui estão como `<REDACTED>` — os valores reais existem só na VPS e não devem
ir pro Git. Ao aplicar num host novo, gere uma senha nova (não copie a da VPS de produção).

## Como aplicar (host novo/reconstrução)

```bash
apt-get update && apt-get install -y asterisk
cp pjsip.conf extensions.conf ari.conf http.conf /etc/asterisk/
# editar as senhas <REDACTED> pra valores novos antes de continuar
systemctl restart asterisk
cp voice-sip-worker.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now voice-sip-worker
```

O worker precisa do checkout completo do repo (não é standalone) rodando via `tsx` — ver
`workers/voice-sip-worker/README.md` na branch `implementacao-tokens-voice-core` pra detalhe.

## O que ainda falta pra ligar de verdade

1. **Registrar um softphone real no endpoint `1000`** — hoje ele existe mas está `Unavailable`,
   sem contacto registado. Ver `docs/handoffs/HANDOFF-voice-sip-2026-08-28.md` pra credenciais
   (nunca commitadas — pede ao dono/handoff da sessão).
2. **`SIP_CONNECTION_ID` não é definido no dialplan** antes de `Stasis()` — precisa ser
   adicionado a `extensions.conf` conforme o contrato de tenant do Voice Core.
3. **Ponte de áudio (Pipecat/faster-whisper/Piper) não está ligada a este Asterisk** — hoje o
   worker só normaliza eventos de sinalização; o caminho de áudio real (RTP) não existe ainda.
4. **Não há trunk SIP/BYOC de operadora** — este endpoint só atende chamadas internas ao
   servidor (via softphone registado), não recebe ligação PSTN externa.

## Segurança

- `<REDACTED>` neste diretório nunca deve ser preenchido com valor real e commitado.
- ARI e SIP endpoint de teste devem ficar atrás de firewall/allowlist até virar produção real.
- `voice-sip-worker.service` rodando como `root` é aceitável só para este teste isolado; produção
  exige usuário dedicado sem privilégio.
- **`fail2ban` protege a porta 5060/UDP desde 2026-08-29** (filtro próprio pro formato
  `res_pjsip`, jail em `/etc/fail2ban/jail.d/asterisk-pjsip.local` na VPS — não versionado aqui
  porque é config do sistema, não do Asterisk em si). Sem isso, o log de mensagens cresce sem
  controle com tentativas de bot (chegou a 15,6GB numa noite antes da mitigação). Ver
  `docs/evidence/voice-vps-real-call-bridge-2026-08-28.md` pra detalhe completo.
