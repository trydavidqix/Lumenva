# Spec 17 — Content OS

> **Estado:** arquitectura aprovada para planeamento e implementação incremental.
> **Âmbito:** Content Operations OS da Lumenva, inicialmente para operação interna e preparado desde a origem para SaaS multi-tenant.
> **Fonte da verdade:** PostgreSQL/Supabase do CRM. Engines externos são serviços substituíveis atrás de adapters.
> **Precedência:** `CLAUDE.md` > `docs/specs/` > `docs/prd/` > handoffs/README.

---

## 1. Decisão de produto

O Content OS é o sistema operacional de conteúdo da Lumenva. A unidade central não é uma ferramenta isolada de geração de posts, mas um workflow completo:

**Descobrir → Decidir → Criar → Aprovar → Publicar → Medir → Aprender.**

A plataforma deve cobrir, na mesma experiência:

1. dashboard operacional;
2. criação de conteúdo;
3. central de criadores;
4. radar de concorrentes;
5. radar de notícias;
6. central de roteiros;
7. banco de hooks;
8. criação e gestão de imagem/vídeo;
9. superfície mobile responsiva;
10. Brand Brain e AI Operator como camadas transversais.

O Content OS não será construído em cima da base de dados, UI ou domínio de nenhum fornecedor externo. O CRM/Postgres continua a ser a fonte da verdade.

---

## 2. Princípios arquitecturais fechados

### 2.1 Source of truth

PostgreSQL/Supabase é a autoridade para:

- organização/tenant;
- campanhas;
- oportunidades;
- ideias;
- conteúdos;
- hooks;
- roteiros;
- criadores;
- assets;
- aprovações;
- publicações;
- métricas normalizadas;
- learning signals;
- jobs e estados de negócio.

Nenhum engine externo pode tornar-se a única fonte de um estado que o produto precisa de recuperar, auditar ou reconstruir.

### 2.2 Memória e knowledge graph

Decisões já aprovadas mantêm-se:

- PostgreSQL é a fonte de verdade;
- Mem0 self-hosted, quando introduzido, é projecção derivada e entra por `shadow → canary → on`;
- baseline/evals vêm antes da activação de memória derivada;
- Graphiti/FalkorDB pode ser usado como projecção de knowledge graph, nunca como autoridade transaccional;
- LlamaIndex permanece opcional e fora do hot path;
- n8n é adapter de automações/webhooks existentes, não orchestrator central do Content OS;
- LangGraph só entra quando existir um workflow real que justifique estado agentic explícito;
- qualquer projecção derivada precisa de replay/rebuild.

### 2.3 Provider boundaries

Todas as integrações externas entram por interfaces próprias. Código de domínio não pode importar directamente Postiz, RSSHub, changedetection.io, ComfyUI ou MoneyPrinterTurbo.

### 2.4 Browser nunca fala com engines

Fluxo obrigatório:

```text
Browser / Mobile
        │
        ▼
Content OS API
        │
        ├── auth + RBAC + tenant
        ├── rate limit
        ├── idempotência
        ├── audit
        └── provider adapters
                │
                ▼
          serviços privados
```

Postiz, RSSHub, changedetection.io, ComfyUI, Video Composer, Redis e bases auxiliares não são superfícies públicas do produto.

---

## 3. Engines aprovados e papel de cada um

| Engine | Decisão | Boundary | Papel |
|---|---|---|---|
| **Postiz** | aprovado | `DistributionProvider` | conexão social, OAuth, agendamento, publicação e estado remoto |
| **RSSHub** | aprovado | `IntelligenceProvider` | ingestão de fontes, feeds e sinais públicos |
| **changedetection.io** | aprovado condicionalmente | `IntelligenceProvider` | monitorização de alterações em sites concorrentes |
| **ComfyUI** | aprovado | `CreativeProvider` | rendering de imagem/vídeo e workflows visuais |
| **MoneyPrinterTurbo** | aprovado como base de código | `VideoComposer` | pipeline de montagem de vídeo; objectivo é extrair um composer próprio |

### 3.1 Postiz

