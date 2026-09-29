# Deltas locais de worktrees preservados — 2026-09-29

Snapshot não executável das alterações não commitadas encontradas na auditoria. Nada daqui foi aplicado ao código do produto.

- `patches/`: 12 diffs binários, cada um identifica paths e conteúdo anterior/posterior; inclui 11 worktrees de Recovery e o `AGENTS.md` modificado do checkout CRM.
- `untracked/`: 31 arquivos que não estavam rastreados no respectivo HEAD: 25 propostas/configs locais do checkout CRM e 6 arquivos novos de worktrees de Recovery.
- `.jules/cache/`, `tsconfig.tsbuildinfo`, estado local do Supabase e scripts de correção temporários não foram copiados.
- Os patches foram mantidos separados por worktree para permitir revisão seletiva. Não aplique o conjunto inteiro: há alterações incompletas e conflitantes de identidade/auth, além de mudanças que usam service-role/admin client.

Os arquivos em `untracked/Lumenva/` são a captura bruta dos 25 arquivos novos não-cache do checkout CRM antes da seleção/ajustes publicados em `.agents/` e `.codex/`. Essa cópia é intencional para preservar a proveniência; não é configuração ativa.
