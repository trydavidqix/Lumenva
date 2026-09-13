# Lumenva Virtual Influencer OS — Master Blueprint

**Status:** planejamento arquitetural aprovado para implementação futura  
**Branch:** `plan/ai-creator-commerce-revenue-os-2026-09-13`  
**Regra:** não implementar nem mesclar em `main` sem aprovação explícita.  
**Princípio:** reaproveitar Content OS, Agent OS, Video Composer, Voice, Revenue OS e provider boundaries existentes; não criar runtimes paralelos.

---

## 1. Visão

Criar uma personagem virtual oficial da Lumenva, adulta, latina, AI-native e nômade digital, cuja história é uma versão ficcional, idealizada e feminina da jornada, ambições e estilo de vida do fundador.

Ela não será apresentada como uma pessoa real. Será uma personagem virtual da marca, com identidade, história, mundo, memória, voz, aparência e continuidade próprias.

A narrativa acompanha a construção da vida que ela considera perfeita:

```text
vida/objetivos do fundador
        ↓
Story Engine
        ↓
versão ficcional idealizada
        ↓
personagem virtual
        ↓
história contínua
        ↓
TikTok / Instagram / YouTube
        ↓
comunidade
        ↓
Lumenva / afiliados / produtos / parceiros
        ↓
Revenue OS
        ↓
Learning Loop
```

---

## 2. Personagem canônica

Codename inicial: **Lía Nova**.

Perfil inicial:

- adulta, ~24 anos;
- latina;
- empreendedora;
- viajante;
- AI enthusiast;
- vive e trabalha em um trailer tecnológico;
- constrói uma empresa AI-first;
- publica originalmente em inglês;
- recebe localização/dublagem oficial em PT-PT;
- futuramente ES/FR/DE/IT conforme dados de audiência e receita.

Posicionamento:

> Virtual creator by Lumenva. Building businesses with AI while living on the road.

A personagem nunca deve depender de enganar o público sobre sua natureza artificial.

---

## 3. Premissa narrativa

A série acompanha a seguinte pergunta:

> What happens when you let AI help you build your dream life while travelling the world?

A história mistura:

- viagem;
- AI;
- empreendedorismo;
- lifestyle;
- tecnologia;
- construção em público;
- produtos;
- afiliados;
- crescimento da Lumenva;
- experimentos reais de negócio.

A Lumenva aparece dentro da narrativa como o sistema que administra a empresa dela.

---

## 4. Temporadas

Modelo inicial:

```text
Season 0 — The Build
Season 1 — Portugal
Season 2 — Spain
Season 3 — France
Season 4 — Switzerland
Season 5 — Italy
Season 6 — Germany
...
```

Cada temporada precisa de:

- objetivo;
- problema;
- risco;
- tentativas;
- falhas;
- aprendizado;
- conquista;
- cliffhanger;
- impacto no estado do mundo/personagem.

Não publicar países aleatoriamente. Toda mudança geográfica deve respeitar a timeline.

---

## 5. Primeiro arco: Season 0 — The Build

Lía ainda está em Portugal e decide construir a vida que sempre quis.

Arco:

```text
empresa
↓
AI agents
↓
primeira receita
↓
projeto do trailer
↓
compras
↓
erros
↓
construção
↓
energia solar
↓
internet
↓
AI office
↓
creator studio
↓
trailer pronto
```

Final da temporada:

```text
porta fecha
motor liga
mapa aponta para Espanha
```

---

## 6. Encaixe no Lumenva existente

A nova arquitetura não substitui o Content OS.

Usar:

```text
Lumenva Business OS
        │
        ├ Marketing OS
        ├ Content OS
        ├ Agent OS
        ├ Voice
        ├ Video Composer
        ├ Revenue OS
        └ Virtual Influencer OS (novo domínio sobre os anteriores)
```

O Content OS já possui o workflow canônico:

```text
Descobrir → Decidir → Criar → Aprovar → Publicar → Medir → Aprender
```

E já possui creators de tipo `ai`, perfis, assignments, assets, creative jobs, publication jobs, metrics e learning events.

Lía deve ser modelada como `content_creator.creator_type = 'ai'`.

---

## 7. Reutilização obrigatória

Reutilizar sem criar duplicatas:

- `content_creators`;
- `content_creator_profiles`;
- `content_creator_assignments`;
- `content_assets`;
- `creative_jobs`;
- `creative_job_assets`;
- `distribution_connections`;
- `publication_jobs`;
- `publication_metrics`;
- `content_learning_events`;
- `CreativeProvider`;
- `VideoComposer`;
- `DistributionProvider`;
- `ContentOsProviderRegistry`;
- ComfyUI adapter/worker;
- Postiz adapter/worker;
- `services/video-composer`;
- TTS ports/adapters existentes;
- Agent OS / autonomy / policy / approval / event_log;
- Resource Router/compute routing do Business OS.

