# Lumenva — release handoff (2026-09-15)

## Estado

Implementação executada em branches/worktrees isolados. Nenhuma branch foi
mergeada, rebased ou pushed para `main`. O `origin/main` verificado no início e
no fechamento é `fec2d25348d357e9091c2d5e11fbfd7ee7427208`.

O commit de handoff é a ponta da cadeia:
`ccba134e532bdaef2eba75814d07f9d19922855d` (`release/etapa-20-handoff`).

## Cadeia entregue

| Etapa | Branch | Commit | Entrega |
|---:|---|---|---|
| 1 | `implementation/etapa-01-main-deploy-fec2d253` | `1a5a54fb` | gates CI filtrados para os workspaces |
| 2 | `docs/lumenva-audit-2026-09-15` | `ce80ff64` | inventário remoto e plano persistido de 20 etapas |
| 3 | `foundation/etapa-03-ci-reproducibility` | `128862fc` | pnpm versionada e gates do website |
| 4 | `mechanical/etapa-04-identity-compat` | `6ff949f4` | contrato de rename compatível |
| 5 | `foundation/etapa-05-runtime-env` | `2c6edd44` | flag pública validada por Zod |
| 6 | `foundation/etapa-06-db-foundation` | `84a4d638` | manifest/números de migrations reconciliados |
| 7 | `security/etapa-07-tenant-rls` | `6629240a` | hardening RLS tenant |
| 8 | `api/etapa-08-contract` | `60907365` | envelopes canônicos `/api/v1` |
| 9 | `product/etapa-09-crm-surface` | `056ecbd1` | cursores de leads assinados |
| 10 | `product/etapa-10-billing` | `02c38aea` | erros Stripe sanitizados |
| 11 | `product/etapa-11-agent-catalog` | `6a82398c` | catálogos customer/control separados |
| 12 | `runtime/etapa-12-session` | `944f8424` | classificação de falhas de locks |
| 13 | `intelligence/etapa-13-memory` | `a010a4ea` | promotion gate fail-closed |
| 14 | `channels/etapa-14-gateway` | `7f0d1229` | Zod em webhooks e consentimento por canal |
| 15 | `product/etapa-15-studio-portal` | `83266697` | licença/proveniência de assets e auditoria |
| 16 | `runtime/etapa-16-voice` | `a32bce27` | saída falada limitada e erros sanitizados |
| 17 | `foundation/etapa-17-automation` | `0c0f72dc` | erros de crons sanitizados; auth verificada |
| 18 | `ui/etapa-18-accessibility` | `aa167525` | calendário operável por teclado |
| 19 | `security/etapa-19-operations` | `ccba134e` | runbook de segurança/deploy/rollback |

## Gates que o Codex Cloud deve executar

```bash
pnpm install --frozen-lockfile
pnpm --filter lumenva-crm typecheck
pnpm --filter lumenva-crm lint
pnpm --filter lumenva-crm lint:channels
pnpm --filter lumenva-crm test:harness
pnpm --filter lumenva-crm harness:check
pnpm --filter lumenva-crm test:unit
pnpm --filter lumenva-crm test:shell
pnpm --filter lumenva-crm test:db
pnpm --filter lumenva-website typecheck
pnpm --filter lumenva-website lint
pnpm --filter lumenva-website test
pnpm --filter lumenva-website build
```

Os gates locais realizados foram estáticos (`git diff --check` e contratos Node)
e testes nativos disponíveis. Vitest/typecheck/build que dependem de pacotes não
presentes localmente ficam explicitamente pendentes do Codex Cloud; nenhum
resultado foi inventado.

## Pendências que exigem o dono

1. Escolher quais branches/commits devem ser integrados em `main`, após os gates
   acima. A integração não foi executada por esta sessão.
2. Autorizar migrations remotas, deploy e smoke test de produção; permanecem
   fora deste handoff.
3. Fornecer conta/credenciais e autorizar prova de telefonia real (Telnyx/SIP),
   separada dos contratos locais de voz.
4. Confirmar eventual janela de release e política de ativação das flags; o
   código mantém compatibilidade e defaults seguros.

Até essas decisões, o estado é implementado e verificável por branch, mas não é
declarado como deployment de produção.
