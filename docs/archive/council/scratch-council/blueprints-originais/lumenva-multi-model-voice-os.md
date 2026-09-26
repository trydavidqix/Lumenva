# Lumenva Multi-Model Runtime + Voice OS — Blueprint Original (colado pelo dono, 2026-09-12)

> NOTA: Texto original colado pelo dono, gerado por outra IA, NÃO VERIFICADO. Specs de API
> (OpenAI Live/gpt-live-1, Gemini Live, Gemini CLI login) são NOT_PROVEN até confirmação
> oficial. Ver scratch-council/council-2026-09-12/chairman-verdict.md pro veredito e
> gatilhos antes de execução.

Ideia central: Maestri decide quem trabalha. Codex, Claude, Gemini CLI e Antigravity usam
suas próprias sessões. Um único Lumenva MCP dá ferramentas a todos. Para clientes por
telefone, OpenAI Live e Gemini Live ficam atrás de um Voice Router.

## Arquitetura-mãe
Owner → Maestri (CEO/Master Router) → Claude Code / Codex CLI / Google Runtime (Gemini
CLI + Antigravity) → Lumenva MCP (Tool Control Plane) → CRM/Memory/Google/GitHub/Infra.
Camada separada — Customer Runtime: telefone → carrier/SIP (Twilio/Asterisk) → Lumenva
Voice Router → OpenAI Live (gpt-live-1, primary) / Gemini Live (secondary) → Agent Kernel
→ Lumenva MCP → CRM/Agenda/Memory.

## 1. A regra mais importante — sessão vs API
| Runtime | Autenticação | Para quê |
|---|---|---|
| Codex CLI | sessão ChatGPT/Codex | engenharia/agentes |
| Claude Code | sessão Claude | engenharia/orquestração |
| Gemini CLI | login Google | agentes/engenharia |
| Antigravity | login Google | agentes/engenharia |
| OpenAI Live | API Platform | chamadas de clientes |
| Gemini Live | Gemini Developer API | chamadas de clientes |

SESSÃO = agentes trabalhando. API = produto atendendo cliente. Nunca extrair OAuth
escondido, reutilizar cookies ou transformar assinatura em API.

## 2. Lumenva MCP — coração do sistema
Um único `packages/lumenva-mcp/` usado por Codex, Claude, Gemini CLI, Antigravity (STDIO
primeiro, depois HTTP MCP pra runtimes remotos). Estrutura: server/ (stdio, http),
tools/ (crm, contacts, leads, calendar, email, memory, voice, github, infrastructure,
agents), auth/, policy/, audit/, contracts/.

## 3. Catálogo canônico de tools (V1, ~20 tools)
```
CRM: crm.contact.get/search/timeline, crm.lead.get/update_stage
MEMORY: memory.search/context/write_candidate
AGENDA: calendar.availability, calendar.events.search, calendar.booking.create/update
COMMUNICATION: email.search/draft, whatsapp.conversation.get
VOICE: voice.session.get, voice.transfer.request, voice.hangup.request
BUSINESS OS: agents.status, jobs.create/status
DEV: github.repo.inspect, github.issue.create
```
Cada tool recebe: tenant, actor, agent, risk_level, correlation_id, evidence.

## 4. Risk Engine (R0-R4)
R0 = leitura (executa direto). R1 = ação reversível/interna. R2 = ação externa de baixo
impacto → policy. R3 = ação sensível → policy. R4 = crítica/irreversível → aprovação do
dono. Exemplo: crm.contact.search=R0; calendar.booking.create=R2/policy;
voice.transfer=R2/policy; deletar cliente=R3/R4/aprovação; mudar segurança=R4/owner.

## 5. Session Runtime
`packages/runtime-adapters/{codex,claude,gemini-cli,antigravity,common}/`. Interface
única `AgentRuntime`: start/resume/send/cancel/status/usage/capabilities. Maestri chama
`runtime.send({runtime: "gemini"|"codex", task})` sem conhecer detalhes de cada CLI.

## 6. Gemini CLI Adapter
Fluxo: Maestri → GeminiRuntimeAdapter → Gemini CLI oficial → Login Google → Google AI Pro.
Não usa `GEMINI_API_KEY` nesse modo. Adapter precisa saber: nova sessão, retomar sessão,
enviar prompt, receber JSON, timeout, cancelar, quota, erro. Texto original cita login por
conta Google como método oficial e limites maiores pra AI Pro (fonte não verificada nesta
sessão).

## 7. Antigravity Adapter
Não substitui Gemini CLI — usa cada um pra uma função. Gemini CLI: consulta, análise,
segunda opinião, pesquisa, tarefas curtas. Antigravity: tarefas longas, programação
autônoma, multi-file, shell, browser, multi-agent, skills, MCP (`/agents`, `/planning`,
`/teamwork`, `/mcp`, `/model`, `/usage`, texto original, não verificado).

## 8. Codex + Claude continuam
Equipe passa a ser: MAESTRI (CEO/dispatcher), CLAUDE (arquitetura/planejamento/
coordenação), CODEX (engenharia pesada/testes/correções), ANTIGRAVITY (2º engenheiro/
autonomia), GEMINI CLI (research/review/2ª opinião), HERMES (aprendizagem/memória).