---

## 8. Novos bounded contexts

Adicionar apenas as camadas realmente ausentes:

```text
Character OS
World OS
Story Engine
Continuity Engine
Render Router
Localization OS
Product Placement Engine
```

Nenhuma dessas camadas cria um segundo scheduler, event bus, memory runtime, approval system ou source of truth.

---

## 9. Character OS

Responsável por identidade canônica.

Novas entidades propostas:

```text
creator_characters
creator_character_versions
creator_identity_assets
creator_voice_profiles
creator_render_profiles
```

Character Canon inclui:

- nome;
- idade fictícia adulta;
- origem;
- personalidade;
- valores;
- missão;
- vocabulário;
- tom;
- maneirismos;
- aparência;
- cabelo;
- olhos;
- roupas;
- altura/proporções de referência;
- paleta;
- voz;
- expressões;
- limites editoriais;
- disclosures obrigatórios.

Mudanças de identidade exigem nova versão.

---

## 10. Character Genesis

Não gerar Lía do zero em cada vídeo.

Criar um Identity Pack canônico:

```text
front
3/4 left
3/4 right
profile left
profile right
full body
neutral
happy
serious
thinking
indoor
outdoor
day
night
casual
travel
business
```

O pack é a referência para todos os engines.

Google/Nano Banana ou provider equivalente pode ser usado como ferramenta premium de Character Genesis, sempre atrás de provider boundary e sujeito a revalidação de disponibilidade, preço e termos no momento da implementação.

---

## 11. Identity Gate

Cada render de personagem passa por validação antes de publicação.

Verificar:

```text
face similarity
hair
eyes
age continuity
body/proportion continuity
wardrobe continuity
world continuity
trailer continuity
```

Estados:

```text
PASS
RETRY
HUMAN_REVIEW
REJECT
```

---

## 12. World OS

A personagem vive num mundo persistente.

Criar:

```text
creator_worlds
creator_world_assets
creator_locations
creator_world_versions
```

Primeiro world asset principal:

# Lumenva Nomad Lab

Trailer canônico:

```text
exterior front
exterior rear
left side
right side
kitchen
desk
bed
bathroom
storage
server area
solar/battery
network
creator studio
```

O trailer é parte da identidade da marca e não deve mudar aleatoriamente entre episódios.

---

## 13. Digital Twin futuro

Fase posterior:

```text
Blender/digital set
↓
canonical cameras
↓
canonical lighting
↓
reference renders
↓
video/image conditioning
```

Objetivo: aumentar continuidade espacial e reduzir inconsistência de cenário.

---

## 14. Story Engine

Criar `CreatorStoryEngine`.

Entrada:

```text
character canon
world canon
timeline
current state
business state
content opportunities
trends
products
open story loops
revenue goals
```

Saída:

```text
episode
scenes
shots
dialogue
product placements
CTA
continuity deltas
```

---

## 15. Story data model

Adicionar:

```text
creator_story_arcs
creator_episodes
creator_episode_scenes
creator_episode_state
creator_continuity_events
```

Três níveis:

### Canon

Quase imutável:

```text
identity
origin
personality
mission
company
trailer
values
```

### Timeline

```text
country
city
season
episode
major events
```

### Current State

```text
current_country
current_city
current_goal
current_project
current_problem
current_company_state
current_trailer_state
open_loops
relationships
```

---

## 16. Episode Memory

Cada episódio registra:

```text
what_happened
where
when
people
products
decisions
consequences
open_loops
```

O próximo episódio recebe:

```text
previous state
+
open loops
+
new goal
```

Evitar contradições narrativas.

---

## 17. Content Mix

Baseline inicial, sujeito a ajuste por analytics:

```text
story/lifestyle       ~60%
AI/business/build     ~20%
travel/tech           ~10%
commercial            ~10%
```

A personagem não deve parecer uma sequência de anúncios.

---

## 18. Product Placement Engine

Pergunta correta:

> Qual produto faz sentido nesta história?

Não:

> Qual produto paga mais?

O produto deve ter relevância narrativa.

Exemplos:

```text
internet no trailer → connectivity product
trabalho remoto → portable monitor
energia → solar/battery accessory
viagem → travel gear
```

Registrar placements:

```text
creator_product_placements
```

com ligação posterior ao Revenue OS.

