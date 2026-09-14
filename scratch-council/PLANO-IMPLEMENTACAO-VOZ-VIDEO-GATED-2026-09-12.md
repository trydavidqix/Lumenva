# Plano de implementação gated — Voz e Vídeo — 2026-09-12

## NÃO EXECUTAR AINDA

- **Vídeo:** aguardar 1 cliente pagante real; verificar GPU/VRAM de cada modelo por fonte oficial (os números do blueprint são `NOT_PROVEN`); obter aprovação explícita do dono para despesa de GPU VPS.
- **Voz:** aguardar reprodução e correção real do loop da arquitetura atual SIP+Asterisk+Pipecat, no commit `b09243a5`, provadas numa ligação telefónica real.
- **Prioridade:** decisões do dono para MVP (WhatsApp, Resend, jurídico) > corrigir/provar voz atual > Voice Router Wave 11 > Influencer Engine Wave 12.
- **Superfícies:** Mac nunca executa; Cloud só pesquisa/contratos/testes isolados; Linux integra checkout/secrets/providers autorizados; VPS descartável absorve build/stress pesado.
- **Estado deste ficheiro:** backlog documental; não cria infraestrutura, não instala, não recruta e não inicia nenhum blueprint.

As especificações dos dois ficheiros fonte continuam originalmente `NÃO VERIFICADAS`; os gatilhos acima são obrigatórios e precedem qualquer passo técnico.

## 1. Mapeamento decidido pelo conselho

**Multi-Model Runtime + Voice OS → Wave 11 — Unified Integrations.** A ideia é Maestri escolher quem trabalha; Codex, Claude, Gemini CLI e Antigravity usam as próprias sessões; um Lumenva MCP fornece tools; chamadas telefónicas usam Voice Router com OpenAI Live/Gemini Live. Não criar Wave 17.

**AI Influencer Engine → Wave 12 — Marketing + Video.** A ideia é `ideia → roteiro travado → voz → identidade visual → avatar → cenas/b-roll → correção de boca → legendas/logo/música → MP4 vertical`. Não criar Wave 17.

Claims vendor-specific, VRAM, preços, interfaces SIP e interfaces Gemini permanecem `UNVERIFIED` até verificação oficial.

## 2. Blueprint original completo — AI Influencer Engine (Wave 12 backlog)

### Arquitetura e componentes originais