## 9. Model/Runtime Router
`packages/runtime-router/`. Entrada: Task {type, risk, expected_tokens, latency,
tools_required, context_size, priority}. Saída: ExecutionPlan {runtime, model, host,
session, MCP profile, fallback}. Exemplos: "auditar 200 arquivos"→Codex High/Linux;
"segunda opinião de arquitetura"→Gemini CLI/Student Pro; "construir página"→Antigravity;
"decidir arquitetura"→Claude.

## 10. Quota Router
Tabela `runtime_quota_snapshots` (provider, runtime, account, quota_type, remaining,
reset_at, confidence, source, checked_at). Evita gastar o runtime errado.

## 11. Session Registry
Tabela `agent_runtime_sessions` (id, provider, runtime, external_session_id, agent_id,
project, branch, host, status, started_at, last_activity_at, token_estimate, metadata).

## 12. Voice — subsistema separado
`packages/voice-router/`. Interface `VoiceProvider`: createSession/acceptCall/
sendContext/transfer/hangup/getTranscript/getMetrics. Providers: OpenAILiveProvider,
GeminiLiveProvider.

## 13. OpenAI Live Provider [NOT_PROVEN]
Fluxo: telefone → Carrier/SIP → OpenAI Live → gpt-live-1 → Agent Kernel. Texto original
cita `POST /live/sessions/{session_id}/accept` configurando gpt-live-1 pra aceitar
chamadas SIP diretamente (fonte não verificada nesta sessão — CONFIRMAR antes de
qualquer implementação).

## 14. Gemini Live Provider [NOT_PROVEN]
Fluxo diferente: telefone → Asterisk/Carrier → RTP → Media Bridge → PCM 16kHz → Gemini
Live WebSocket. Texto original cita PCM 16-bit 16kHz e WebSocket stateful (fonte não
verificada). Reaproveitaria o Voice Core antigo (Asterisk, ARI, SIP, RTP Media Bridge) —
ver [[project_voz_estado_geral]].

## 15. Separação de autenticação da voz
Gemini CLI → login Google → Student Pro. Gemini Live → Gemini Developer API → API auth
(API key ou token efêmero, segundo o texto original). Nunca confundir os dois.

## 16. Voice Router
Entrada: incoming_call. Avalia tenant/idioma/provider preference/health/latência/custo/
quota/capabilities/failover. Início: OpenAI = PRIMARY, Gemini = SHADOW/A-B.

## 17. Shadow Mode da voz
Cliente ↔ OpenAI Live (resposta real) EM PARALELO transcrição → Gemini (resposta
hipotética, não fala). Guarda latência/resposta/tool choice/idioma/qualidade/erros. Só
depois aumenta gradualmente % de tráfego real pro Gemini.

## 18. Voice Quality Engine
Tabela `voice_quality_metrics`: provider, model, language, latency_first_audio_ms,
turn_latency_ms, interruptions, false_interruptions, tool_calls, tool_failures,
handoffs, call_duration, estimated_cost, customer_sentiment, completion_state.

## 19. Tool calling durante a ligação
Cliente pergunta → Voice Model → Tool request → Voice Tool Gateway → Lumenva MCP →
calendar.events.search → resultado → Voice Model → fala. Gemini Live suporta function
calling durante a sessão (texto original, fonte não verificada).

## 20. Context Builder
Telefone → resolve tenant → resolve contact → Context Builder retorna só: nome, idioma,
relação com empresa, último contato, agendamentos relevantes, preferências, summary — não
manda histórico inteiro (reduz tokens/latência/vazamento/confusão).

## 21. Memory
Durante ligação: Contact 360 + Recent Memory + Relevant Facts → Voice Context. Depois:
transcript → Memory Extractor → candidate facts → policy → Mem0/Graphiti/Postgres. Nunca
transcrição inteira virando memória permanente automática.

## 22. Human Handoff
Contrato único `voice.request_handoff()`. Voice Router decide implementação (OpenAI: SIP
transfer/refer; Carrier/Asterisk: SIP REFER/bridge; Gemini: telephony layer próprio).
Agent OS sempre vê `handoff.request()` — provider invisível.

## 23. Failover
Se OpenAI cair → nova chamada usa Gemini Live. Se Gemini cair → OpenAI. Durante chamada já
ativa, NÃO trocar modelo automaticamente no V1 — melhor: erro fatal do provider → mensagem
segura → handoff humano. Switch mid-call fica pra fase posterior.

## 24. Infra
VPS: CRM, MCP HTTP gateway, scheduler, voice webhook, session registry, routers leves.
Linux compute: browser automation, vídeo, jobs pesados, RTP opcional. Mac: Codex, Claude,
Gemini CLI, Antigravity, MCP STDIO. Cloud APIs: OpenAI, Google.

## 25. Segredos
Infisical, nunca no MCP config. Separação OPENAI_API_KEY/GEMINI_API_KEY/TWILIO/SIP por
dev/staging/prod. Sessões pessoais de CLI nunca vão pra VPS.