---

## 19. Product authenticity

Para produtos reais, preferir composição híbrida:

```text
AI character footage
+
real product footage
+
official product images
+
B-roll
```

Não inventar características, resultados ou experiências de uso que o produto real não possua.

---

## 20. Render Router

Criar `CreatorRenderRouter`.

Entrada:

```text
shot
quality target
character requirement
motion requirement
speech requirement
platform
budget
latency
available providers
license status
```

Saída: provider escolhido.

---

## 21. Quality ladder

```text
LEVEL 0 — still + motion/parallax
LEVEL 1 — portrait/avatar animation
LEVEL 2 — open-source image-to-video
LEVEL 3 — cinematic open model
LEVEL 4 — premium hero-shot provider
```

Usar o menor nível capaz de entregar a qualidade necessária.

---

## 22. Provider strategy

Provider boundaries permanecem substituíveis.

Candidatos a benchmark/revalidação:

```text
Google / premium:
- image/character generation
- storyboard
- hero video shots

ComfyUI / open:
- Wan family
- LTX family
- avatar/talking models
- lip-sync models

VPS:
- FFmpeg
- composition
- subtitles
- metadata
- TTS leve
- queue/orchestration
```

Nenhum modelo entra em produção sem capability, license e compute gates.

---

## 23. Model License Gate

Estados:

```text
APPROVED_COMMERCIAL
INTERNAL_ONLY
REVIEW_REQUIRED
BLOCKED
```

Registrar:

```text
model
version
weights_license
code_license
commercial_status
source
review_date
notes
```

Open source ≠ automaticamente permitido para monetização.

---

## 24. Compute architecture

A VPS não deve carregar diffusion/video pesado.

```text
VPS
= control/orchestration/composition/distribution

GPU worker
= heavy generation

Google/cloud provider
= premium generation
```

VPS roda:

- queues;
- workers;
- story engine;
- translation;
- TTS leve;
- FFmpeg;
- Video Composer;
- Postiz;
- metadata;
- publishing;
- analytics;
- health checks.

---

## 25. Resource Router extension

```text
VIDEO JOB
 ↓
Resource Router
 ↓
┌─────────────┬───────────────┬───────────────┐
│ VPS         │ Cloud/Premium │ GPU Worker    │
│ FFmpeg      │ hero video    │ ComfyUI       │
│ TTS         │ character img │ open models   │
│ metadata    │ storyboard    │ lip sync      │
│ publish     │               │ avatar        │
└─────────────┴───────────────┴───────────────┘
```

---

## 26. Free-first cost policy

Prioridade:

```text
included/free credits
↓
open-source model
↓
cheap provider
↓
premium provider
```

Premium render é reservado para shots que realmente elevam a percepção do conteúdo.

---

## 27. Video Composer V2

Evoluir `services/video-composer`.

Input V2:

```text
episode
character
shot graph
voice
translations
captions
music
B-roll
product assets
platform targets
```

Outputs:

```text
master_16x9.mp4
master_9x16.mp4

tiktok_en.mp4
reel_en.mp4
short_en.mp4

tiktok_ptpt.mp4
reel_ptpt.mp4
short_ptpt.mp4

thumbnail
captions
metadata
```

---

## 28. Shot Graph

Cada vídeo é um grafo de shots, não uma única chamada de geração.

```text
EPISODE
 ├ shot 01
 ├ shot 02
 ├ shot 03
 ├ shot 04
 └ shot 05
```

Cada shot registra:

```text
provider
prompt
reference_assets
seed
camera
duration
dialogue
voice
location
character_state
estimated_cost
actual_cost
```

---

## 29. Cheap-video path

Nem todo shot precisa de vídeo generativo.

Combinar:

```text
high-quality still
+
camera movement
+
depth/parallax
+
motion graphics
+
voice
+
sound design
```

via FFmpeg/Remotion/Video Composer quando isso satisfizer a cena.

---

## 30. Voice OS

Reutilizar os contratos TTS do repo.

Criar:

```text
LIA_VOICE_MASTER
```

Requisitos:

- original;
- não copiar voz de pessoa real;
- versionada;
- emoção e cadência consistentes;
- parâmetros por língua.

---

## 31. English Master

Todo conteúdo nasce em inglês.

```text
Story
 ↓
English Script
 ↓
Lía EN Voice
 ↓
English Master Video
```

Esse é o asset canônico.

---

## 32. Localization OS

Pipeline PT-PT:

```text
English Master
 ↓
Translation Agent
 ↓
PT-PT Localization Agent
 ↓
PT-PT QA
 ↓
Lía PT-PT Voice
 ↓
Lip Sync
 ↓
PT-PT Output
```

