# Re-revisão read-only — Event→Wake HMAC e HandoffPack

Data: 2026-09-13  
Escopo: revisão nova do estado atual, limitada aos dois fixes solicitados. Inspeção via SSH no worker; sem testes, build, merge, deploy ou efeitos live.

## 1. Wave 4 Event→Wake — assinatura HMAC

Worktree: `/home/claude/src/worktrees/wave4-browsermesh-wake-2026-09-12`  
HEAD: `03b061599171a8be0c82def53b4d9871fe7991fe` — `feat(wave4): sign and verify wake events`

**Veredito: PASS condicional para o gap de origem confiável.**

Evidência atual em `apps/crm/lib/agent-engine/wave4/event-wake.ts`:

- `:20-25` canonicaliza o envelope (exclui `signature`), calcula HMAC-SHA256 com o segredo compartilhado e compara o digest com `timingSafeEqual`; assinatura ausente, segredo ausente, assinatura adulterada ou segredo incorreto não passam.
- `:27-30` valida o envelope antes de rotear: IDs, capabilities, capability requerida, idempotency key e presença de payload.
- `:31-35` deixa explícito que schema/HMAC são verificados antes do roteamento; evento inválido retorna `REJECTED`, nunca `QUEUED`.
- `:37-41` ainda exige tenant do worker, disponibilidade, capability e allowlist de policy antes de `WAKED`.
- Os testes `event-wake.test.ts:9-14` cobrem assinatura válida, ausência, adulteração, segredo errado, envelope inválido e tenant/policy sem worker autorizado.

O HMAC fecha o bypass de origem **desde que o segredo seja mantido fora do evento e distribuído por uma boundary confiável**. Limites que não invalidam esse veredito específico:

- `actor_id` e `actor_capabilities` são declarados pelo próprio envelope e não são cruzados com um registry de actor; o HMAC autentica quem assinou o envelope, não prova que o actor possuía realmente a capability.
- `idempotency_key` é validada quanto à presença, mas não há deduplicação/replay store em `wakeEvent`; replay de um evento validamente assinado permanece possível.

## 2. Wave 3 HandoffPack — redaction + epoch

Worktree: `/home/claude/src/worktrees/wave3-session-runtime-skeleton-2026-09-12`  
HEAD: `42fd6cba14c5b9624964656f4f5b5ecd0c06ae60` — `fix(runtime): redact and advance handoff state`

**Veredito: PASS para os dois bloqueios corrigidos (redaction básica e epoch de destino), com ressalvas de cobertura.**

Evidência atual em `apps/crm/lib/agent-engine/session/handoff-pack.ts`:

- `:43-52` aplica redaction aos campos textuais quando `redacted: true`, substituindo valores após `api_key`, `token`, `secret`, `password`, `credential` ou `bearer` por `[REDACTED]`.
- `:62-76` aplica a mesma transformação a goal, listas de contexto, next action, source refs e evidence refs; não deixa o token original no pack para o padrão coberto.
- `:59-60` registra `from_execution_epoch` e o epoch de destino opcional; `:85-88` reconstrói usando `to_execution_epoch` quando presente.
- `:81-83` rejeita mismatch de sessão ou epoch de origem antes da reconstrução.
- O teste `handoff-pack.test.ts:22-26` confirma redaction e ausência do segredo no JSON; `:28-31` confirma avanço para epoch 4; `:17-20` compara reconstrução com o estado original sem redaction.

Ressalvas:

- Redaction é controlada pelo chamador (`input.redacted`). Se uma boundary não confiável puder escolher `false`, o pack pode carregar dados sensíveis sem qualquer rejeição; a função não impõe redaction obrigatória.
- A regex cobre apenas padrões `chave[:=]valor` sem espaço no valor (`:44-47`); URLs com token, JSON/quotes, formatos de header alternativos e segredos multilinha não são demonstrados.
- O teste cobre um único `api_key=...`; não prova todos os campos/padrões nem redaction obrigatória em cenário adversarial.

Essas ressalvas deixam a cobertura sistêmica **NOT_PROVEN**, mas não reabrem os dois bugs específicos já corrigidos: o epoch de destino é aplicado e o padrão de segredo testado é removido do pack.

## Veredito consolidado

- Event→Wake HMAC: **PASS condicional** — origem do envelope passa a ser criptograficamente autenticável; actor registry e replay prevention continuam fora do fix.
- HandoffPack redaction + destination epoch: **PASS para os fixes específicos** — testes atuais confirmam o cenário corrigido; enforcement obrigatório e cobertura completa de padrões sensíveis permanecem NOT_PROVEN.

Não há bloqueio reaberto nos dois gaps específicos. Para promoção de produção, ainda são necessários segredo gerenciado, autorização independente do actor, deduplicação de replay e redaction fail-closed na boundary de handoff.

SELF-CHECK: PASS — HEADs atuais confirmados, revisão nova focada nos dois fixes, sem execução de testes/build e sem mutação remota.
