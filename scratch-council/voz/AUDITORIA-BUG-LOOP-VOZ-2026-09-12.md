# Auditoria do bug de loop de voz — 2026-09-12

## Escopo

Auditoria read-only via SSH no worker `claude@192.168.1.78`, usando `~/.ssh/lumenva_worker`. Não foram executados build, testes, chamadas, downloads, deploys ou alterações de runtime.

## Commit localizado

Comando equivalente a `git log --all --oneline | grep b09243a5` encontrou:

```text
b09243a5 fix(voice-sip-test): guarda no response.cancel para matar response_cancel_not_active
```

Commit completo: `b09243a518f68d20c0fba8445275f5c43a7c5e8b`  
Branch/ref contendo-o: `main` e várias branches derivadas.  
Stat: um arquivo alterado, `scripts/voice-sip-test/src/server.ts` (10 inserções, 4 remoções).

## O fix está aplicado?

**SIM, no código versionado deste SHA.** O servidor substitui o booleano `interrupted` por estado `active | cancel_requested | completed`, mantém `activeResponse` e só envia `response.cancel` quando há `activeResponse.id` e estado `active` (`server.ts:56-62`, `:72-90`). Eventos `response.done` e `response.cancelled` marcam a resposta concluída e limpam a referência (`:142-149`). O commit também inclui `turn_detection` com `create_response: true` e `interrupt_response: true` no payload de aceitação (`:25-36`).

Isso fecha especificamente o envio indevido de `response.cancel` sem resposta ativa, que gerava `response_cancel_not_active`.

## Teste ao vivo do fix

**NOT_PROVEN para este commit.**

Há um arquivo local de evidência em `scripts/voice-sip-test/_call-log-evidence.txt` com duas chamadas aceitas, várias linhas `response.done` e fechamento WebSocket `1006`. O arquivo não contém timestamp, SHA, identificação da versão executada, áudio confirmado, transcript, nem demonstra o cenário de barge-in que aciona `interruptActiveResponse`. Portanto não é possível atribuir essa evidência ao binário/código de `b09243a5` nem concluir que o loop foi eliminado.

Há evidência histórica em `docs/current-state.md` de ligação real com áudio em 2026-08-30/31, mas ela é anterior ao commit de 2026-09-06 e descreve o bug/pendências da sessão anterior; não prova reteste do fix. A documentação registra que a prova de conversa do protótipo permanecia pendente e que havia erro `response_cancel_not_active` compatível com corrida de timing.

## Observação de segurança

O código registra `call_id` em `console.error` (`server.ts:116`, `:166-171`, `:187`, `:194`) e `summarizeResponse()` inclui `status_details`, IDs de conversa e `content` dos itens da resposta (`:93-112`, log em `:143`). Isso pode vazar metadados e conteúdo/transcript sensível para logs. O commit não adiciona redaction. Não é o loop em si, mas deve ser tratado antes de considerar o harness seguro para produção.

## Estado das pendências de voz

- Código do guard contra `response_cancel_not_active`: **CONFIRMADO no commit**.
- Fix presente no runtime de produção SIP/Asterisk/Pipecat: **NOT_PROVEN**; o commit altera `scripts/voice-sip-test`, um harness isolado, não o worker de produção versionado.
- Reteste ao vivo após o commit, com barge-in e conversa bidirecional: **NOT_PROVEN**.
- Áudio real histórico ponta a ponta: **CONFIRMADO em documentação anterior**, mas não vinculado ao fix e com pendências posteriores de estado terminal `voice_calls`.
- Logging sem leakage de conteúdo: **FAIL / precisa correção**, devido a `content` em `summarizeResponse()`.

## Veredito

**CÓDIGO DO FIX APLICADO; EFICÁCIA AO VIVO NÃO PROVADA; HARNESS NÃO APROVADO PARA PRODUÇÃO.** O guard é coerente com a causa suspeita e remove a chamada inválida de cancelamento no caminho estático, mas falta uma prova controlada pós-commit (incluindo barge-in) e a redaction dos logs de resposta.

SELF-CHECK: PASS — somente leitura, sem efeitos externos, sem secrets expostos.
