# Lumenva AI Influencer Engine — Blueprint Original (colado pelo dono, 2026-09-12)

> NOTA: Este é o texto original colado pelo dono, gerado por outra IA, NÃO VERIFICADO.
> Todas as especificações técnicas (VRAM, specs de modelo, preços) são NOT_PROVEN até
> confirmação por fonte oficial. Ver scratch-council/council-2026-09-12/chairman-verdict.md
> para o veredito do conselho e os gatilhos antes de qualquer execução.

## Objetivo

Criar um sistema em que se possa dizer ao Maestri: "Cria um Reel de 30 segundos comigo
explicando o novo produto da Lumenva." E o sistema faça:

ideia → roteiro travado → voz → identidade visual → avatar falando → cenas/b-roll →
correção de boca → legendas/logo/música → MP4 vertical pronto

Arquitetura híbrida:
- GOOGLE AI PRO = camada premium já incluída no plano
- OPEN-SOURCE = Hunyuan + SkyReels + Wan + MuseTalk + LatentSync
- CX53 = cérebro / controle / armazenamento / render final
- GPU VPS = execução dos modelos pesados

## PARTE 1 — MASTER BLUEPRINT

### 1. Arquitetura-mãe
Você → Maestri (CEO) → intenção/job → Claude Code (Orchestrator) → Codex (engenharia) +
Media MCP (execução de mídia) → Google Premium (Nano Banana, Veo 3.1, Flow/Omni) / GPU
Worker Open Source (HunyuanVideo, SkyReels V3, Wan 2.2 → MuseTalk/LatentSync) / CX53
Render (FFmpeg, Remotion, storage).

Responsabilidades: Maestri decide o que produzir; Claude Code transforma intenção em
pipeline e tarefas; Codex implementa/corrige/testa/mantém código e adapters; Media MCP é
a interface única para todos os modelos; CX53 fica ligada 24/7 controlando jobs; GPU
Worker existe para inferência pesada.

### 2. Por que a CX53 continua importante
Excelente para: Maestri, Claude/Codex bridge, Media MCP, FastAPI, Redis, Postgres, fila de
jobs, FFmpeg, Remotion, download/upload, armazenamento temporário, monitoramento,
webhooks, logs, scheduler. Não precisa gerar o diffusion pesado — GPU fica separada.

### 3. GPU ideal [NOT_PROVEN — verificar antes de qualquer compra]
V1 recomendada: NVIDIA GPU 24 GB VRAM (RTX 3090/4090/A5000/A6000).
- Wan 2.2 TI2V-5B: geração 720p, exige "pelo menos 24 GB" segundo o texto original (fonte:
  github.com, não verificada nesta sessão).
- HunyuanVideo-Avatar: 24 GB mínimo oficial (704px/129 frames), integração low-VRAM com
  TeaCache/Wan2GP chegando a 10 GB (fonte: github.com, não verificada).
- SkyReels V3: modo `--low_vram` para GPUs abaixo de 24 GB (FP8 + block offload).
- LatentSync 1.6: ~18 GB pra inferência; MuseTalk muito abaixo disso.
Escalonamento: 24GB = V1 funcional; 48GB = V1 premium; 80GB+ = modelos grandes/velocidade máxima.

### 4. Model Router
```
scene.type = talking_head        → HunyuanVideo-Avatar
scene.type = talking_fast        → MuseTalk
scene.type = identity_complex    → SkyReels V3
scene.type = cinematic_broll     → Wan 2.2
scene.type = premium_google      → Veo 3.1 / Flow
scene.type = still_image         → Nano Banana
quality.lipsync = insufficient   → MuseTalk
quality.lipsync = premium_required → LatentSync 1.6
```

### 5. Google AI Pro — camada de imagem
Nano Banana 2 / Nano Banana Pro. Bom desempenho documentado com múltiplas imagens de
referência e consistência (fonte: ai.google.dev, não verificada). Cria anchors:
david_master_front, david_master_3quarter, david_master_profile, david_smiling,
david_serious, david_fullbody, david_blackshirt, david_blazer.

### 6. Google para vídeo premium — Veo 3.1
Suporta (texto original, NOT_PROVEN): 8 segundos, 720p/1080p/4K, áudio nativo, 9:16/16:9,
primeiro+último frame, até 3 imagens de referência, extensão de vídeo.

### 7. Limite importante do Google Pro
Google AI Studio/Flow → benefícios da assinatura. Gemini API externa → cobrança separada
(texto original cita ai.google.dev). V1 terá duas lanes: AUTOMATIC LANE (open-source) e
PREMIUM GOOGLE LANE (Flow/AI Studio, revisão humana/studio workflow).

### 8. HunyuanVideo-Avatar
Motor principal pra "você falando". Entrada: imagem + áudio final + emoção. Saída: pessoa
falando, movimento, expressão, rosto consistente. Projetado para animação guiada por
áudio, controle emocional e diálogo multi-personagem (fonte github.com, não verificada).
Uso: talking_head, product_demo, CEO message, social reel, presentation.