- **Objetivo:** dizer ao Maestri “Cria um Reel de 30 segundos comigo explicando o novo produto da Lumenva” e obter vídeo vertical pronto.
- **Arquitetura híbrida:** Google AI Pro (premium); open-source Hunyuan + SkyReels + Wan + MuseTalk + LatentSync; CX53 como cérebro/controlo/armazenamento/render final; GPU VPS para modelos pesados.
- **Fluxo-mãe:** Você → Maestri → intenção/job → Claude Code → Codex + Media MCP → Google Premium (Nano Banana, Veo 3.1, Flow/Omni) / GPU Worker Open Source (HunyuanVideo, SkyReels V3, Wan 2.2 → MuseTalk/LatentSync) / CX53 Render (FFmpeg, Remotion, storage).
- **CX53:** Maestri, Claude/Codex bridge, Media MCP, FastAPI, Redis, Postgres, fila, FFmpeg, Remotion, download/upload, armazenamento temporário, monitorização, webhooks e scheduler; não gera diffusion pesado.
- **GPU ideal do texto original (`NOT_PROVEN`):** NVIDIA 24 GB (RTX 3090/4090/A5000/A6000); Wan 2.2 TI2V-5B 720p “pelo menos 24 GB”; HunyuanVideo-Avatar 24 GB mínimo e low-VRAM TeaCache/Wan2GP 10 GB; SkyReels V3 `--low_vram`; LatentSync 1.6 ~18 GB; MuseTalk abaixo disso; 24/48/80+ GB como V1/premium/velocidade.
- **Model Router original:** `talking_head→HunyuanVideo-Avatar`; `talking_fast→MuseTalk`; `identity_complex→SkyReels V3`; `cinematic_broll→Wan 2.2`; `premium_google→Veo 3.1/Flow`; `still_image→Nano Banana`; lipsync insuficiente→MuseTalk; premium→LatentSync 1.6.
- **Google image anchors:** `david_master_front`, `david_master_3quarter`, `david_master_profile`, `david_smiling`, `david_serious`, `david_fullbody`, `david_blackshirt`, `david_blazer`.
- **Veo 3.1 claims (`NOT_PROVEN`):** 8s, 720p/1080p/4K, áudio nativo, 9:16/16:9, primeiro+último frame, até 3 referências e extensão.
- **Lanes:** AUTOMATIC LANE open-source; PREMIUM GOOGLE LANE Flow/AI Studio com revisão humana; Gemini API externa tem cobrança separada.
- **HunyuanVideo-Avatar:** imagem + áudio final + emoção → pessoa falando/movimento/expressão/rosto; usos talking_head, product_demo, CEO message, social reel e presentation.
- **SkyReels V3:** Reference-to-Video 14B, Talking Avatar 19B, Extension 14B; 1–4 referências e 9:16 (`NOT_PROVEN`).
- **Wan 2.2:** T2V-A14B, I2V-A14B, TI2V-5B, S2V-14B, Animate-14B; V1 começa TI2V-5B.
- **Boca:** `SCRIPT LOCKED → AUDIO FINAL → AVATAR → LIP SYNC`; nunca texto→vídeo directo no talking head final.
- **MuseTalk 1.5:** `video.mp4 + audio.wav → video_lipsync.mp4`, ~25fps, avatar reutilizável, `bbox_shift` (`NOT_PROVEN`).
- **LatentSync 1.6:** video + áudio locked, 512×512 face, ~18 GB, `inference_steps`/`guidance_scale` (`NOT_PROVEN`).
- **Character Pack:** `characters/david/{character.json,style.json,voice.json,references,anchors,wardrobe,voice}` com front/left/right/smile/fullbody, master PNG, black-shirt/blazer, reference WAV/samples.
- **Script Lock:** `DRAFT → LOCKED`; SHA256(script) + audio hash + job ID.
- **Scene Planner:** Reel 30s em 5 cenas de 5–8s; cada uma com type, duration, character, script_segment, model, ratio e quality.
- **Media MCP:** `character.create/get/update`, `script.create/lock`, `voice.generate/upload`, `image.generate/anchor.create`, `video.generate/extend`, `avatar.generate`, `lipsync.quick/premium`, `scene.render`, `reel.render`, `job.create/status/cancel`, `quality.inspect`, `asset.get`.
- **CLI original:** `lumenva-media character create david`; `script lock script-123`; `avatar generate --character david --audio voice.wav`; `video generate --engine wan --image master.png --prompt "..."`; `lipsync --engine latentsync --video input.mp4 --audio voice.wav`; `reel render --project reel-001`.
- **Stack:** CX53 Ubuntu, Python 3.10/3.11, FastAPI/FastMCP/Typer, Redis, Postgres, FFmpeg, Remotion, Node, Caddy, systemd; GPU Ubuntu/NVIDIA/CUDA/PyTorch/Hunyuan/SkyReels/Wan/MuseTalk/LatentSync.
- **Comunicação:** CX53 → `POST /jobs` → GPU Worker → callback → CX53; GPU não exposta à internet, Tailscale/rede privada.
- **Tabelas:** `characters`, `character_assets`, `scripts`, `voice_assets`, `projects`, `scenes`, `media_jobs`, `media_job_attempts`, `generated_assets`, `quality_checks`, `renders`.
- **Estados:** `QUEUED`, `PREPARING`, `DOWNLOADING`, `GENERATING`, `LIPSYNCING`, `RENDERING`, `VALIDATING`, `COMPLETED`, `FAILED`, `CANCELLED`.
- **Quality Gate:** generated → technical validation → lip-sync → identity → artifact → final render; PASS continua, QUESTIONABLE tenta MuseTalk/LatentSync, FAIL regenera; SyncNet/LatentSync são candidatos (`NOT_PROVEN`).
- **Storage:** CX53 guarda configs/jobs/proxies/outputs recentes; GPU guarda checkpoints/cache/temporários; finais antigos em object storage/archive.

