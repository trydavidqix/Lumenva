# Re-revisão — Wave 7 reviewer registry no fluxo de aprovação

Data: 2026-09-13  
Worktree: `/home/claude/src/worktrees/wave7-8-studio-editor-2026-09-12`  
SHA: `f15b25593936548207b7e5a7fdd6794cc1b8eaab` (`fix(wave7): enforce reviewer authority in approvals`)

## Evidência

- `StudioEditorStore` agora recebe `authorizeReviewer` no construtor e `approveEdit` chama `await this.authorizeReviewer(proposal.organization_id, input.reviewerId)` antes de aplicar a edição.
- O teste de serviço `studio-reviewer-approval.service.integration.test.ts` usa o registry persistente contra PostgreSQL descartável, com reviewer do tenant correto, reviewer desconhecido e reviewer de outro tenant.
- Resultado independente: **1/1 teste passou**, exit `0`; reviewer desconhecido/cross-tenant foi rejeitado e reviewer autorizado produziu a versão aplicada.
- O teste de registry anterior também permanece verde: **1/1 passou**, exit `0`.
- Testes unitários de `studio-editor.test.ts` foram incluídos na execução focada; a suíte combinada reportou os testes verdes antes da saída truncada do runner. O teste de serviço é a prova decisiva do caller persistente.
- Nenhum segredo hardcoded ou logging sensível encontrado.

**Veredito: PASS.** O gap anterior foi fechado: a aprovação agora consulta a autoridade persistente antes de aplicar a edição, com tenant/capability representados pelo registry e prova PostgreSQL real.

<self-check>PASS — SHA confirmado, integração no caller lida e teste de serviço real executado com exit 0.</self-check>
