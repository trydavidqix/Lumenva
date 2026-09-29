# Propostas locais de governança de agentes — 2026-09-29

Estes arquivos preservam a configuração local sem ativá-la.

- `hooks.json.disabled` chama `tooling/agent-governance/gate.mjs`, que não existe no checkout `integration/lumenva-complete`.
- `gov-implementer.toml` e `gov-verifier.toml` não têm os campos obrigatórios `name` e `description` do formato atual de agentes Codex.
- `source-command-deskcomm-gov-loop/SKILL.md` depende desse gate e de uma governança ainda classificada como parcial/experimental.

Não renomeie nem copie esses arquivos para `.codex/` ou `.agents/` até integrar e revisar o gate, corrigir as dependências e validar a configuração. Nenhum hook de governança foi habilitado nesta sincronização.
