# Progress — gov-loop (DeskcommCRM · Governança de Atendimento)

> Diário de bordo append-only. Cada sessão do loop fecha com 3-5 linhas aqui:
> o que fez, evidência observada (output real, não intenção), o que ficou.

## 2026-07-16 — setup do loop (sessão humana, fora do loop)

- Máquina do gov-loop instalada (portada do vendaval-loop) na branch `gov/setup`
  a partir de `main`, em worktree isolado — checkout principal (cadeia
  `vendaval/F2-*`) intocado.
- Backlog criado: 27 features em 6 fases (G1 provas → G6 contrato externo),
  derivado de 7 eixos de feedbacks reais do sistema-modelo (abstraídos, zero PII)
  + recon do código real (baseline.sql, specs 04/05, MCP tools).
- Spec 13 (esqueleto) criada; apêndices A/B e §3-§5 são entregues por G1-03/04/05.
- Próximo: dono revisa `gov/setup`, mergeia em `main`, e o loop abre G1
  (`/deskcomm-gov-loop`). G1-06 é human_input — as 5 decisões de produto.

## 2026-07-16 — sessão 1 do loop (core) — REPARO DE MAIN

- Smoke de entrada vermelho: `pnpm typecheck` com 12 erros TS, todos em
  `loop/update-feature.ts` (a própria máquina do loop, do setup de ontem).
  Sessão virou reparo (§1.8): gov-implementer tipou o script (interfaces
  Feature/Plan, guard de flags, `fail(): never`) sem mudar comportamento CLI;
  zero any/@ts-ignore; anotações erasable (node 22 type-stripping segue rodando).
- gov-verifier: PASS (hash-check OK). Provou round-trip de campos desconhecidos
  do features.json na reescrita e validações falhando ANTES de escrever.
- Desvio registrado no §0.6: chão de entrada tinha 15 untracked do dono
  (screenshots, AGENTS.md etc.) + `.lina/`. Stashados como "orphan
  2026-07-16T18:43:17-0300" — EXCETO `.lina/` (estado vivo do Lina Space;
  stashar derrubaria o app do dono). `.lina/` permanece untracked no chão.
- Próxima sessão: main verde; G1-01 (gate de CI) é a elegível de menor priority.

## 2026-07-16 — sessão 2 do loop (core) — G1-01

