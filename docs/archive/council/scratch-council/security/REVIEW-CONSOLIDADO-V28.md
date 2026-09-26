# Revisão consolidada — Wave 4 Event Wake, Wave 8 Approval Registry e Wave 14 concorrência

Data: 2026-09-13  
Método: leitura read-only no worker e testes independentes. PostgreSQL descartável usado quando aplicável; nenhum segredo exposto.

## Vértice — Wave 4 Event->Wake

Worktree `/home/claude/src/worktrees/wave4-browsermesh-wake-2026-09-12`, HEAD `88f4ebd2`; alterações de `event-wake.ts/.test.ts` estavam não commitadas. O código valida envelope, HMAC, actor registrado/ativo, capability do actor (não apenas payload), policy presente/malformada e tenant antes de decidir. Sem worker apto retorna `QUEUED`; replay usa claim persistido antes de executar.

Teste independente: **10 testes passaram, exit 0** (incluindo policy ausente e malformada, actor forjado/capability e replay; teste de store usa query fake). **PASS-CONDICIONAL**: os novos gates passaram, mas o SHA observado ainda não inclui as alterações locais como commit e não houve PostgreSQL concorrente nesta peça.

## Fornalha — Wave 8 Approval Registry

Worktree `/home/claude/src/worktrees/wave8-asset-intelligence-2026-09-13`, HEAD `5348cd09`. `PostgresLayerReuseApprovalStore` usa `ON CONFLICT (organization_id, approval_id) DO UPDATE`, carrega sempre com tenant e `FOR UPDATE`; migration define unique composto, checks de status/expiry e RLS `using/with check` por `fn_user_org_ids()`.

O teste de integração depende de role `authenticated`, claims `app.test_org` e função de claims; sem esse ambiente ficou **skipped**. Não foi possível provar RLS real nesta execução. **PASS-CONDICIONAL**: SQL e isolamento estão corretos por inspeção, mas falta execução contra PostgreSQL com roles/RLS reais.

## Telar — Wave 14 Evolution receipts

Worktree `/home/claude/src/worktrees/wave14-15-evals-autonomy-2026-09-12`, HEAD `166db114` (`test(wave14): resolve child node from process exec path`). O teste agora usa `process.execPath`; store mantém `INSERT ... ON CONFLICT DO NOTHING` e requester/actor autenticados.

Com PostgreSQL descartável, o teste executado passou em **2 de 3**: requester não autenticado e ActionBus ligado ao store real. O cenário de dois processos ainda falhou por timeout de 15 s (o runner filho não produziu saída/concluiu), portanto a correção do caminho não gerou prova concorrente observável. O teste unitário ActionBus adicional passou (**7 testes**). **BLOCKED** até dois processos reais retornarem e exatamente um vencer a chave única.

## Veredito consolidado

- Wave 4 Event Wake: **PASS-CONDICIONAL**.
- Wave 8 Approval Registry: **PASS-CONDICIONAL**.
- Wave 14 Evolution receipts: **BLOCKED** — concorrência real continua sem prova após o fix.

SELF-CHECK: PASS — SHAs/status conferidos, código lido, resultados reais registrados e containers descartáveis removidos.
