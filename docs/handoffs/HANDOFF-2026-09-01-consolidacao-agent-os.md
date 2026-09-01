---
type: handoff
project: DeskcommCRM
date: 2026-09-01
status: fechado para continuidade em 2026-09-02
audited_against: main @ 60ed322f19c6bff962029bbe360f16f82913f7ae
---

# Handoff — consolidação de branches e Agent OS

## Estado confirmado

`main` e `origin/main` estão no mesmo SHA: `60ed322f19c6bff962029bbe360f16f82913f7ae`.
O histórico de hoje (`git log --since='2026-09-01 00:00' --until='2026-09-02 00:00'`) confirma:

- Content OS integrado em lote, com C-1 (vocabulário `event_log`), C-2 (anti-SSRF) e C-3 (FK/trigger cross-tenant), nos commits `87ee0c07`, `ed80fb60`, `68ecbe03` e `1219f1e9`;
- gateway de canais integrado por cherry-pick seletivo (`f91d536c`), mantendo resolução exata de identidade, segurança, supervisão de sessão e trace;
- documentação da Agenda e da decisão Nuvemshop (`3ff2c82b` e `b549ccee`), além dos ajustes provider-neutral de webhook e manifesto;
- correção de idempotência da fila de entregas Vercel Workflow da Fase 7 (`5bb29957`, merge `f638ce8f`);
- Agent OS Fase 2 — Kernel (`77ea4b54`, merge `cc41dbef`), Fase 4 — SHADOW/evals (`b61240dc`, merge `64468528`) e Fase 5 — autonomia assistida (merge `60ed322f`);
- forward-fix de segurança `0134` (`cacf6185`): revoga `EXECUTE` de `public`, `anon` e `authenticated` em `content_os_enforce_tenant_fk()` e mantém `service_role` como único grant explícito.

## O que não foi promovido

- **Fase 3 — agentes de produto:** permanece fora de `main`; a integração futura toca contratos/kernel e pode duplicar os adapters já trazidos pelas Fases 2, 4 e 5.
- **Fase 6 — aprendizado/flywheel:** permanece fora de `main`; risco de colisão com `flywheel_distiller_proposals`, constraints e código de flywheel já existente.
- **Fase 7 — benchmark de workflows duráveis:** permanece fora de `main`. O fix de idempotência está em `main`, mas o benchmark completo ainda precisa de rerun Vercel e decisão baseada em evidência; Inngest não substitui essa prova. Os handlers `app/api/phase7/vercel-workflow/**` são superfície de API e exigem revisão de contrato, auth, idempotência e tamanho do diff.

Essas fases são trabalho genuinamente pendente, não branches apagadas. A fotografia de worktrees após a consolidação ainda mostra árvores ativas para Content OS, gateway e Fases 2/4/5; limpeza foi apenas parcial e não deve ser descrita como concluída.

## Como continuar amanhã

1. Criar uma worktree isolada por fase (3, 6 ou 7) a partir do SHA de `main` acima.
2. Comparar árvore, patch e migrations com o que já está em `main`; trazer somente o genuinamente novo. Não fazer merge cego de linhas acumulativas do Agent OS.
3. Para a Fase 3, mapear primeiro rotas/contratos ausentes e confirmar que não há duplicação dos adapters de Kernel/evals/autonomia.
4. Para a Fase 6, reconciliar o flywheel existente e as constraints antes de tocar migration ou writers.
5. Para a Fase 7, executar o rerun Vercel completo pós-`5bb29957`; revisar todos os handlers `/api/phase7/vercel-workflow`, auth, replay e idempotency keys antes de qualquer promoção.
6. Rodar `pnpm typecheck`, `pnpm lint`, os testes unitários focados e os testes de schema/invariantes aplicáveis na worktree. Registrar SHA e saída real.
7. Rever o tamanho e o conteúdo do diff (`git diff --stat` e revisão por arquivo) antes do merge. Só então integrar em `main`, repetir os gates no checkout final e atualizar este handoff/current-state.

## Gates deste fechamento

Não foram instalados pacotes nem executados deploys ou migrations remotas. A validação documental usa o histórico Git e o estado do checkout. `pnpm harness:check` deve ser executado após esta atualização; os resultados ficam registrados no commit documental.