- serviço isolado;
- uma organização Postiz por workspace/tenant quando o provider for activado;
- tokens sociais permanecem preferencialmente no boundary do Postiz;
- Content OS guarda IDs de ligação e estado normalizado, não precisa de duplicar refresh tokens;
- API key Postiz nunca chega ao browser;
- publicação é protegida por idempotência no nosso domínio;
- licença AGPL exige revisão jurídica antes de comercialização SaaS com dependência relevante.

### 3.2 RSSHub

- serviço interno;
- cache de produção deve usar Redis quando houver escala;
- `ACCESS_KEY`/segredos nunca são enviados em query string por código nosso;
- o produto expõe catálogo controlado de fontes, não acesso arbitrário às rotas RSSHub;
- sinais são normalizados antes de entrar no domínio;
- licença AGPL exige revisão jurídica antes do SaaS público.

### 3.3 changedetection.io

- apenas atrás de adapter;
- IA interna do changedetection.io fica desligada; a interpretação pertence ao Brand Brain/AI Operator;
- não é source of truth de concorrentes;
- `CompetitorEvent` normalizado é persistido no Content OS;
- devido ao datastore file-based/single-process, existe exit plan obrigatório;
- qualquer oferta a terceiros exige esclarecimento jurídico da combinação entre o `LICENSE` e o documento comercial do projecto.

### 3.4 ComfyUI

- worker privado;
- UI/Manager não é exposto ao utilizador final;
- `multi-user` do ComfyUI não substitui autenticação/tenancy do Content OS;
- custom nodes são allowlist, com versões fixas e imagem imutável;
- assets finais são copiados para Storage do Content OS;
- fila ComfyUI é fila técnica; `CreativeJob` do Content OS é o estado oficial;
- licença GPLv3 deve ser respeitada no desenho de distribuição/modificação.

### 3.5 MoneyPrinterTurbo / Video Composer

Fase inicial: fork interno hardened para validar o pipeline.

Destino arquitectural: extrair os componentes úteis para um serviço próprio `video-composer`, preservando os avisos/obrigações da licença MIT nos trechos incorporados.

Componentes prioritários para reaproveitamento:

- pesquisa/obtenção de materiais;
- download seguro;
- adapters de TTS;
- geração de legendas;
- composição FFmpeg;
- montagem final.

A API original não é considerada uma superfície pública segura do Content OS.

---

## 4. Contratos canónicos de provider

Os tipos abaixo são contratos de domínio. Implementações concretas vivem em adapters separados.

```ts
export type ProviderHealth = {
  ok: boolean;
  checkedAt: string;
  latencyMs?: number;
  code?: string;
  message?: string;
};

export type ProviderJobState =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";
```

### 4.1 IntelligenceProvider

```ts
export type IntelligenceCollectInput = {
  organizationId: string;
  sourceId: string;
  cursor?: string;
  limit?: number;
};

export type RawSignal = {
  externalId: string;
  sourceType: string;
  sourceUrl: string;
  title?: string;
  body?: string;
  publishedAt?: string;
  observedAt: string;
  rawHash: string;
  metadata: Record<string, unknown>;
};

export interface IntelligenceProvider {
  readonly provider: string;
  collect(input: IntelligenceCollectInput): Promise<RawSignal[]>;
  health(): Promise<ProviderHealth>;
}
```

Implementações iniciais:

- `RSSHubIntelligenceProvider`;
- `ChangeDetectionIntelligenceProvider`.

### 4.2 CreativeProvider

```ts
export type CreativeGenerateInput = {
  organizationId: string;
  idempotencyKey: string;
  workflow: string;
  parameters: Record<string, unknown>;
  sourceAssetIds?: string[];
};

export type CreativeJobRef = {
  provider: string;
  providerJobId: string;
  state: ProviderJobState;
};

export interface CreativeProvider {
  readonly provider: string;
  generate(input: CreativeGenerateInput): Promise<CreativeJobRef>;
  status(providerJobId: string): Promise<CreativeJobRef>;
  cancel(providerJobId: string): Promise<void>;
  health(): Promise<ProviderHealth>;
}
```

Implementação inicial:

- `ComfyCreativeProvider`.

### 4.3 VideoComposer