### V1.0–V1.15 — ordem original, com gatilho aplicado

1. **V1.0 Foundation:** repo `lumenva-ai-influencer`, apps/services/adapters/workers/characters/projects/scripts/infra/tests; API, MCP, CLI, Redis/Postgres e job fake ponta-a-ponta.
2. **V1.1 Character Registry:** `character.create/update/list/asset.add/anchor.add`; DAVID_AI com 8–12 fotos, 3 anchors, visual, wardrobe e voz; job usa `character=david`.
3. **V1.2 Script Engine:** `script.create/revise/lock/segment`; texto imutável, hash, versão e segments.
4. **V1.3 Voice Layer:** áudio próprio + TTS plugin opcional; `voice.render`; WAV 48kHz normalizado.
5. **V1.4 MuseTalk primeiro:** instalar antes dos modelos grandes; `lipsync.quick`; input MP4 + voice WAV → output MP4.
6. **V1.5 LatentSync:** `lipsync.premium`, default 1.6/fallback 1.5; router QUICK→MuseTalk, PREMIUM→LatentSync.
7. **V1.6 HunyuanVideo-Avatar:** `avatar.hunyuan.generate` com image/audio/emotion/seed/resolution/duration e metadata/GPU stats; David apresenta Lumenva.
8. **V1.7 Wan 2.2:** TI2V-5B primeiro, `video.wan.text_to_video/image_to_video`; master image + prompt → 5s 720p.
9. **V1.8 SkyReels V3:** Reference-to-Video 14B, depois Talking Avatar 19B; `video.skyreels.reference` com 1–4 imagens.
10. **V1.9 Google Premium Lane:** sem API paga inicialmente; `google_job.create` gera Generation Package; dono executa Flow/AI Studio; `google_job.import` devolve vídeo.
11. **V1.10 Scene Router (AUTO):** regras talking_head→Hunyuan, fast→MuseTalk, references≥2→SkyReels, cinematic→Wan, premium→Google; avaliar lipsync e escolher finalizer.
12. **V1.11 Reel Composer:** Remotion/FFmpeg clips+voice+music+subtitles+branding+transitions+CTA; 1080×1920 H.264/AAC MP4.
13. **V1.12 Quality Engine:** arquivo, áudio, resolução, FPS, duração, black frames, clipping, lip-sync score → `APPROVED/RETRY/MANUAL_REVIEW`.
14. **V1.13 Maestri integration:** `create_influencer_video`, `create_talking_video`, `create_broll`, `fix_lipsync`, `render_reel`, `get_video_status`; script→lock→áudio→cenas→Hunyuan→Wan/SkyReels→lipsync→render→gate→MP4.
15. **V1.14 Observabilidade:** dashboard de job/engine/GPU/VRAM/tempo/custo/falhas/retries/output; explicar por que demorou.
16. **V1.15 Benchmark:** mesma foto/áudio/roteiro/seed/duração em Hunyuan, SkyReels, Wan S2V, MuseTalk, LatentSync; pontuar identity/lipsync/face muscles/body movement/realism/artifacts /10, speed e VRAM; Model Router V2.

**Vertical slice original:** Maestri → Media MCP → script locked → audio → Hunyuan → MuseTalk → FFmpeg → Reel 9:16; depois LatentSync, Wan, SkyReels e Google.

