# Review consolidado V4

Data: 2026-09-12  
Escopo: naming registry (Cartógrafa), redaction de PII no ledger (Lótus), approval flow no Action Bus (Fornalha) e evals reescritos (Prisma). Revisão estática read-only via SSH no worker; nenhum teste/build/merge executado.

## Naming Registry — Cartógrafa (`d4aacf8f`)

**PASS:** `trim()`, NFKC, lowercase e remoção de separadores/pontuação produzem chave para near-duplicates; testes cobrem case, underscore, espaços, full-width e nomes distintos. Não há secret/log. Limites: remoção de pontuação pode colapsar nomes intencionalmente distintos e não há escopo/tenant ou unicidade distribuída.

## Redaction de PII — Lótus (`929658a0`)

**PASS CONDICIONAL:** email, telefone e CPF são substituídos por marcadores e hashes SHA-256 mantidos para auditoria; entrada não é mutada e testes verificam ausência dos valores crus. Nenhum secret hardcoded/log.

Limites: regex não cobre todas as variantes de PII; hashes sem salt podem permitir dictionary matching; `redactMemoryEvent()` só protege `content`, não metadata/subject/scope nem prova que todo caminho de ledger chama o redactor antes de persistir. Enforcement global `NOT_PROVEN`.

## Approval Flow — Fornalha (`28f5f7c5`)

**FAIL / BLOCKED:** approval pré-aprovado agora é exigido para `risk_level: "high"`, e P2/R2 exigem `approval_id`; testes cobrem ausência, ID não aprovado e ID aprovado. Porém:

- `approval_id` para P2/R2 comum é apenas presença textual (`action-bus.ts:26`); não há lookup/estado/tenant/assignment/actor, expiração ou vínculo criptográfico.
- `assignment_id`/`session_id` continuam sem validação contra worker ou actor.
- `inFlight` e receipts são `Map` locais; processos distintos podem executar a mesma idempotency key em paralelo.
- `getEvidence(idempotencyKey)` aceita somente a chave e retorna a primeira evidência cujo key termina nela (`:55-57`), sem organization/worker/action scope.
- `permission_level` e `risk_level` são comparados como números, mas não há policy externa que derive esses valores nem actor/origem autenticada.

Redaction e limite agora existem para payload/result, mas continuam heurísticos e não cobrem PII arbitrária.

## Evals de regressão — Prisma (`2227825c`, sobre `53afc117`)

**PASS CONDICIONAL / NOT_PROVEN sistêmico:** os casos foram melhorados: boundary usa uma decisão com entitlement/tool/budget real; persistência verifica dois eventos e decay; handoff compara snapshot com o próximo estado; fail-closed verifica kind inválido. O runner mantém dez casos e status por perfil.

Ainda são testes de ledger em memória, sem persistência real, concorrência, componente de truth/evidence ou integração com policy/approval. O resultado é útil como regression smoke, não como prova de segurança sistêmica; qualquer `FAIL` precisa bloquear o gate.

## Veredito consolidado

**BLOCKED / NÃO PROMOVER:** Naming Registry passa; redaction PII e evals melhoraram com ressalvas. O Action Bus continua bloqueador por approval não verificável para níveis comuns, falta de vínculo actor/assignment, leakage potencial em `getEvidence()` e idempotência apenas local. Redaction de memória também não está provada em todos os caminhos de persistência.

Correções mínimas: approval lookup contextual e expirável, actor/assignment/session authorization, `getEvidence()` com escopo completo, idempotência atômica em store compartilhado, redaction central obrigatória e testes de integração/concurrency/persistência real.

SELF-CHECK: PASS — somente leitura; sem secrets expostos, sem execução, merge, download ou alteração remota.
