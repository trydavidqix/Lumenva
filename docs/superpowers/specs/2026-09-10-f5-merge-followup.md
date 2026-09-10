# F5 Customer360 S-05.07 follow-up

Fonte: `~/plano-f5-f8.md:3-8`; `docs/stories/epics/EPIC-05-customer-360.md:681-783`.

Entrada: `mvp/crm-completo@feca1c5ad81c1308e7aed3f81f1eaf39f60f7906`; `b7029aa` não é ancestral desta linha. Esta fatia cobre apenas a lacuna de hooks/contrato cliente sobre a API já definida, sem duplicar o MergeDialog/API de `b7029aa`.

DoD: `useMergeQueue` e `useResolveMerge` usam endpoints S-05.07, invalidam a fila após resolver e tratam erro; teste de contrato; test:fast, typecheck, lint target, diff-check, worktree limpa. Sem migrations/schema/credenciais/providers.
