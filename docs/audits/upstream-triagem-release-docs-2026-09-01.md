# Triagem upstream — release/docs — 2026-09-01

## Escopo e evidência

Auditoria somente leitura, conforme a seção 6 de `branch-consolidation-FINAL-2026-09-01.md`. Checkout observado: `/Users/david/Desktop/Projetos/CRM/DeskcommCRM`, `HEAD=5336a6a8f7ebda373938fdb7148206b624a2de61`, branch `fix/c2-c3-ssrf-fk`, worktree sujo. Não houve `fetch`, checkout, merge, rebase, cherry-pick, push, remoção de ref ou alteração de branch.

Os SHAs e assuntos abaixo são os refs locais `upstream/*` presentes neste checkout. “Útil” significa patch que merece revisão/cherry-pick seletivo; não significa que o patch foi aplicado ou que passou os gates atuais.

## Patches úteis para revisão seletiva

| Ref / SHA | Patch observado | Decisão de triagem |
|---|---|---|
| `upstream/triagem/275` — `14078124c885272d17294ab5086e52bab515e3f6` | Limite de comprimento antes da regex de opt-out; inclui `tests/unit/pos-entrada-redos.test.ts`. | **Útil para revisão.** Segurança/DoS localizada, com teste negativo. Confirmar contrato atual de opt-out (`CANCELAR` incluído) e rodar unitários antes de portar. |
| `upstream/triagem/322` — `22cb60675ae1a0c8c0a6b54a8673ce6230dadc1c` | Corrige falso sucesso no resend e valida teto de campo também para valores não-string; toca webhook, retenção e lead-capture. | **Útil, mas grande.** Separar em patches por superfície e revisar idempotência/audit; não portar a ponta da branch. |
| `upstream/triagem/326` — `53d6abcc03ae9f99e13bc6c397ea627c5fc1e5d2` | Três correções de webhook Respondi, invariantes inbound e teste de colisão de slug. | **Útil para revisão.** Portar somente com `tests/invariants/webhooks-inbound.test.ts` e `tests/unit/respondi-slug-nao-colide.test.ts`; conferir contratos atuais de webhook e tenant. |
| `upstream/triagem/c202-demandas` — `8523287de4ee630f9e1369df0b37e4fcd4b98779` | Teste de isolamento RLS de `demandas`/`demanda_conversas`. | **Útil como teste/invariante.** Não aplicar sem confirmar que o schema atual possui exatamente as tabelas/claims esperadas; executar `test:db` no checkout final. |
| `upstream/triagem/pr198-testes-de-borda` — `3d95b7f2513a18036988b2416f71d2ff9d32bcc6` | Testes de borda para colagem de imagem (`preventDefault` e caminho de erro). | **Útil como cobertura.** Portar teste somente se a implementação atual ainda expuser o mesmo contrato; não levar a branch histórica inteira. |
| `upstream/triagem/pr201-reprodutor` — `4f909d33fea6703eabb34e40a5bf6362e74c1fc9` | Teste que congela o desfecho de modelo fora do catálogo no ponto de criação do lead. | **Útil como regressão.** Confirmar nomes/contratos atuais de OpenRouter e executar unitários. |
| `upstream/resgate/237-zod-nos-webhooks-de-canal` — `b24f1004a469910675153db898c16e4cf5f7c945` | Documenta explicitamente o cast fora do escopo em Nuvemshop; branch também contém correção/teste de webhook anteriores. | **Revisar seletivamente.** O commit de documentação pode esclarecer o boundary; a correção funcional deve ser comparada ao estado atual antes de qualquer porte. |
| `upstream/docs/changelog-agenda` — `f76cf41c6cf492a362a74c0b3c629185b3928697` | Fragmento `.changes/agenda-modulo-de-calendario.md` para release. | **Útil apenas como documentação isolada**, se a Agenda for incluída no próximo corte. Não importar a branch completa: ela contém alterações de doutrina, CI e infraestrutura. |
| `upstream/docs/living-system-audit` — `22ce8fc1386fb08c4e5946c528b287d4c86e0850` / `upstream/docs/living-system-doctrine` — `0dae521d8db6ec1cb25332779d17334e5bd4d10e` | Mesma atualização de 5 linhas em `docs/doctrine/sistema-vivo.md`; a segunda também adiciona/ajusta `CLAUDE.md`. | **Escolher no máximo uma fonte**, reconciliando com `CLAUDE.md` atual. Não portar ambas nem tratar a fotografia histórica C1/C2/C3 como estado atual. |

