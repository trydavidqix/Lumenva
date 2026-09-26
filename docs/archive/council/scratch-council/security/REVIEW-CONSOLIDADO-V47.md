# Revisão consolidada — Wave 7 concorrência e Wave 12 publicação

Data: 2026-09-13  
Escopo: revisão read-only dos estados atuais no worker Linux, com execução independente dos testes focados.

## Wave 7 — Studio Editor, persistência concorrente

- Worktree: `/home/claude/src/worktrees/wave7-8-studio-editor-2026-09-12`
- SHA revisado: `f410763ed0132f3650fa8613a3114580cbb40328` (`fix(wave7): persist studio editor evals safely`)
- Estado observado: worktree limpa; HEAD corresponde ao SHA solicitado.
- Implementação: `studio-editor-repository.ts` abre transação, bloqueia a versão corrente com `FOR UPDATE`, valida `base_version`, insere a próxima versão e atualiza a proposta com filtros de organização/sessão/edição. Violação de unicidade (`23505`) é convertida em `stale_version` após rollback.
- Prova executada por mim, com PostgreSQL descartável iniciado pelo próprio teste e teardown:
  - `studio-editor-concurrency.integration.test.ts`: **1 teste passou**, exit `0`. Dois clientes concorrentes disputam a mesma proposta; o teste exige exatamente um vencedor e um `stale_version`, com versões `[1,2]`.
  - `studio-editor-evals-variants.integration.test.ts`: **1 teste passou**, exit `0`. Exercita gravação concorrente de eval/variant e confirma uma linha por chave composta.
- Total executado: **2 arquivos, 2 testes, 2 passaram, 0 falharam**.
- Não encontrei segredo hardcoded nem logging de payload sensível nos arquivos revisados.

**Veredito: PASS (concorrência local comprovada).** A prova usa schema PostgreSQL criado no teste; validação de migration/RLS de produção permanece fora deste escopo.

## Wave 12 — gate de publicação por freshness/proveniência

- Worktree: `/home/claude/src/worktrees/wave12-marketing-content-2026-09-13`
- SHA revisado: `d10235ccb7539e7230fcd10665006df50052a32b` (`fix(wave12): block stale content publication`)
- O commit altera somente `apps/crm/lib/knowledge/content-provenance.ts` e seu teste.
- `assertPublishableContent` é fail-closed isoladamente (`content-provenance.ts:48-50`): rejeita freshness diferente de `current`, source vazia, confidence não finita ou abaixo do limiar.
- Testes executados por mim: `content-provenance.test.ts` (**4/4**, exit `0`) e `content-os-publication-service.test.ts` (**7/7**, exit `0`); total **11/11**, exit `0`.
- Gap crítico: a função de publicação real não chama esse gate. Em `apps/crm/lib/content-os/distribution/publication-service.ts:115-132`, `publishContentItem` valida item/tenant, quality gate e consentimento, e então agenda/publica; não recebe nem consulta provenance e não invoca `assertPublishableContent`. O `git show --stat` confirma que o commit não tocou `publication-service.ts`.
- Consequência: os 4 testes verdes provam o helper, mas não provam que `publishContentItem` bloqueia conteúdo `stale`/`unknown`; tal conteúdo pode seguir pelo caminho de publicação se os demais gates passarem.
- Não encontrei segredo hardcoded nem log sensível nos arquivos revisados.

**Veredito: BLOCKED.** Falta integrar `assertPublishableContent` (ou equivalente persistido/tenant-scoped) no caminho efetivo de `publishContentItem` e adicionar teste de serviço que tente publicar provenance `stale`/`unknown` e confirme rejeição antes de qualquer update/job.

## Veredito consolidado

- Wave 7: **PASS**.
- Wave 12: **BLOCKED** — gate de freshness existe, mas não está ligado ao dispatcher de publicação.

<self-check>PASS — SHAs confirmados, código lido, testes executados independentemente e gap reportado sem ampliar escopo.</self-check>
