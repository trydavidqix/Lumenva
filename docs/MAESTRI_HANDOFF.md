[42 lines total]
1	# HANDOFF — Regra Permanente do Projeto Lumenva
2	
3	## Regra fixa (não muda mais)
4	
5	O projeto Lumenva NUNCA será clonado permanentemente no Mac.
6	
7	Fluxo de trabalho oficial daqui pra frente:
8	
9	OWNER (dono)
10	→ CLAUDE/LUMEN CEO (Mac, só orquestra, nunca executa)
11	→ CTO CODEX (via Maestri, coordena workers)
12	→ CODEX CLOUD (checkout temporário, edita, testa, abre PR)
13	→ GITHUB (github.com/trydavidqix/Lumenva — única fonte de verdade)
14	→ VPS (produção, só recebe deploy do que já está em main)
15	
16	## O que isso significa na prática
17	
18	- Mac (~/Desktop/CRM) é APENAS control plane: guarda `.maestri/` (config local do Maestri) e `.archive-local/` (arquivo histórico, nunca apagado). Não guarda checkout de código ativo.
19	- Qualquer edição de código acontece via Codex Cloud, num branch isolado, nunca direto num clone local do Mac.
20	- GitHub main é a única fonte de verdade. Nenhuma decisão de "qual versão é a certa" deve ser tomada olhando pro Mac — sempre olhar pro GitHub.
21	- Linux worker: migração concluída, desligado, não é mais usado no fluxo normal (ver [[project_worker_unhealthy_pendencia_2026-09-14]] pra pendência separada da VPS).
22	
23	## Estado atual confirmado (2026-09-15)
24	
25	- Main sincronizado: commit fec2d25348d357e9091c2d5e11fbfd7ee7427208
26	- 3 PRs abertos intencionalmente parados, sem prioridade: #42 (identity purge), #37 (voice patter), #36 (mobile compliance)
27	- CI (GitHub Actions) travado porque o dono desativou billing por pendência de pagamento — não é bug, é decisão dele. workflow_dispatch já foi adicionado no ci.yml (PR #45 mergeado) pra quando reativar.
28	- Branches órfãs de migração já limpas (migration/mac-2026-09-14 e migration/linux-2026-09-14 deletadas/confirmadas cobertas em main).
29	
30	## Pendências abertas
31	
32	1. Auditoria completa de TODAS as branches do repo (não só as 3 conhecidas) pra decidir prioridade de implementação — precisa recriar o agente "Auditor" (Maestri travou ao criar, ver troubleshooting abaixo).
33	2. Configurar acesso SSH num PC Windows 10 separado (não é o mesmo projeto Lumenva, é infra pessoal) — precisa recriar o agente "WinAdmin".
34	3. Reativar billing do GitHub quando o dono resolver, depois rodar o CI pra confirmar main verde.
35	
36	## Troubleshooting conhecido
37	
38	Em 2026-09-15, o Maestri travou repetidamente ao criar/recriar agentes Codex novos (erro "config/read failed in TUI", preso em "loading"). Diagnóstico: processo do app Maestri.app consumindo CPU alta (50-75%) de forma anormal, não é problema do Codex CLI em si (testado e confirmado: config.toml ok, modelo no cache, nenhum processo Codex travado). Fix que funcionou: fechar e reabrir o app Maestri (Cmd+Q completo, não só fechar janela).
39	
40	## Regra permanente de orquestração (Claude/Lumen CEO)
41	
42	Claude/Lumen nunca executa nada tocando Mac/Linux/GitHub/VPS diretamente — nem leitura. Tudo vai via `maestri ask` pros agentes Codex especializados. Exceção só quando o dono autoriza explicitamente uma investigação pontual (ex: diagnosticar o próprio Maestri travando, quando não há agente disponível pra delegar).