**Definition of Done original:** owner pede vídeo de 20s sem terminal; Maestri planeia/roteiriza/gera/corrige/renderiza/valida e devolve MP4 com rosto consistente, script fiel, boca sincronizada, 9:16, branding, logs, modelo e artefactos.

**Gatilho de execução do vídeo:** nenhuma V1.0–V1.15 pode começar antes de cliente pagante + GPU/VRAM verificado modelo a modelo + aprovação explícita de gasto GPU. A recomendação “Hunyuan + MuseTalk primeiro” só vale depois desses três gates.

## 3. Blueprint original completo — Multi-Model Runtime + Voice OS (Wave 11 extensão)

### Arquitetura e contratos originais

- **Ideia:** Maestri decide; Codex, Claude, Gemini CLI e Antigravity têm sessões próprias; Lumenva MCP único; Voice Router para OpenAI Live/Gemini Live.
- **Arquitetura:** Owner → Maestri → Claude/Codex/Google Runtime → Lumenva MCP → CRM/Memory/Google/GitHub/Infra; telefone → carrier/SIP (Twilio/Asterisk) → Voice Router → OpenAI Live `gpt-live-1`/Gemini Live → Agent Kernel → MCP → CRM/Agenda/Memory.
- **Sessão vs API:** Codex/Claude/Gemini CLI/Antigravity usam sessões; OpenAI Live usa Platform API; Gemini Live usa Developer API. Nunca extrair OAuth/cookies nem transformar assinatura em API.
- **MCP:** `packages/lumenva-mcp/{server,tools,auth,policy,audit,contracts}`; STDIO primeiro, HTTP MCP depois; tools CRM, contacts, leads, calendar, email, memory, voice, github, infrastructure, agents.
- **Tools V1:** `crm.contact.get/search/timeline`, `crm.lead.get/update_stage`, `memory.search/context/write_candidate`, `calendar.availability/events.search/booking.create/update`, `email.search/draft`, `whatsapp.conversation.get`, `voice.session.get/transfer.request/hangup.request`, `agents.status`, `jobs.create/status`, `github.repo.inspect/issue.create`; cada tool recebe tenant, actor, agent, risk_level, correlation_id, evidence.
- **Risk Engine:** R0 leitura; R1 reversível/interna; R2 externa baixa; R3 sensível; R4 crítica/irreversível com dono; exemplos do blueprint preservados.
- **AgentRuntime:** `start/resume/send/cancel/status/usage/capabilities`; adapters em `packages/runtime-adapters/{codex,claude,gemini-cli,antigravity,common}`.
- **Gemini CLI:** Maestri → adapter → CLI oficial → login Google → Google AI Pro; sem `GEMINI_API_KEY`; nova/retoma sessão, JSON, timeout, cancel, quota, erro (`NOT_PROVEN`).
- **Antigravity:** não substitui Gemini CLI; CLI para consulta/análise/segunda opinião/pesquisa/tarefas curtas; Antigravity para tarefas longas/multi-file/shell/browser/multi-agent/skills/MCP; comandos citados `/agents`, `/planning`, `/teamwork`, `/mcp`, `/model`, `/usage` são `NOT_PROVEN`.
- **Runtime/Quota/Session Router:** `Task {type,risk,expected_tokens,latency,tools_required,context_size,priority}` → `ExecutionPlan {runtime,model,host,session,MCP profile,fallback}`; tabelas `runtime_quota_snapshots`, `agent_runtime_sessions`.
- **VoiceProvider:** `createSession/acceptCall/sendContext/transfer/hangup/getTranscript/getMetrics`; providers OpenAI/Gemini em `packages/voice-router`.
- **OpenAI Live (`NOT_PROVEN`):** telefone → carrier/SIP → OpenAI Live → `gpt-live-1` → Agent Kernel; blueprint cita `POST /live/sessions/{session_id}/accept`, confirmar oficialmente.
- **Gemini Live (`NOT_PROVEN`):** Asterisk/Carrier → RTP → Media Bridge → PCM 16kHz → Gemini Live WebSocket; reaproveita Voice Core antigo.
- **Auth:** Gemini CLI login Google separado de Gemini Live Developer API; OpenAI Platform API separada; nunca confundir.
- **Router:** `incoming_call` avalia tenant/idioma/preference/health/latência/custo/quota/capabilities/failover; OpenAI PRIMARY, Gemini SHADOW/A-B.
- **Shadow:** OpenAI fala com cliente; transcrição alimenta Gemini evaluator que não fala; guardar latência, resposta, tool choice, idioma, qualidade e erros.
- **Quality table:** `voice_quality_metrics` com provider/model/language, latências, interruptions, false interruptions, tool calls/failures, handoffs, duration, cost, sentiment e completion.
- **Tools durante chamada:** cliente→Voice Model→Voice Tool Gateway→MCP→`calendar.events.search`→modelo→fala; function calling Gemini é `NOT_PROVEN`.
- **Context/Memory:** resolver tenant/contact e enviar nome, idioma, relação, último contacto, agendamentos, preferências e summary; depois transcript→Memory Extractor→candidate facts→policy→Mem0/Graphiti/Postgres; nunca transcript inteira automaticamente.
- **Handoff/failover:** `voice.request_handoff`; OpenAI SIP transfer/refer, Carrier/Asterisk SIP REFER/bridge, Gemini telephony layer; provider invisível ao Agent OS. Provider cai → nova chamada usa outro; mid-call não troca no V1, mensagem segura + humano.
- **Infra/secrets:** VPS para CRM/MCP HTTP/scheduler/webhook/session registry/routers; Linux para browser/vídeo/jobs/RTP opcional; Mac só sessões/orquestração; Infisical; chaves OpenAI/Gemini/Twilio/SIP separadas por ambiente; CLI sessions nunca na VPS.
- **Tabelas:** `agent_runtime_sessions`, `runtime_quota_snapshots`, `runtime_execution_jobs`, `runtime_execution_events`, `mcp_tool_invocations`, `mcp_tool_approvals`, `voice_sessions`, `voice_provider_events`, `voice_turns`, `voice_tool_calls`, `voice_quality_metrics`, `voice_provider_health`, `voice_provider_configs`; `organization_id` onde fizer sentido.
- **Observabilidade/Office/CLI:** `/command` com runtimes/usage; cada agente mostra Runtime/Fallback/MCP Profile/Host/Session/Status/Current Job; CLI `lumenva` para agents, sessions, runtime status/usage, ask e voice status/calls/providers/inspect.
- **Nunca fazer:** MCP não rouba OAuth Gemini/Codex nem cookies ChatGPT; Router chama CLI oficial baseada em sessão.