## 26. Database (novas tabelas propostas)
agent_runtime_sessions, runtime_quota_snapshots, runtime_execution_jobs,
runtime_execution_events, mcp_tool_invocations, mcp_tool_approvals, voice_sessions,
voice_provider_events, voice_turns, voice_tool_calls, voice_quality_metrics,
voice_provider_health, voice_provider_configs. Todas com organization_id onde fizer
sentido.

## 27-29. Observabilidade / Agent Office / CLI Lumenva
Dashboard `/command` com status de runtime (Claude/Codex/Gemini CLI/Antigravity/OpenAI
Live/Gemini Live) e uso de sessão em barras. Cada agente mostra Runtime/Fallback/MCP
Profile/Host/Session/Status/Current Job. CLI unificada `lumenva` (agents, sessions,
runtime status/usage, ask codex/gemini/claude/antigravity, voice status/calls/providers/
inspect).

## 30. Nunca fazer
Nunca: MCP roubar token OAuth Gemini; MCP roubar token Codex; MCP reutilizar cookie
ChatGPT. Router sempre chama a CLI oficial baseada em sessão.

## 31. Fases de implementação (texto original, 16 fases)
| Fase | Implementação | Resultado |
|---|---|---|
| 0 | Auditoria/runtime inventory | fotografia real do repo |
| 1 | Contracts | interfaces canônicas |
| 2 | Lumenva MCP Core | tools compartilhadas |
| 3 | MCP Policy + Audit | segurança |
| 4 | Gemini CLI Adapter | Student Pro no Maestri |
| 5 | Antigravity Adapter | Google agent runtime |
| 6 | Codex/Claude normalization | interface única |
| 7 | Session Registry | sessões observáveis |
| 8 | Quota Router | limites/custos |
| 9 | Runtime Router | Maestri escolhe runtime |
| 10 | VoiceProvider interface | abstração voz |
| 11 | OpenAI Live | provider principal |
| 12 | Gemini Live | provider alternativo |
| 13 | Voice Tools + MCP | CRM durante chamada |
| 14 | Voice QA + Shadow | comparação real |
| 15 | Command Center | UI operacional |

## 32. Fase 0 — Auditoria (primeira coisa a fazer, texto original)
Auditar: apps/crm, packages, workers, lib/voice, voice-sip-test, Asterisk, MCPs atuais,
Maestri adapters, session monitor, Business OS, Infisical. Objetivo: REUSE/REPLACE/
DELETE/KEEP — especialmente porque já existe muito código de voz que não deve ser
duplicado.

## 33. Fase 1 — Contract First
`packages/runtime-contracts/`: AgentRuntime, RuntimeSession, RuntimeUsage,
RuntimeCapability, McpTool, McpInvocation, VoiceProvider, VoiceSession, VoiceTurn,
VoiceToolCall. Sem providers ainda.

## 34-39. Fase 2 (MCP primeiro) e Milestones A-E
Fase 2: MCP antes de Gemini/Voice etc — Codex/Claude/Gemini/Antigravity/OpenAI Voice/
Gemini Voice todos convergem no Lumenva MCP único.
- Milestone A: "Maestri, pede ao Gemini pra auditar esse código" via Gemini CLI/sessão
  Google AI Pro, sem API paga.
- Milestone B: "Maestri, manda Antigravity corrigir esse componente" — abre workspace,
  usa Lumenva MCP, edita, testa, devolve evidência.
- Milestone C: primeiro Voice MVP — telefone → OpenAI Live → Lumenva MCP → Contact 360 →
  responde cliente.
- Milestone D: mesma chamada em Shadow (OpenAI Live → cliente; Gemini evaluator em
  paralelo, não fala).
- Milestone E: Voice Router decide automaticamente por segmento (PT-PT sales, support,
  multilingual) baseado em dados reais.

## 40. Gates
Nenhuma fase avança sem: typecheck, unit tests, integration tests, tenant isolation,
security tests, policy tests, audit evidence, rollback path. Voz adiciona: 10 chamadas
simuladas, 10 interrupções, silêncio, ruído, fala sobreposta, tool call, handoff, provider
timeout, provider disconnect — e antes de LIVE, uma chamada telefônica real (o erro do
protótipo anterior foi aceitar gate de código sem validar a conversa real de novo).

## 41. Critério de conclusão (texto original)
"Maestri, veja o bug da ligação" → Maestri analisa incidente, consulta logs/quota, pede
Claude(arquitetura)/Codex(código)/Gemini(2ª opinião)/Antigravity(teste), escolhe solução,
executa testes, pede aprovação se necessário, produz evidência. Durante uma chamada:
Cliente → Voice Router → OpenAI/Gemini → Lumenva MCP → CRM+memória+agenda, tudo no mesmo
Business OS.

## Recomendação de ordem do autor original
Primeiro Lumenva MCP, depois Gemini CLI/Antigravity usando o Student Pro, depois Runtime
Router, e só então reconstruir a ligação sobre OpenAI Live + Gemini Live — pra que a voz
já nasça usando o mesmo sistema de tools/memória/segurança/agentes do Business OS, em vez
de virar mais um projeto paralelo.