### 9. SkyReels V3
Reference-to-Video 14B, Talking Avatar 19B, Video Extension 14B. Aceita 1–4 imagens de
referência, suporta 9:16 (fonte github.com, não verificada).

### 10. Wan 2.2
T2V-A14B, I2V-A14B, TI2V-5B, S2V-14B, Animate-14B. Para V1: Wan2.2 TI2V-5B (T2V + I2V +
720p + 24fps + 24GB VRAM, segundo o texto original).

### 11. Boca e músculos faciais
Nunca fazer texto→vídeo direto pro talking head final. Fluxo: SCRIPT LOCKED → AUDIO FINAL
→ AVATAR → LIP SYNC. O áudio determina a boca.

### 12. MuseTalk 1.5 — lip-sync rápido
Entrada: video.mp4 + audio.wav. Saída: video_lipsync.mp4. Recomendação do projeto:
MuseTalk 1.5, ~25fps, permite preparar avatar uma vez pra reutilização. `bbox_shift`
influencia a abertura da boca (fonte github.com, não verificada).

### 13. LatentSync 1.6 — finalizer premium da boca
Pipeline: video + audio locked → LatentSync → lip sync final. Versão 1.6: 512×512 face
processing, 18GB VRAM mínimo (fonte github.com, não verificada). Ajustar
`inference_steps`/`guidance_scale`.

### 14. Character Pack
```
characters/david/
  character.json, style.json, voice.json
  references/ (front, left, right, smile, fullbody .jpg)
  anchors/ (master-01/02/03 .png)
  wardrobe/ (black-shirt, blazer .png)
  voice/ (reference.wav, samples/)
```

### 15. Script Lock
script.status = DRAFT → LOCKED após aprovação. A partir daí: SHA256(script) + audio hash +
job ID ficam associados — rastreável, evita roteiro A + áudio B + boca C.

### 16. Scene Planner
Reel de 30s vira várias cenas curtas (ex: 5 cenas de 5-8s cada), cada uma com type,
duration, character, script_segment, model, ratio, quality.

### 17. Media MCP — interface estável
```
character.create/get/update, script.create/lock, voice.generate/upload,
image.generate/anchor.create, video.generate/extend, avatar.generate,
lipsync.quick/premium, scene.render, reel.render, job.create/status/cancel,
quality.inspect, asset.get
```
Maestri nunca precisa saber qual Python/CUDA/repo/modelo/checkpoint — só chama a tool.

### 18. CLI
```
lumenva-media character create david
lumenva-media script lock script-123
lumenva-media avatar generate --character david --audio voice.wav
lumenva-media video generate --engine wan --image master.png --prompt "..."
lumenva-media lipsync --engine latentsync --video input.mp4 --audio voice.wav
lumenva-media reel render --project reel-001
```

### 19. Stack técnica
CX53: Ubuntu, Python 3.10/3.11, FastAPI, FastMCP, Typer, Redis, Postgres, FFmpeg,
Remotion, Node.js, Caddy, systemd.
GPU Worker: Ubuntu, NVIDIA drivers, CUDA, PyTorch, HunyuanVideo-Avatar, SkyReels-V3,
Wan2.2, MuseTalk, LatentSync.

### 20. Comunicação CX53 ↔ GPU
Não expor GPU à internet — usar Tailscale/rede privada. Fluxo: CX53 → POST /jobs → GPU
Worker → callback → CX53.

### 21. Dados (Postgres)
characters, character_assets, scripts, voice_assets, projects, scenes, media_jobs,
media_job_attempts, generated_assets, quality_checks, renders.

### 22. Estados do job
QUEUED, PREPARING, DOWNLOADING, GENERATING, LIPSYNCING, RENDERING, VALIDATING, COMPLETED,
FAILED, CANCELLED.

### 23. Quality Gate
generated → technical validation → lip-sync check → identity check → artifact check →
final render. Lip-sync: aproveitar SyncNet/avaliação do LatentSync. PASS → continua;
QUESTIONABLE → MuseTalk/LatentSync; FAIL → regera.

### 24. Storage
Não colocar checkpoints todos na CX53 (configs/jobs/proxies/outputs recentes só). GPU:
checkpoints/cache/temporários. Arquivos finais antigos: object storage ou archive
separado.

## PARTE 2 — IMPLEMENTAÇÃO V1 (ordem original do blueprint)

- **V1.0 — Foundation:** repositório `lumenva-ai-influencer`, estrutura apps/services/
  adapters/workers/characters/projects/scripts/infra/tests. Aceite: API responde, MCP
  aparece no Claude/Maestri, CLI funciona, Redis/Postgres funcionam, job fake completa
  ponta-a-ponta.
