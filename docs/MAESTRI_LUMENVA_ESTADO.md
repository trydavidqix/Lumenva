[36 lines total]
1	LUMENVA — ESTADO & PENDENCIAS (nota unica; detalhe completo na memoria do Claude)
2	
3	## EM CURSO
4	- Migracao monorepo passos 1-4 VERDE @ 2fcbe87b (gate dos 8 comandos no worker Linux, todos exit 0; pacote DONO d7c5842b). Falta so passos 5-6 (dono) e merge para main (aprovacao).
5	
6	## PRECISA DO DONO (so tu podes)
7	- Passo 5-6 do monorepo: Vercel Root Directory dos 2 projetos + transferir repo p/ org GitHub `lumenva` (ja criada) + reautorizar Vercel. Doc: docs/plans/monorepo-passo5-6-DONO-2026-09-09.md. Eu faco no teu Chrome depois de verde.
8	- DECIDIR: runtime unico dos agentes (Agent OS) ; caminho da voz (Telnyx/Patter vs SIP+Asterisk+open-source).
9	- DINHEIRO: credito Anthropic (trava Agent OS live + Actions) ; billing GitHub Actions ; numero de telefone (voz) ; certificado P12 (assinatura LGPD).
10	
11	## AMANHA / EM BREVE
12	- Codex CLI no worker Linux (+ memoria: MCP agentmemory/mem0). Ver memoria project-todo-codex-no-linux-worker.
13	- Testar Wake-on-LAN do worker (Ethernet, MAC 98:83:89:ca:f0:f4). Senao deixar 24/7.
14	- Agentes 24/7: retomar ~2026-10-08. Recomendacao = Hermes sozinho (nao OpenClaw, nao Paperclip agora).
15	
16	## VEREDITOS DE ESPECIALISTAS (fixos: Batuta=Maestri, Escriba=Memoria)
17	- **Hierarquia de agentes no Maestri (Batuta):** SIM como convencao (roles+notas+nomes), NAO nativa (sem organograma/ACL). Comecar CEO+CTO; CTO tem de ser Codex + Maestro-enabled p/ recrutar. Roles CEO/CTO prontos na memoria (project-maestri-hierarquia-verdito). Paperclip/Hermes = ESPERAR.
18	- **Lumenva Memory OS (Escriba):** FASEAR. V1 minimo = Current-State.md + Open-Loops.md + convencao de nomes + bootstrap; Postgres autoridade; NAO os 5 backends, NAO Gateway, NAO Neo4j (nem cabe na VPS). Detalhe: project-memory-os-verdito.
19	- **Agent Runtime em camadas (Molde):** versao minima, NAO plataforma. Ja temos CLAUDE.md+skills+roles. Fazer so: Constituicao curta partilhada + template de Role + regra 'planning is internal'. NAO pastas novas, NAO L0-L5. Detalhe: project-agent-runtime-verdito.
20	
21	>> CONVERGENCIA das 4 validacoes: fazer 1 V1 pequeno que serve todas — Constituicao curta + template Role + Current-State/Open-Loops + convencao nomes + bootstrap + comecar CEO+CTO. Sem plataformas, sem backends novos. Medir e expandir.
22	>> COUNCIL (llm-council, 2026-09-09): NAO construir a camada de agentes agora — 4/5 conselheiros + 5/5 revisores. So docs/Current-State.md + docs/Open-Loops.md (1h). Prioridade real: arrumar os 4 bloqueios (dinheiro/formularios) + 1 fatia vertical ponta-a-ponta (db:migrate corre, 1 brain real, doc assinado, flags RGPD com consumidores) + matar 1 arquitetura de voz. 1o passo: falar com 10 negocios antes de codigo. Detalhe: project-council-veredito-agent-layer.
23	
24	## AUDITORIAS FEITAS 2026-09-09 (na memoria)
25	- Agent OS/EPIC-13: ~90% feito, bloqueio credito Anthropic.
26	- Voz: 10 pecas, 0 provado ao vivo, 2 arquiteturas concorrentes — decidir 1.
27	- Auditoria geral do inacabado: base grande mas LONGE de pronto. Workflows dos agentes sao casca (graph.ts -> {}), PAdES nao assina, db:migrate = echo TODO, flags RGPD nao provadas, CI off, testes criticos skipped.
28	
29	## REGRAS PERMANENTES (memoria)
30	- Falar reduzido e simples (ADHD).
31	- Claude = SO orquestrador, nunca executa; tudo vai p/ agentes Codex.
32	- Projetos SO no Linux, nada no Mac (Mac = Maestri + Chrome + SSH).
33	- Autonomia de CEO: decidir sem pedir A/B; so devolver o que precisa da conta/2FA/producao do dono.
34	- Subagentes Maestri: sempre --preset Codex, sempre com Task note.
35	- Prospector: planilha Google Sheets unica 1sH5rK8RbY3QqgoHbPrje5z0loZzuYKgkXe9t8mDJzKM, abas por data DD/MM, blocos BR depois PT.
36	- WhatsApp ao dono: via WAHA /api/sendText na VPS — da, nao dizer que nao da.