Localização, não tradução literal.

Glossary inicial:

```text
cell phone → telemóvel
train → comboio
bus → autocarro
file → ficheiro quando apropriado
```

---

## 33. Multilingual identity

Futuro:

```text
Lía EN
Lía PT-PT
Lía ES
Lía FR
Lía DE
```

Todas devem preservar identidade vocal percebida:

```text
pitch
tempo
energy
personality
pause style
pronunciation profile
```

---

## 34. Lip-sync Router

Lip-sync também é provider-bound.

Criar benchmark para candidatos atuais no implementation gate; não fixar dependência no blueprint.

Seleção por:

```text
quality
commercial license
GPU requirement
speed
identity preservation
language compatibility
```

---

## 35. Distribution

V1:

```text
Content OS
 ↓
Approval
 ↓
publication_job
 ↓
PostizDistributionProvider
 ↓
platform
```

V2:

```text
native TikTok adapter
native YouTube adapter
native Meta adapter
```

Postiz permanece provider substituível, nunca domínio.

---

## 36. Canais

MVP:

```text
TikTok
Instagram Reels
YouTube Shorts
```

Depois:

```text
YouTube long-form
```

Master inglês + localização PT-PT.

---

## 37. Creator Director

Criar um agente permanente:

```text
Creator Director
```

É o showrunner.

Recebe:

```text
brand goals
character state
story state
audience state
revenue goals
content calendar
available compute
```

Decide o próximo trabalho.

Especialistas sob demanda:

```text
Story Writer
Continuity Editor
Trend Researcher
Product Scout
Creative Director
Prompt Director
Video Producer
Localization Editor
Distribution Manager
Analytics Reviewer
```

Não criar dezenas de agentes sempre ligados.

---

## 38. Daily AI loop

Exemplo de rotina, ajustável pelo Shift OS:

```text
metrics
↓
Revenue OS
↓
trend scan
↓
story opportunities
↓
episode planning
↓
script
↓
storyboard
↓
render jobs
↓
QA
↓
publish queue
↓
analytics
```

---

## 39. Learning loops

### Narrative Loop

```text
qual história aumenta retenção e comunidade?
```

### Revenue Loop

```text
qual história gera receita, leads ou vendas?
```

Ambos escrevem `content_learning_events`.

Não otimizar apenas views.

---

## 40. Revenue attribution

Revenue OS relaciona:

```text
creator
episode
video
platform
product
click
sale
commission
Lumenva lead
cost
profit
```

Perguntas futuras:

```text
qual episódio mais vendeu?
qual produto combina melhor com Lía?
qual país converte melhor?
qual idioma gera melhor margem?
qual story arc gera mais leads para Lumenva?
```

---

## 41. Lumenva dentro da narrativa

A própria interface da Lumenva pode aparecer como elemento da história.

Exemplo:

```text
Lía acorda
↓
abre Command Center
↓
3 new clients
€2,400 revenue overnight
6 agents working
1 approval waiting
```

Mensagem narrativa:

> I was asleep. They weren't.

O produto é demonstrado pela história em vez de apenas anunciado.

---

## 42. Compliance metadata

Cada asset/render deve registrar:

```text
ai_generated
engine
model
model_version
reference_assets
rights_source
commercial_rights
disclosure_required
affiliate
sponsor
own_product
```

Nunca ocultar a natureza virtual da personagem.

---

## 43. Approval/risk policy

Usar o risk model existente.

Exemplos:

```text
R0/P0 — research, analytics
R1/P1 — script/storyboard
R2/P2 — render e publicação em fluxos aprovados
R3/P3 — sponsor novo, claim sensível, novo mercado
R4/P4 — identidade legal, contrato, segredo, bypass de policy
```

Nenhuma autonomia pode desativar compliance/disclosure.

---

## 44. UI

Evoluir:

```text
/app/content-os/creators
```

Para um Creator Workspace:

```text
Lía Nova
├ Overview
├ Character
├ Face
├ Voice
├ Wardrobe
├ World
├ Trailer
├ Story
├ Timeline
├ Episodes
├ Products
├ Channels
├ Analytics
└ Revenue
```

---

## 45. MVP

Não começar por volume.

MVP:

```text
1 personagem
1 trailer
1 país
1 voz master
2 idiomas
3 formatos sociais
10–20 episódios piloto
```

Objetivo do MVP:

- provar consistência visual;
- provar consistência narrativa;
- provar pipeline de render;
- provar EN → PT-PT;
- provar publicação;
- provar analytics;
- provar attribution;
- provar custo por vídeo;
- provar learning loop.