### 16 fases originais

0. **Auditoria/runtime inventory:** repo, packages, workers, `lib/voice`, `voice-sip-test`, Asterisk, MCPs, adapters, monitor, Business OS, Infisical; classificar `REUSE/REPLACE/DELETE/KEEP`.
1. **Contracts:** `packages/runtime-contracts/` com AgentRuntime, RuntimeSession/Usage/Capability, McpTool/Invocation e VoiceProvider/Session/Turn/ToolCall.
2. **Lumenva MCP Core:** MCP antes de Gemini/Voice; todos convergem no MCP único.
3. **MCP Policy + Audit:** autenticação, risco, approvals, audit e evidence.
4. **Gemini CLI Adapter:** Student Pro no Maestri, login Google, sem API paga.
5. **Antigravity Adapter:** segundo Google agent runtime, sem substituir Gemini CLI.
6. **Codex/Claude normalization:** interface única com adapters existentes.
7. **Session Registry:** sessões observáveis, `agent_runtime_sessions`.
8. **Quota Router:** snapshots, remaining/reset/confidence/source/checked_at e seleção econômica.
9. **Runtime Router:** Maestri escolhe runtime/model/host/session/MCP/fallback.
10. **VoiceProvider interface:** abstração de voz e `packages/voice-router`.
11. **OpenAI Live:** provider principal, sujeito à verificação SIP/API e ao gatilho da voz atual.
12. **Gemini Live:** provider alternativo, RTP/PCM/WebSocket, sujeito à verificação oficial.
13. **Voice Tools + MCP:** CRM/agenda/memória durante a chamada, approvals e receipts.
14. **Voice QA + Shadow:** 10 chamadas simuladas, 10 interrupções, silêncio, ruído, overlap, tool call, handoff, timeout e disconnect; depois uma chamada real.
15. **Command Center:** UI operacional de runtime, sessão, provider, quota, voice e status.