```ts
export type VideoComposeInput = {
  organizationId: string;
  idempotencyKey: string;
  scriptId: string;
  format: "9:16" | "1:1" | "16:9";
  assetIds: string[];
  voice?: string;
  subtitlePreset?: string;
  musicAssetId?: string;
};

export interface VideoComposer {
  readonly provider: string;
  compose(input: VideoComposeInput): Promise<CreativeJobRef>;
  status(providerJobId: string): Promise<CreativeJobRef>;
  cancel(providerJobId: string): Promise<void>;
  health(): Promise<ProviderHealth>;
}
```

Implementação inicial:

- `MptVideoComposer`, substituível posteriormente por `LumenvaVideoComposer`.

### 4.4 DistributionProvider

```ts
export type DistributionPublishInput = {
  organizationId: string;
  idempotencyKey: string;
  contentId: string;
  connectionId: string;
  scheduledFor?: string;
};

export type DistributionResult = {
  provider: string;
  providerPublicationId: string;
  state: ProviderJobState;
  publishedUrl?: string;
};

export interface DistributionProvider {
  readonly provider: string;
  connect(organizationId: string, input: Record<string, unknown>): Promise<{ connectionId: string; redirectUrl?: string }>;
  publish(input: DistributionPublishInput): Promise<DistributionResult>;
  status(providerPublicationId: string): Promise<DistributionResult>;
  metrics(providerPublicationId: string): Promise<Record<string, number>>;
  health(): Promise<ProviderHealth>;
}
```

Implementação inicial:

- `PostizDistributionProvider`.

---

## 5. Modelo de domínio mínimo

As tabelas concretas serão introduzidas por migrations forward-only. Toda tabela tenant-aware usa `organization_id`, RLS e as regras do repositório.

### 5.1 Descoberta e inteligência

- `content_sources` — fonte configurada pelo tenant;
- `content_signals` — sinal normalizado e deduplicado;
- `competitors` — concorrentes monitorizados;
- `competitor_monitors` — configurações de watch independentes do provider;
- `competitor_events` — alterações relevantes normalizadas;
- `content_opportunities` — oportunidade já classificada/priorizada pelo domínio.

### 5.2 Planeamento e criação

- `content_campaigns`;
- `content_ideas`;
- `content_hooks`;
- `content_scripts`;
- `content_items`;
- `content_approvals`.

### 5.3 Criadores

- `content_creators`;
- `content_creator_profiles`;
- `content_creator_assignments`.

### 5.4 Media

- `content_assets` — metadados e referência ao Storage;
- `creative_jobs` — estado oficial de geração/composição;
- `creative_job_assets` — inputs/outputs por job.

### 5.5 Distribuição

- `distribution_connections` — ligação lógica do tenant ao provider;
- `publication_jobs` — estado oficial da publicação;
- `publication_metrics` — métricas normalizadas por snapshot/intervalo.

### 5.6 Aprendizagem

- `content_learning_events` — feedback, performance e decisões posteriores;
- projecções de memória/grafo podem derivar destes eventos sem substituir as tabelas acima.

---

## 6. Regras de tenancy, segurança e autorização

1. `organization_id` nunca é aceite do body como autoridade.
2. RLS obrigatório em todas as tabelas tenant-aware.
3. Service role filtra `organization_id` manualmente.
4. Browser/mobile nunca recebe secrets de provider.
5. Secrets de plataforma vivem no secret manager apropriado; tenant BYOK segue o contrato cifrado aprovado do CRM.
6. CORS autenticado nunca usa `*`.
7. URLs externas passam por validação anti-SSRF e bloqueio de redes privadas/metadata quando a superfície faz fetch.
8. Custom nodes/workflows de rendering são allowlist e versionados.
9. Inputs externos são validados por Zod.
10. Logs/audit não guardam tokens, cookies, API keys ou conteúdo sensível desnecessário.

---

## 7. Idempotência, filas e retries

### 7.1 Jobs oficiais

O Content OS mantém o job oficial e guarda apenas `provider_job_id` como referência externa.

### 7.2 Publicação

`publication_jobs` exige idempotência porque timeout não prova ausência de publicação remota.

Mesma `Idempotency-Key` + mesmo payload não duplica side effect.