- G1-01 (gate de CI): `gov:verify` no package.json (cadeia `&&`, exit!=0 provado
  com script análogo) + `.github/workflows/ci.yml` novo (pull_request sem filtro
  de branch — de propósito, PRs gov/* precisam do gate; push só main; pnpm 9 +
  node 20 byte-idênticos a perf.yml). Sem envs: os 3 comandos não fazem build Next.
- gov-verifier: PASS, hash-check OK (tree intacto antes/depois da verificação).
- Convenção registrada: `verification.commit="self"` = o próprio commit atômico
  da sessão (auto-referência de sha é impossível pré-commit; audite por
  `git log --grep '<ID>'`). Primeira gravação do update-feature.ts normalizou a
  formatação do features.json (reformat único previsto no header do script).
- Chão de entrada: AGENTS.md/GEMINI.md reapareceram (app externo regenera);
  stashados como "orphan 2026-07-16T18:54:42-0300". `.lina/` segue intocado no chão.
- Próxima sessão: G1-02 (Postgres descartável + isolamento 2-tenants) é a elegível.

## 2026-07-16 — sessão 3 do loop (core) — G1-02

- G1-02 (Postgres descartável + isolamento 2-tenants): `pnpm test:db` sobe
  pgvector:pg17 efêmero (porta 127.0.0.1:54329, --rm, trap EXIT), aplica prelude
  de stubs Supabase (roles, auth.uid() via request.jwt.claims, storage.*) + 
  baseline install (ON_ERROR_STOP=1) + update, e roda 9 testes RLS via
  `docker exec psql` — zero devDependency nova.
- gov-verifier: PASS com probes independentes (UPDATE cross-org → 0 rows;
  authenticated sem claims → nada vaza; SIGINT → teardown ok). Hash-check OK.
- Sessão rodada pelo watchdog (Maestro): terminal Arquiteto ficou Idle após
  G1-01 e a cooperação A2A do Espaço está pausada — continuidade assumida aqui.
- Nota pra fase futura: create policy do apêndice do baseline (0014/0017) não é
  idempotente ("already exists" tolerado no update) — melhoria possível, não bug.
- Próxima sessão: G1-03 (suíte de invariantes dos 7 eixos) ou G1-04 (auditoria
  de gap, sem deps) — G1-03 tem priority menor (30 < 40).

## 2026-07-16 — sessão 4 do loop (core) — G1-03

- G1-03 (suíte de invariantes dos 7 eixos): 8 arquivos em tests/invariants/
  (gov-helpers + gov-1..7), 29 testes no total — 22 verdes + 7 catracas it.fails
  com GAP(Gx). `pnpm test:invariants` = alias do harness test-db.
- Desvio aceito pelo verifier: gap-exemplo "role não editável via API" JÁ estava
  fechado (rota do EPIC-09 em app/api/v1/team/[user_id]/role) → virou invariante
  verde; gaps RBAC reais de G2: pipeline write por agent, conversations write
  por viewer. Catraca provada em probe (it.fails de assert válido → suíte RED).
- gov-verifier: PASS, hash-check OK. Apêndice A da spec 13 preenchido (20 linhas).
- Próxima sessão: G1-04 (auditoria de gap specs 04/05 vs código — sem deps).

## 2026-07-16 — sessão 5 do loop (core) — G1-04

- G1-04 (auditoria specs 04/05 vs código): Apêndice B da spec 13 preenchido —
  20 itens (9 implementado / 5 parcial / 6 ausente), toda linha com arquivo:linha
  conferida pelo verifier (20/20). Claim atômico e handoff §7.5 são reais;
  ReassignDialog, AttendantStatusToggle e supervisor read-only ausentes.
- INB-01 aberto na inbox (proposal): supervisor read-only §10 sem feature G* e
  conflitando com a matriz spec 13 §4 (manager org:write) — decisão do dono.
- Nota do verifier p/ sessão futura: linha "supervisor §10" cita
  conversations/[id]/messages/route.ts:38 mas o POST real é
  app/api/v1/messages/route.ts — ponteiro impreciso, conclusão correta.
- gov-verifier: PASS, hash-check OK (tree + inbox).
- Próxima sessão: G1-05 (modelo de dados alvo + matriz role×recurso, deps G1-04 ✓).

## 2026-07-16 — sessão 6 do loop (core) — G1-05

- G1-05 (modelo de dados alvo + matriz role×recurso): spec 13 §3 com DDL
  rascunho das 5 estruturas (assignment_events, assignee_kind, conversation
  tags, attendant_availability, settings.routing/visibility_mode), cada uma
  com DIRC; §4 com matriz 11 recursos × 4 roles.
- 7 células PENDENTE G1-06 + 1 PENDENTE INB-01 (manager×conversations write —
  conflito supervisor read-only). Nenhuma decisão de produto inventada
  (verifier varreu célula a célula). Refs baseline.sql:linha 8/8 exatas.
- Nota do verifier p/ G1-06: linha 191 usa "decisão G1-06b" em vez do literal
  "PENDENTE G1-06" — incluir o default de roteamento ao fechar os pendentes.
- gov-verifier: PASS, hash-check OK.
- Próximo: G1-06 é human_input (única pendente da fase) → sessão seguinte abre
  o item de inbox com as 5 perguntas e emite checkpoint G1 INCOMPLETO (§5).

## 2026-07-16 — sessão 7 do loop (core) — checkpoint G1

- G1-06 é human_input (única pendente da fase): INB-02 aberto na inbox com as
  5 perguntas (a)-(e), opções e recomendação do loop em cada uma.
- Checkpoint G1 emitido: loop/checkpoints/G1-report.md, Status INCOMPLETO —
  bloqueado (aguarda respostas INB-02/INB-01 + G1.approved do dono).
- Loop PARADO aguardando aprovação (guarda de entrada nº 2 segura as próximas
  sessões). Próximo passo é do dono: responder inbox e aprovar/recusar o checkpoint.

## 2026-07-16 — sessão 8 do loop (core) — G1-06 (human_input aplicado)

- Dono respondeu INB-02 via chat ao Maestro: (a)=B suas+fila, (b)=B
  manual+round-robin, (c)=A reusa role agent, (d)=A transferência imediata,
  (e)=A manager vê métricas individuais. INB-01: descartar supervisor §10.
- Decisões transcritas na spec 13 (§3.5 defaults, §4 matriz 0 PENDENTEs, §5
  roteamento; derivações conservadoras anotadas: settings/billing manager =
  admin-only, default mode=manual). gov-verifier: PASS (fidelidade célula a
  célula), hash-check OK. INB-01/02 fechados.
- Dono autorizou (AskUserQuestion): criar G1.approved em nome dele + virada de
  fase por merge+push direto (opção A). Executando na sequência.

## 2026-07-16 — sessão 9 do loop (core) — G2-01 (fase G2 aberta)

- Virada G1→main executada (merge 6ddc08f + push, opção A do dono); gov/G2 criada.
- G2-01 (matriz role×endpoint server-side): helper único lib/auth/require-role.ts
  (getUser + fn_user_role_in_org + fail 403 + audit authz.denied), ~47 rotas
  gateadas conforme matriz spec 13 §4; 21 testes novos (115 unit no total).
- Rodada 1 do verifier: FAIL (lgpd/anonymize checava role na mão, sem audit).
  Reparo: helper ganhou opt organizationId (role na org do RECURSO, fail-closed);
  rota migrada. Rodada 2: PASS, hash-check OK.
- Invariantes GAP(G2) de gov-1-rbac NÃO flipados (são de RLS — G2-03 fecha);
  decisão validada pelos 2 verifiers.
- INB-03 aberto (follow-ups: onboarding/whatsapp/session sem gate de role;
  nota pro bulk-assign ≥manager na G3-04).
- Handoff: próximas sessões (G2-02+) delegadas ao terminal Arquiteto e Executor
  (cooperação A2A retomada pelo dono); Maestro-DeskcommCRM vira watchdog.

## 2026-07-16 — sessão 10 do loop (core) — G2-02

- G2-02 (role editável): lógica única em team/[user_id]/_shared.ts; PATCH
  canônico novo em [user_id]/route.ts; /role virou alias fino (export PATCH
  preservado — invariante gov-1-rbac o checa). Audit: team.role_changed
  APPENDADO ao union (member.role_changed fica sem emissor, doutrina append-only).
- UI: Select inline por membro (admin only, nunca na própria linha), otimismo
  react-query com rollback + toast; dialog antigo removido. Screenshot em
  loop/checkpoints/evidence/G2/G2-02-team-role-selector.png.
- vitest.config.ts: esbuild jsx automatic (primeiro teste de componente .tsx).
- gov-verifier: PASS 1ª rodada, hash-check OK. 123 unit + 29 invariantes verdes.
  Nota não-veto registrada: guard de último admin é check-then-write sem lock
  (pré-existente do EPIC-09, race de ms entre 2 admins) — candidata a inbox se
  o dono quiser fechar com constraint/trigger.
- Próxima sessão: G2-03 (RLS por role nas tabelas de config — migration tripla).