- **V1.1 — Character Registry:** character.create/update/list/asset.add/anchor.add.
  Primeiro personagem DAVID_AI (8-12 fotos reais, 3 anchors, perfil visual, wardrobe, voz
  de referência). Aceite: job pede `character=david` sem conhecer caminhos de arquivo.
- **V1.2 — Script Engine:** script.create/revise/lock/segment. Ao bloquear: texto imutável
  + hash + versão + segments. Aceite: roteiro bloqueado não muda silenciosamente.
- **V1.3 — Voice Layer:** upload de áudio próprio + TTS plugin opcional (não travar V1 num
  único TTS). Interface `voice.render`. Saída: WAV 48kHz normalizado.
- **V1.4 — MuseTalk primeiro:** instalar antes dos modelos gigantes (valida MCP/GPU/audio/
  video/face/lipsync/FFmpeg/storage sem exigir modelo monstruoso). `lipsync.quick`. Aceite:
  input.mp4 + voice.wav → output_lipsync.mp4.
- **V1.5 — LatentSync:** `lipsync.premium`, default LatentSync 1.6, fallback 1.5 (~8GB vs
  ~18GB). Aceite: router escolhe automaticamente QUICK→MuseTalk, PREMIUM→LatentSync 1.6.
- **V1.6 — HunyuanVideo-Avatar:** adapter `avatar.hunyuan.generate` (character image,
  audio, emotion, seed, resolution, duration → video, metadata, generation time, GPU
  stats). Aceite: "David apresentando a Lumenva" gera talking head controlado por áudio.
- **V1.7 — Wan 2.2:** instalar TI2V-5B primeiro (não o 14B). `video.wan.text_to_video` /
  `image_to_video`. Aceite: master image + prompt → 5s 720p.
- **V1.8 — SkyReels V3:** Reference-to-Video 14B primeiro, depois Talking Avatar 19B.
  `video.skyreels.reference` (1-4 imagens). Aceite: mesmo rosto+roupa+produto+cenário num
  vídeo coerente.
- **V1.9 — Google Premium Lane:** não misturar API paga inicialmente. `google_job.create`
  produz um Generation Package (prompt, references, ratio, duration, model recommendation,
  scene description) que o dono executa manualmente no Flow/AI Studio, depois
  `google_job.import` traz o vídeo de volta ao pipeline.
- **V1.10 — Scene Router (AUTO):** regras condicionais talking_head→Hunyuan,
  talking_head+fast→MuseTalk, references>=2→SkyReels, cinematic→Wan, premium→Google Flow
  job; após geração avalia lipsync e escolhe MuseTalk/LatentSync conforme qualidade.
- **V1.11 — Reel Composer:** Remotion/FFmpeg juntando clips+voice+music+subtitles+branding
  Lumenva+transitions+CTA. Output: 1080×1920 H.264/AAC MP4.
- **V1.12 — Quality Engine:** checks de arquivo válido, áudio presente, resolução, FPS,
  duração, black frames, clipping, lip-sync score → APPROVED/RETRY/MANUAL_REVIEW.
- **V1.13 — Maestri integration:** tools `create_influencer_video`, `create_talking_video`,
  `create_broll`, `fix_lipsync`, `render_reel`, `get_video_status`. Fluxo completo: script
  → lock → áudio → cenas → talking heads (Hunyuan) → b-roll (Wan/SkyReels) → lipsync →
  render → Quality Gate → MP4.
- **V1.14 — Observabilidade:** dashboard job/engine/GPU/VRAM/tempo/custo/falhas/retries/
  output. Maestri consegue perguntar "por que esse vídeo demorou?" e receber resposta
  detalhada.
- **V1.15 — Benchmark:** mesma foto/áudio/roteiro/seed/duração rodada em Hunyuan, SkyReels,
  Wan S2V, MuseTalk, LatentSync — pontuar identity/lipsync/face muscles/body movement/
  realism/artifacts /10 cada, mais speed e VRAM. Vira o Model Router V2.

## Primeiro MVP (vertical slice recomendada pelo autor do blueprint)
Maestri → Media MCP → script locked → audio → HunyuanVideo-Avatar → MuseTalk → FFmpeg →
Reel 9:16. Depois: + LatentSync + Wan + SkyReels + Google Premium Lane.

## Definition of Done da V1 (texto original)
Dono manda "Cria um vídeo meu de 20 segundos falando sobre a Lumenva" sem abrir terminal.
Maestri recebe → planeja → roteiriza → gera → corrige → renderiza → valida → devolve
final.mp4 com rosto consistente, fala igual ao script, boca sincronizada, formato 9:16,
branding Lumenva, logs do job, modelo usado, artefatos guardados.

## Recomendação de ordem do autor original
Não instalar os 5 modelos ao mesmo tempo. Primeiro fechar a vertical completa com
Hunyuan + MuseTalk (prova Maestri→MCP→GPU→áudio→boca→render). Depois encaixar LatentSync,
Wan, SkyReels e por fim a lane premium do Google, sem desmontar nada.