---

## 46. Fases de implementação

### Phase 0 — Canonical Audit

Revalidar paths, contratos, providers, branch state, licenses e serviços atuais antes de modificar código.

### Phase 1 — Creator Domain

Adicionar Character Canon, versions, world, story e continuity ligados a `content_creators`.

### Phase 2 — Lía Genesis

Criar Character Bible, identity assets, visual, voz, personalidade, history e trailer V1.

### Phase 3 — Character Lab

Benchmark image/character providers e estabelecer Identity Gate.

### Phase 4 — Render Router

Criar provider-neutral router para premium/open/VPS composition.

### Phase 5 — Open Video Lab

Benchmark modelos open/commercial-safe em GPU apropriada.

### Phase 6 — Voice V2

Aproveitar runtime TTS existente e criar voz oficial EN/PT-PT.

### Phase 7 — Localization OS

EN master → PT-PT localization → voice → lip-sync → QA.

### Phase 8 — World OS

Nomad Lab, countries, locations, persistent assets e continuity.

### Phase 9 — Story Engine

Seasons, arcs, episodes, scenes, state e open loops.

### Phase 10 — Video Composer V2

Shot graph, mixed rendering, captions, audio, aspect variants e platform outputs.

### Phase 11 — Distribution

Postiz V1; native platform adapters conforme prioridade.

### Phase 12 — Revenue

Video → product → click → sale → commission → margin.

### Phase 13 — Autonomy

SHADOW → DRAFT → ASSISTED → AUTO_LOW_RISK por métricas e evidence.

### Phase 14 — Scale

Só avaliar segunda personagem após Lía demonstrar audiência, consistência e receita.

---

## 47. Critérios de aceite

O sistema só é considerado operacional quando:

1. Lía é um creator AI nativo do Content OS;
2. identity assets são versionados;
3. story state persiste entre episódios;
4. mundo/trailer mantêm continuidade;
5. render provider é substituível;
6. licença/commercial gate bloqueia modelo inadequado;
7. Video Composer mistura assets/providers sem tornar nenhum provider source of truth;
8. master inglês gera versão PT-PT auditável;
9. publicação usa o DistributionProvider existente;
10. metrics retornam ao Content OS;
11. Revenue OS liga conteúdo a receita;
12. learning events influenciam episódios futuros;
13. disclosures de IA/comercial não podem ser desativados por agente;
14. nenhum secret chega ao browser ou prompt do agente;
15. todo estado tenant-aware mantém `organization_id` + RLS.

---

## 48. Arquitetura final

```text
                       OWNER
                         │
                      MAESTRI
                         │
                 CREATOR DIRECTOR
                         │
             ┌───────────┼───────────┐
             │           │           │
           STORY      CHARACTER    REVENUE
             │           │           │
             └──────┬────┴────┬──────┘
                    │
                CONTENT OS
                    │
              EPISODE ENGINE
                    │
                SHOT GRAPH
                    │
              RENDER ROUTER
                    │
     ┌──────────────┼────────────────┐
     │              │                │
   PREMIUM        COMFY            VPS
     │              │                │
hero shots       open video       TTS
character img    avatar           FFmpeg
storyboards      lip-sync         Composer
     │              │                │
     └──────────────┼────────────────┘
                    │
             MASTER CONTENT
                    │
             LOCALIZATION OS
                    │
             ┌──────┴──────┐
             │             │
            EN           PT-PT
             │             │
             └──────┬──────┘
                    │
               DISTRIBUTION
          ┌─────────┼──────────┐
          │         │          │
        TikTok   Instagram   YouTube
          │         │          │
          └─────────┼──────────┘
                    │
                 ANALYTICS
                    │
                 REVENUE OS
                    │
               LEARNING LOOP
                    │
               NEXT EPISODE
```

---

## 49. Decisão arquitetural final

Não criar outro projeto de vídeo, outro social manager, outro runtime de agentes ou outro banco.

A personagem será um **Creator AI de primeira classe dentro do Content OS existente**.

As novas capacidades oficiais são:

```text
Character OS
+
World OS
+
Story Engine
+
Continuity Engine
+
Render Router
+
Localization OS
+
Product Placement Engine
```

Tudo conectado a:

```text
Content OS
Agent OS
Video Composer
Voice
Distribution
Revenue OS
Business OS
```

Esse é o caminho canônico para transformar Lía numa personagem de mídia de longo prazo, mascote, influenciadora, apresentadora, vendedora e demonstração viva da própria Lumenva.