## Patches não recomendados para porte amplo

- `upstream/pr121` (`691d5d76`): mistura debounce inbound, env, Docker, baseline e migration; exige decomposição e revisão de schema. Não usar a ponta inteira.
- `upstream/pr126` (`c3bbfec9`): a alteração de `sent_via` tem equivalente observado em `main` (`51593101`); não há valor em reaplicar a branch.
- `upstream/pr127` (`8c35eb1b`), `upstream/test/sent-via-cabe-na-constraint` (`42d1a208`) e `upstream/test/239-rede-visual-antes-do-tailwind4` (`726b19c9`): candidatos somente a comparação/cobertura; a história inclui merges e dependências antigas. Exigir diff contra `main` e teste atual antes de selecionar algo.
- `upstream/rebase-52` (`6381e4b7`) e `upstream/resolve-51` (`069057f5`): pontas de resolução/merge com lockfile grande e documentação histórica; não são unidades de integração.
- `upstream/triagem/327`, `upstream/triagem/327b`, `upstream/triagem/wconf-194-200` e `upstream/triagem/wconf-194-201`: prévias combinadas/branches de resolução, com grande divergência e merges; usar apenas commits individuais identificados após diff contra `main`.
- `upstream/chore/deps-major-bumps` (`359fba52`): atualização agrupada de Zod 4, Tailwind Merge 3, resolvers 5 e jest-dom 7. Manter fora; reabrir em lotes pequenos com lockfile, licença, typecheck, lint, unitários e build.
- `upstream/release/consolida-1.5.0` (`88eb182d`) e `upstream/release/v1.1.0` (`f9a937be`): alterações de changelog/release históricas; não integrar release branch. Reaproveitar texto apenas se reconciliado com o estado e o corte atual.

## Refs que podem ser arquivadas, condicionalmente

Nenhuma remoção foi feita. A lista abaixo é de candidatos, não autorização de arquivamento:

1. `upstream/ecc-tools/DeskcommCRM-1783368833211`: a ponta `ccb18141` é ancestral de `main` neste checkout; o bundle ECC já está alcançável. Arquivável **após** confirmar no servidor que não há PR, proteção, consumidor ou worktree ativo.
2. `upstream/pr126`: o patch funcional está representado por `51593101` em `main`; arquivável após confirmação de PR encerrado e ausência de dependências.
3. `upstream/rebase-52` e `upstream/resolve-51`: branches de resolução cujo conteúdo é histórico/mesclado; arquiváveis somente após confirmar que nenhum PR ou operador ainda as usa.
4. `upstream/triagem/327`, `upstream/triagem/327b`, `upstream/triagem/wconf-194-200` e `upstream/triagem/wconf-194-201`: prévias combinadas, não pontas canônicas; arquiváveis depois de extrair qualquer teste/patch escolhido e confirmar ausência de revisão ativa.
5. `upstream/docs/living-system-audit` e `upstream/docs/living-system-doctrine`: manter uma única documentação canônica; a duplicata pode ser arquivada após reconciliação explícita no arquivo escolhido e confirmação remota.
6. `upstream/release/v1.1.0` e `upstream/release/consolida-1.5.0`: arquiváveis como histórico somente após confirmar que os changelogs já estão representados no corte/documentação canônicos.

### Não arquivar nesta rodada

- Todas as refs `upstream/triagem/*` com patches ainda úteis (`275`, `322`, `326`, `c202-demandas`, `pr198-testes-de-borda`, `pr201-reprodutor`, `resgate/237`) até a decisão/extração seletiva.
- `upstream/docs/changelog-agenda`, `upstream/chore/deps-major-bumps` e `upstream/qa/w2-fontes-defasadas-cego` enquanto o valor documental/teste não for reconciliado.
- Qualquer ref associada a worktree ativo. O inventário atual mostra, entre outros, worktrees ativos de Agent OS, Content OS e voz; `codex/voice-migration-fix` tem worktree `prunable` e exige recuperação/decisão separada.

## Conclusão

Há patches úteis, mas nenhum motivo para merge amplo de qualquer família upstream. A ordem segura é: selecionar e revisar os testes/correções acima, confirmar equivalência contra `main`, executar os gates correspondentes e só então arquivar duplicatas/histórico em lotes pequenos, com confirmação do servidor e dos worktrees.

