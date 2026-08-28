# Voice QA e operação

Este runbook separa três provas que não podem ser misturadas:

- `VERIFIED PROVIDER-FREE`: testes unitários e processos smoke locais, usando Asterisk/CRM falsos e, quando disponível, o smoke de Postgres local.
- `NOT_PROVEN` / `NOT_EXECUTED`: dependências externas ausentes, falhas de ambiente ou qualquer etapa que não tenha sido medida.
- `VERIFIED LIVE`: chamada SIP/PSTN completa, áudio RTP e runtime de IA observados num ambiente autorizado. Não há essa prova neste checkout.

O caminho SIP/BYOC não substitui o worker Telnyx/Patter existente. Não ativar `main.mjs` como serviço de produção, não usar credenciais reais em testes e não alterar `main` para fechar um gate.

## Gate provider-free

Na raiz do checkout, com Node 22 e dependências instaladas:

```bash
bash scripts/verify-voice-qa.sh provider-free
```

O gate executa os contratos SIP, `ari-listener.smoke.mjs` e `main.smoke.mjs`. O último smoke exige `SUPABASE_DB_URL` para provar resolução contra Postgres real; sem essa variável ele deve reportar o skip documentado, que não é prova live. Uma falha ou timeout é `NOT_PROVEN`, nunca PASS.

Para a bateria histórica mais ampla, usar também:

```bash
bash scripts/verify-voice-core.sh
```

Registre SHA, data, comando, ambiente, resultado e saída relevante. Não registre URLs com credenciais, secrets, tokens, números reais ou áudio de clientes.

## Health e métricas

O `workers/voice-sip-worker/main.mjs` expõe `GET /healthz` na porta `PORT` (padrão `8090`):

```json
{"status":"ok","processedEvents":0,"rejectedEvents":0,"forwardFailures":0}
```

`200` com `status=ok` só prova que o processo abriu o endpoint e iniciou a conexão ARI. `503`/`starting` é falha de readiness. Os contadores são diagnóstico de processo, não métricas de qualidade de áudio nem disponibilidade de produção.

Interprete os contadores assim:

- `processedEvents`: eventos normalizados e encaminhados com sucesso ao control plane;
- `rejectedEvents`: payloads ARI que falharam na validação/tenant boundary;
- `forwardFailures`: falhas ao resolver contexto ou gravar evento no CRM; investigar antes de retry manual.

Não há endpoint `/metrics` nem persistência de séries temporais neste worker. Tempo até primeira resposta, latência STT/Agent OS/TTS, interrupções, falha de áudio, transferência, duração, custo, idioma, fallback e encerramento por erro continuam `NOT_PROVEN` até instrumentação e medição externas serem definidas.

## Procedimento VPS/live (somente operador autorizado)

O harness local não acessa VPS. `bash scripts/verify-voice-qa.sh vps` e `live` recusam execução por desenho; `VOICE_QA_ALLOW_LIVE=1` apenas registra `NOT_PROVEN` e não transforma autorização em evidência.

Antes de uma homologação externa, preparar uma janela, telefone/softphone de teste, organização isolada, destino de emergência, observador e plano de parada. Validar em ordem: SIP interno, inbound do número do cliente, outbound com Caller ID do cliente, transferência, idiomas aprovados e reinício. Para cada chamada guardar somente IDs redigidos, timestamps, estados e métricas sem áudio/PII.

Critério mínimo de uma prova live: trace correlacionado de ARI → worker → `/context` → `/event` → mídia RTP → STT → Agent OS → TTS → retorno ao Asterisk, com chamada encerrada corretamente. `/healthz` isolado, HTTP 200, conexão ARI ou chamada sem áudio de IA não satisfaz esse critério.

## Rollback

Rollback é publicação controlada de uma versão anterior conhecida, não apagar migration nem editar produção diretamente.

1. Desabilitar a nova unidade SIP/BYOC ou remover o roteamento Stasis para ela; preservar o worker Telnyx/Patter vigente.
2. Confirmar `/healthz` e ausência de novas tentativas de encaminhamento; capturar contadores e logs redigidos.
3. Restaurar o SHA previamente aprovado pelo operador, mantendo o mesmo contrato de banco. Se houver mudança de schema, aplicar somente o forward-fix documentado; nunca executar `git reset --hard` em checkout com dados do operador.
4. Repetir o gate provider-free no SHA restaurado e executar uma chamada controlada somente se a janela live tiver autorização.
5. Abrir incidente com causa, último SHA, IDs de chamada redigidos, impacto, decisão de reativação e evidência. Não declarar recuperação por processo iniciado ou endpoint HTTP isolado.

Se houver risco de loop de chamadas, gravação indevida, vazamento de segredo ou cross-tenant, parar o worker e bloquear o tráfego antes de investigar. Não reencaminhar automaticamente eventos falhos sem verificar idempotência e estado terminal.

## Checklist de encerramento

- [ ] SHA do checkout registrado.
- [ ] `provider-free` executado e falhas tratadas como `NOT_PROVEN`.
- [ ] Postgres real, se usado, explicitamente marcado; ausência marcada como `NOT_EXECUTED`.
- [ ] Nenhuma credencial, PII ou áudio entrou em log/evidência.
- [ ] VPS/live, RTP, STT/TTS, transferência e rollback real continuam separados da prova local.
- [ ] Nenhuma ativação ou merge em `main` sem autorização do dono.
