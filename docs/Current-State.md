---
type: current-state
project: Lumenva
status: maintained
last_updated: 2026-09-09
audited_against: main @ 2341dd517967b58b9c50bb326b8c8f974d2d5dff
audit_worktree: f1/baseline-pnpm-2026-09-09
confidence: confirmada para Git, estrutura e versões observadas; comportamento externo não revalidado
---

# Estado atual — baseline F1

## Baseline congelada

- **Checkout de referência:** `main` estava limpa no worker em `2341dd517967b58b9c50bb326b8c8f974d2d5dff` (`origin/main` alinhada no preflight).
- **Execução desta F1:** branch `f1/baseline-pnpm-2026-09-09`, worktree isolado em `~/src/worktrees/f1-baseline-pnpm-2026-09-09`. `main` não foi editada.
- **Runtime observado:** Node `v22.23.2`; macOS e worker reportaram pnpm `12.3.4`.
- **Estrutura medida no baseline:** 2.487 arquivos `.ts`/`.tsx` em `apps`, `lib`, `components` e `workers`; 230 route handlers; 144 migrations SQL; 286 testes unitários em `apps/crm/tests/unit`; 359 documentos `.md`/`.mdx` em `docs`.
- **Lockfile:** `pnpm-lock.yaml` declara `lockfileVersion: '9.0'`.

## Package manager

O repositório declarava `pnpm@9.15.9` em `apps/crm/package.json` e `apps/site/package.json`, enquanto os ambientes autorizados observados usam `pnpm@12.3.4`. A decisão desta F1 é alinhar ambas as declarações para `pnpm@12.3.4`: é a versão efetivamente disponível nos dois ambientes e o lockfile versão 9 permanece coerente com a mudança de declaração. Os pacotes auxiliares `scripts/voice-sip-test` e `workers/voice-worker` não declaram `packageManager`.

## Evidência e limites

- **CONFIRMADO:** SHA, branch/worktree, árvore inicialmente limpa, versões Node/pnpm, declarações de package manager e versão do lockfile.
- **NÃO PROVADO:** publicação, deploy, estado de produção, migrações, integrações externas e conclusão de épicos; não foram executados nesta F1.
- **NÃO EXECUTADO:** instalação de dependências ou download. A validação `pnpm install --frozen-lockfile` só pode ser feita offline, sem exigir artefatos ausentes; se exigir download, permanece bloqueada.