### Milestones A–E originais

- **A:** “Maestri, pede ao Gemini pra auditar esse código” via Gemini CLI/sessão Google AI Pro, sem API paga.
- **B:** “Maestri, manda Antigravity corrigir este componente” — workspace, Lumenva MCP, edita, testa e devolve evidence.
- **C:** primeiro Voice MVP — telefone → OpenAI Live → Lumenva MCP → Contact 360 → resposta.
- **D:** mesma chamada em Shadow — OpenAI fala; Gemini evaluator corre em paralelo e não fala.
- **E:** Voice Router decide por segmento (PT-PT sales, support, multilingual) usando dados reais.

### Gates e conclusão originais

Nenhuma fase avança sem typecheck, unit, integration, tenant isolation, security/policy tests, audit evidence e rollback path. Voz acrescenta as 10 simulações acima e, antes de LIVE, uma ligação telefónica real; o protótipo anterior falhou por aceitar gate de código sem repetir a conversa real.

Definition of Done: “Maestri, veja o bug da ligação” → analisa incidente/logs/quota, pede Claude/Codex/Gemini/Antigravity conforme papel, escolhe solução, testa, aprova quando necessário e evidencia. Em chamada: Cliente → Voice Router → OpenAI/Gemini → MCP → CRM+memória+agenda no mesmo Business OS.

**Gatilho de execução da voz:** nenhuma fase 0–15, nenhum Milestone A–E e nenhum shadow-mode do novo Router pode começar antes de reproduzir o bug existente, corrigir a causa e provar uma ligação real sem loop em SIP+Asterisk+Pipecat no `b09243a5`. Depois disso, verificar oficialmente SIP OpenAI, interface Gemini e termos Google AI Pro antes de qualquer uso real.

## 4. Ordem final e estados

1. `PRECISA_DONO`: WhatsApp/número, Resend, jurídico/jurisdição e demais decisões que fecham A4.
2. Linux: reproduzir/corrigir/provar a voz atual; isto tem prioridade sobre Voice Router novo.
3. Cloud: preparar contratos, inventário, documentação e pesquisa oficial sem ativar providers; só após gate anterior abrir implementação Wave 11.
4. Após voz provada: Wave 11 fases 0–15, começando MCP/Contracts e mantendo OpenAI primary/Gemini shadow até evidência.
5. Vídeo só depois de cliente pagante, VRAM verificada e gasto GPU aprovado; então V1.0–V1.15 pela vertical Hunyuan + MuseTalk.

Todos os gates conservam `PASS`, `FAIL`, `NOT_EXECUTED`, `NOT_PROVEN` e `BLOCKED_EXTERNAL`. Documentação, código local, task Cloud, HTTP 200, benchmark sintético ou receipt nunca provam produção, provider live, ligação real, GPU disponível, pagamento ou cliente.

**SELF-CHECK:** PASS — veredito e os dois blueprints originais foram lidos; gatilhos e prioridade foram adicionados sem remover os componentes técnicos, V1.0–V1.15, 16 fases, Milestones A–E, tabelas, interfaces, gates e Definition of Done; claims não verificados permanecem marcados; nenhum código, infraestrutura ou agente foi iniciado.
