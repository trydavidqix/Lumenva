# Revisão consolidada V69 — Wave 12 consentimento/publicação TOCTOU

Data: 2026-09-13  
Escopo: confirmação independente do fechamento do deadlock/TOCTOU entre revogação e publicação.

## Identidade

- Worktree: `/home/claude/src/worktrees/wave12-marketing-content-2026-09-13`
- SHA observado: `33396e8e6678fa1527fafca9e481df24163ddde8` (`test(content): bound consent TOCTOU locks`).
- Histórico imediato inclui `d0ce2cfd`, `0ca1c41a`, `09d688a6`, `ef20e79b` e `d10235cc`.
- Worktree sem alterações reportadas por `git status --short`.

## Revisão do código

- `fn_publish_content_if_consent` bloqueia a linha de consentimento com `SELECT ... FOR UPDATE` antes de alterar `content_items`.
- A função exige consentimento presente, `GRANTED`, não futuro, não revogado e dentro da retenção; conjunto incompleto também falha fechado.
- A função é `SECURITY INVOKER`, restringe `search_path`, revoga execução pública e concede apenas a roles autorizadas.
- A revogação e a publicação disputam a mesma linha na mesma ordem de lock; a transação que obtém o lock primeiro determina o resultado, sem janela TOCTOU.
- Nenhum secret hardcoded ou log sensível observado.

## Teste executado por mim

O teste sem `DATABASE_URL` fica corretamente skipped; para obter prova real, iniciei PostgreSQL 16 Docker descartável, criei as tabelas mínimas de consentimento/conteúdo e roles, apliquei `20260913130000_publication_consent_atomic.sql`, exportei `DATABASE_URL` e executei:

```text
apps/crm/tests/integration/content-os-publication-consent.integration.test.ts
```

Saída real:

```text
✓ apps/crm/tests/integration/content-os-publication-consent.integration.test.ts (1 test) 60ms
Test Files 1 passed (1)
Tests 1 passed (1)
EXIT:0
```

O cenário segura a revogação, inicia a publicação, libera o lock e confirma que a revogação vence; a publicação rejeita com `PublicationConsentError`, não atualiza o conteúdo e não cria job. O container foi removido no teardown.

## Veredito

**PASS — Wave 12 consentimento/publicação TOCTOU.**

O lock consistente e o RPC atômico fecham a janela anterior; a prova PostgreSQL real confirma revogação vencedora e publicação bloqueada de verdade.

SELF-CHECK: PASS
