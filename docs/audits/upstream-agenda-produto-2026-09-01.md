# Auditoria `upstream/*` — Agenda/produto

**Data:** 2026-09-01  
**Checkout:** `/Users/david/Desktop/Projetos/CRM/DeskcommCRM`  
**Base comparada:** `main` (a árvore de trabalho não foi alterada)  
**Escopo:** seção 6, primeiras duas linhas da tabela de `branch-consolidation-FINAL-2026-09-01.md`: `upstream/cal/*`, `upstream/tmp-*`, `upstream/feat/*`, `upstream/fix/*`, `upstream/test/*` e `upstream/qa/*`.

## Método e limites

- Operações somente leitura: `git rev-parse`, `git status`, `git for-each-ref`, `git log`, `git show`, `git diff` e `git cherry`.
- Não houve `fetch`, `checkout`, `merge`, `rebase`, `cherry-pick`, commit, push ou remoção de ref.
- A equivalência foi avaliada por patch-id através de `git cherry main <ref>`; `+` significa patch ainda não equivalente/alcançável em `main`, e `-` significa patch equivalente. Como as refs carregam história divergente e muito antiga, o sinal foi usado junto com assunto, arquivos tocados e dependências, nunca como autorização de integração em lote.
- “Reproduzível” abaixo significa que a ref contém código/testes identificáveis para revisão local. Nenhum teste funcional, E2E, banco ou CI foi executado nesta tarefa.

Fotografia observada:

| Família | Refs observadas | Ponta(s) relevantes |
|---|---:|---|
| `upstream/cal/*` | 6 | `w0-schema` `3d6cd494`, `w1-api` `0a600aab`, `w1-google` `b565884d`, `w1-ui` `ced24778`, `w2-agendas` `5e9a2406`, `w2-mcp` `92a0fc93` |
| `upstream/tmp-*` | 6 | `tmp-api` `5908a335`, `tmp-g2` `77bc8211`, `tmp-sch` `3e0d2e84`, `tmp-ui` `07d1838a`, `tmp-ui2` `5e26236b`, `tmp-verify` `a3b22591` |
| `upstream/feat/*` | 12 | inclui `agenda-grade-interativa` `b738d8c3`, `calendario-vivo` `a6106d98`, `radar-assumir` `f7fa9d82`, `whatsapp-connections` `bfde8c02` |
| `upstream/fix/*` | 14 | inclui `agenda-producao` `84c9f858`, `oauth-callback-alcancavel` `fbd28600`, `e2e-429-gotrue` `898dff81`, `reset-password-mfa` `b11efd62` |
| `upstream/test/*` | 3 | `179-onboarding-fresco-no-ci` `078e7603`, `239-rede-visual-antes-do-tailwind4` `726b19c9`, `sent-via-cabe-na-constraint` `42d1a208` |
| `upstream/qa/*` | 1 | `w2-fontes-defasadas-cego` `342b709a` |

## Resultado por família

### Agenda/cal e tmp

Os patches de Agenda não aparecem como equivalentes na comparação contra `main` (os commits examinados retornam `+` no `git cherry`). São mudanças pequenas o bastante para revisão seletiva, mas as pontas `cal/*`, `tmp-*` e `qa/*` são séries acumulativas; não devem ser integradas como uma ponta inteira.

Patches com melhor relação sinal/escopo para uma fila de revisão:

| Ordem | Commit | Conteúdo reproduzível | Dependências/risco | Decisão |
|---:|---|---|---|---|
| 1 | `3d6cd494` | Corrige o mapa de ocupação e atualiza tipos/teste (`lib/agenda/ocupados.ts`, `lib/agenda/tipos.ts`, teste unitário). | Deve ser aplicado sobre os tipos/contratos atuais. | **Propor cherry-pick seletivo**, após revisão e teste unitário. |
| 2 | `77bc8211` | Remove duplicação de fuso em `lib/agenda/google/tempo.ts`. | Pode colidir com mudanças de timezone já locais. | **Propor cherry-pick seletivo**, isolado. |
| 3 | `3e0d2e84` | Corrige RLS/role da Agenda com migration, baseline e invariante RBAC. | Alteração de schema; exige revisão de migration/baseline e teste contra banco. | **Propor**, mas somente com gate de schema/RLS. |
| 4 | `a3b22591` | Motor de horários livres e 388 linhas de testes unitários. | API nova; revisar consumidores e timezone antes de aplicar. | **Propor em etapa própria**, não junto da UI. |
| 5 | `5908a335` | Travessia JSONB→motor e teste de banco. | Depende do modelo de dados vigente. | **Manter em revisão**; aplicar apenas se o contrato atual coincidir. |
| 6 | `0a600aab` | GET da grade, consulta por instante e erro 422. | Nova rota e semântica de data; possível sobreposição com API atual. | **Propor somente após diff de rota/contrato**. |
| 7 | `ced24778` + `7f9b1467` | Hook da grade e confirmação na UI. | Dependem do GET e dos componentes atuais. | **Aplicar em conjunto somente depois do backend**. |
| 8 | `ec204c37` | Grade interativa, marcar/remarcar e E2E. | 955 linhas; maior risco de colisão visual/E2E. | **Não aplicar agora**; extrair commits mínimos após revisão. |
| 9 | `970d4147` | Baseline/migration para instalação fresca e teste de marcação. | Mudança de banco; pode conflitar com migrations locais. | **Não aplicar sem gate de migration**. |
| 10 | `92a0fc93` | Retira a spec E2E da condição `FORA_DO_CI`. | Pode alterar duração/ambiente de CI. | **Revisão de CI separada**; não é cherry-pick de produto. |