Mesma key + payload diferente devolve `409 idempotency_conflict`, conforme o contrato base do CRM.

### 7.3 Creative jobs

Geração cara também é idempotente. Reexecução automática só ocorre para falha classificada como transitória e com ownership de retry explícito.

### 7.4 Intelligence

Sinais usam chave natural tenant-aware, por exemplo:

```text
(organization_id, provider, source_id, external_id)
```

ou hash canónico equivalente quando a fonte não oferece `external_id` estável.

### 7.5 Circuit breaker

Adapters mantêm circuit breaker/health por provider para evitar tempestade de retries quando a dependência externa está degradada.

---

## 8. Eventos canónicos

O sistema usa `event_log`/workers já estabelecidos pelo CRM. Triggers Postgres nunca fazem HTTP.

Eventos iniciais:

```text
content.signal.collected
content.opportunity.created
content.idea.created
content.script.approved
content.asset.requested
content.asset.ready
content.video.requested
content.video.ready
content.publication.requested
content.publication.published
content.publication.failed
content.metrics.collected
content.learning.recorded
```

Cada evento tenant-aware carrega `organization_id`, `request_id`/correlação e payload mínimo necessário.

---

## 9. Observabilidade

Cada chamada a engine deve produzir telemetria com:

- `organization_id`;
- `request_id`;
- `job_id` local;
- `provider`;
- `provider_job_id` quando existir;
- operação;
- duração;
- resultado;
- classe de erro;
- retry count;
- custo estimado/medido quando aplicável.

Não incluir secrets ou PII não necessária.

Health checks de provider alimentam uma superfície operacional própria; indisponibilidade externa nunca pode parecer sucesso silencioso.

---

## 10. UX e mobile

A UI continua proprietária do Content OS. Não incorporar dashboards dos engines.

Superfícies oficiais:

- Desktop: experiência completa;
- Mobile: experiência responsiva de primeira classe para consulta, aprovação, calendário, alertas, roteiros e publicação; workflows pesados de configuração/rendering podem ser simplificados no primeiro ciclo, mas a API é a mesma.

Estados de jobs devem ser legíveis por humanos: `Na fila`, `A gerar`, `Pronto`, `Falhou`, `Cancelado`, sem expor nomes internos de serviços quando isso não ajuda o utilizador.

---

## 11. Licenciamento e procurement gate

Antes de oferecer o Content OS como SaaS a terceiros:

- rever AGPL do Postiz;
- rever AGPL do RSSHub;
- rever GPLv3 e distribuição/modificações do ComfyUI;
- esclarecer por escrito os termos comerciais/hosting do changedetection.io;
- preservar avisos MIT dos trechos derivados do MoneyPrinterTurbo;
- registar decisão jurídica/procurement como gate de release, não como nota opcional.

Nenhuma conclusão desta spec substitui aconselhamento jurídico.

---

## 12. Critérios de aceite arquitectural

A arquitectura só é considerada implementada quando:

1. domínio compila sem import directo dos cinco engines;
2. cada integração possui adapter que implementa um dos quatro contratos canónicos;
3. browser não consegue alcançar directamente os serviços internos;
4. jobs locais sobrevivem a indisponibilidade/restart do provider conforme o seu contrato;
5. publicação é protegida contra duplicação;
6. sinais de inteligência são deduplicados;
7. assets finais ficam no Storage canónico do CRM;
8. existem testes cross-tenant para novas tabelas/rotas;
9. health e erros de provider ficam visíveis operacionalmente;
10. existe um teste de contrato por provider;
11. existe um caminho documentado para substituir cada provider sem mudar o domínio;
12. o gate jurídico está explícito antes de exposição SaaS a terceiros.

---

## 13. Fora de escopo desta spec

- copiar UI de qualquer engine externo;
- expor ComfyUI/Postiz/RSSHub/changedetection/MPT directamente ao browser;
- tornar n8n o source of truth/orchestrator central;
- usar Mem0/Graphiti como fonte transaccional;
- permitir instalação arbitrária de custom nodes em produção;
- desenvolver rede social/publicador próprio no V1;
- desenvolver crawler universal próprio antes de validar o V1;
- reescrever o CRM para acomodar engines externos.