`b565884d` (ramo de sync Google) é pequeno, mas só deve entrar com a cadeia de callback/sessão correspondente; não aplicar isoladamente sem confirmar o contrato do worker.

### `upstream/feat/*` de produto

As refs de produto misturam Agenda com CRM, Radar, WhatsApp, i18n e documentação. O patch-id não autoriza merge da ponta. Recomendações:

- `upstream/feat/agenda-grade-interativa`: extrair apenas a sequência backend/UI acima; os commits de captura (`b738d8c3`, `40defa9c`) são evidência, não funcionalidade.
- `upstream/feat/calendario-vivo`: tratar `1d00b849`, `810049ab` e `3e0d2e84` como correções de timezone/RLS candidatas, cada uma com seus testes; não usar a ponta `a6106d98`.
- `upstream/feat/radar-assumir` (`f7fa9d82`) e `upstream/feat/whatsapp-connections` (`bfde8c02`) são features fora do núcleo Agenda; manter em backlog de produto e não misturar nesta fila.
- As demais (`crm-vivo`, `i18n-espanhol`, `ia-360-*`, `inbox-multimodal`, `marca-o-que-faltou`, `operacao-visivel`) contêm trabalho de outros domínios; nenhuma promoção é recomendada nesta auditoria.

### `upstream/fix/*`, `test/*` e `qa/*`

- `upstream/fix/agenda-producao`: `84c9f858` é um teste E2E determinístico de troca de organização. **Candidato seletivo**, desde que a spec atual permaneça compatível. Os commits de CI/docs da mesma ponta não devem acompanhar automaticamente.
- `upstream/fix/oauth-callback-alcancavel`: `c88c8d91`/`fbd28600` são a correção e o teste do callback Google. **Candidatos em conjunto**, após conferir que `main` não possui a implementação equivalente.
- `upstream/fix/e2e-429-gotrue` (`898dff81`) e `upstream/test/179-onboarding-fresco-no-ci` (`078e7603`) alteram infraestrutura/tempo de E2E; **não são cherry-picks de produto** sem gate CI reproduzível.
- `upstream/test/239-rede-visual-antes-do-tailwind4` (`726b19c9`) adiciona uma guarda visual ampla. **Útil como teste**, mas não prova uma correção funcional e deve ser avaliado isoladamente.
- `upstream/test/sent-via-cabe-na-constraint` (`42d1a208`) é específico de worker/outbound, fora de Agenda; manter fora desta fila.
- `upstream/qa/w2-fontes-defasadas-cego` (`342b709a`) é uma ponta de QA acumulativa que contém commits de Agenda e LGPD. **Não integrar a ponta**; extrair somente um patch comprovadamente necessário após separar dependências.

## Proposta de execução seletiva

1. Criar uma branch temporária a partir do `main` atual (em rodada autorizada de implementação).
2. Aplicar e testar, nesta ordem, `3d6cd494`, `77bc8211`, `3e0d2e84` e `a3b22591` apenas se os contratos atuais confirmarem compatibilidade.
3. Aplicar o backend da grade (`0a600aab`) e só depois o par UI (`ced24778` + `7f9b1467`).
4. Tratar callback Google (`c88c8d91` + `fbd28600`) e troca de organização (`84c9f858`) em lotes separados.
5. Rodar typecheck, lint, unitários de Agenda, testes de migration/RLS e E2E específico em cada lote; registrar SHA e resultado.
6. Rejeitar qualquer lote que exija merge de história, remova arquivos fora do escopo ou introduza migration sem teste de rollback/compatibilidade.

## Conclusão

Há patches de Agenda/produto ainda ausentes de `main` e tecnicamente extraíveis, mas nenhuma ponta `upstream/*` é segura para merge amplo. Os melhores candidatos imediatos são `3d6cd494`, `77bc8211`, `3e0d2e84`, `a3b22591` e, numa segunda etapa, `0a600aab` seguido de `ced24778`/`7f9b1467`. O restante permanece em observação ou deve ser tratado como teste/infraestrutura/documentação. Nenhum cherry-pick foi executado.
