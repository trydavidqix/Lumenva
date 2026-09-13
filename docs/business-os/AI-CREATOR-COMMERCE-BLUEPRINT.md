# Lumenva AI Creator Commerce + Revenue OS

**Status:** planejamento arquitetural
**Branch:** `plan/ai-creator-commerce-revenue-os-2026-09-13`
**Regra:** não implementar nem mesclar em `main` sem aprovação explícita.

## 1. Objetivo

Transformar o Lumenva Business OS em uma operação AI-first capaz de criar e administrar creators virtuais, produzir conteúdo e vídeo, publicar em canais como TikTok, ligar conteúdo a produtos e afiliados, medir receita e comissão e permitir que agentes aprendam quais combinações de produto, creator, hook e formato geram mais vendas.

O sistema deve reaproveitar a arquitetura existente: CRM como Control Plane, Postgres como Source of Truth, BrowserMesh como Execution Plane, Agent OS como workforce, Content OS como motor editorial, Video Engine como produção audiovisual, Maestri como governor da empresa e Claude/Codex como engenharia.

Não criar runtime, scheduler, approvals, event bus, memória ou banco paralelos.

---

## 2. Novo domínio: Creator Commerce OS

O `Creator Commerce OS` entra como camada de negócio sobre:

```text
Marketing OS
   +
Content OS
   +
Video Engine
   +
Agent OS
   +
Revenue OS
   +
Lumenva Connect
```

Fluxo principal:

```text
Trend Agent
   ↓
Product Discovery Agent
   ↓
Creative Strategist
   ↓
Creator Persona Engine
   ↓
Script Engine
   ↓
Video Engine
   ↓
Compliance Gate
   ↓
Publisher
   ↓
TikTok / outros canais
   ↓
Shop / Affiliate Conversion
   ↓
Revenue OS
   ↓
Attribution + Learning Loop
```

---

## 3. Hierarquia AI-first

```text
OWNER
  ↓
MAESTRI — AI CEO / COMPANY GOVERNOR
  ↓
CREATOR COMMERCE DIRECTOR
  ├── Trend Research Agent
  ├── Product Discovery Agent
  ├── Creative Strategy Agent
  ├── Creator Persona Agent
  ├── Script Agent
  ├── Video Production Agent
  ├── Publishing Agent
  ├── Affiliate Ops Agent
  ├── Revenue Analytics Agent
  ├── Integration Ops Agent
  └── Compliance Agent
```

Não criar um agente executivo por plataforma. TikTok, Shopify, Amazon, Hotmart e outros são providers/tools operados via `Lumenva Connect`.

---

## 4. Creator Persona Engine

Cada creator virtual deve ser uma entidade persistente, não apenas um prompt.

### Dados principais

```text
creator_id
organization_id
name
brand_name
persona_type
visual_identity
voice_identity
personality
niche
tone
language
markets
allowed_topics
restricted_topics
brand_rules
disclosure_policy
status
created_at
updated_at
```

### Regras

- personagem original;
- aparência consistente;
- voz consistente;
- personalidade consistente;
- nenhum uso de rosto/voz de pessoa real sem autorização;
- disclosure de conteúdo gerado por IA quando exigido;
- nenhum claim de produto que não possa ser comprovado;
- produto real deve ser mostrado quando necessário para confiança/compliance.

---

## 5. Content OS → Creator Commerce

Reutilizar o Content OS existente e acrescentar capacidades orientadas a venda.

Entradas:

```text
trends
competitors
hooks
scripts
creator profiles
product catalog
affiliate offers
campaign goals
revenue signals
```

Saídas:

```text
video concepts
hooks
scripts
captions
hashtags
shot plans
CTA
product link mapping
variants
```

Cada peça de conteúdo deve receber IDs para atribuição:

```text
content_id
creator_id
product_id
offer_id
campaign_id
creative_variant_id
```

---

## 6. Video Engine

O Video Engine passa a suportar produção em escala controlada.

Pipeline:

```text
Script
 ↓
Storyboard
 ↓
Avatar / virtual creator scene
 ↓
Product footage / UGC / approved assets
 ↓
Voice
 ↓
Captions
 ↓
Edit
 ↓
Compliance checks
 ↓
Final render
```

Variações podem testar:

```text
hook
CTA
thumbnail
voice
scene order
length
caption style
product angle
creator
language
market
```

Evitar geração massiva de vídeos quase idênticos. A estratégia deve privilegiar variedade real, qualidade e aprendizado por performance.

---

## 7. Lumenva Connect

Criar gateway único para providers externos.

### Famílias

```text
CommerceAdapter
MarketplaceAdapter
AffiliateAdapter
PaymentAdapter
SocialCommerceAdapter
PublishingAdapter
```

### Exemplos

```text
Commerce:
- Nuvemshop
- Shopify
- WooCommerce
- VTEX

Marketplace:
- Amazon Seller
- eBay
- Etsy

Affiliate:
- Amazon Associates
- Hotmart
- Awin
- impact.com
- CJ
- PartnerStack

Payments:
- Stripe
- PayPal

Social commerce / publishing:
- TikTok
- TikTok Shop quando a API/capability estiver disponível para o mercado
```

### Contrato-base

```text
connect()
disconnect()
healthCheck()
initialSync()
incrementalSync()
registerWebhooks()
handleWebhook()
refreshCredentials()
getProducts()
getOrders()
getSales()
getCommissions()
getRefunds()
getPayouts()
```

---

## 8. TikTok / TikTok Shop

Separar as capacidades, porque nem todas as APIs existem ou estão disponíveis em todos os mercados ao mesmo tempo.

### TikTok Publishing

Responsável por:

```text
publish video
draft/publish flow
caption
metadata
account authorization
publication receipt
analytics ingestion
```

### TikTok Shop / Affiliate

Responsável por:

```text
products
offers
affiliate commissions
orders/conversions
creator attribution
shop performance
```

Quando determinada capacidade não existir por API oficial no mercado, usar:

```text
Country Capability Gate
→ API available
→ browser/manual assisted flow
→ REVIEW_REQUIRED
```

Nunca fingir que uma capability existe globalmente.

---

## 9. Revenue OS

O Revenue OS consolida receita própria, marketplace e afiliados.

### Modelo canônico

```text
sales
sale_items
payments
refunds
chargebacks
subscriptions
commissions
payouts
affiliate_programs
affiliate_links
affiliate_conversions
attributions
revenue_snapshots
revenue_goals
```

### Métricas principais

```text
GMV
gross revenue
net revenue
commission
commission pending
commission approved
payouts
refund rate
chargeback rate
conversion
CTR
EPC
revenue per 1k views
revenue per video
revenue per creator
revenue per product
revenue per campaign
CAC
margin
```

---

## 10. Attribution Engine

Todo conteúdo deve ser ligado à venda quando possível.

Guardar:

```text
utm_source
utm_medium
utm_campaign
utm_content
utm_term
sub_id
click_id
referrer
landing_page
creator_id
product_id
offer_id
campaign_id
creative_variant_id
```

Perguntas que o sistema deve responder:

- qual creator vende mais?
- qual produto gera mais comissão?
- qual hook vende mais?
- qual formato vende mais?
- qual país tem melhor ROI?
- qual vídeo gerou a venda?
- qual produto deve receber mais produção hoje?

---

## 11. Learning Loop

```text
Publish
 ↓
Collect metrics
 ↓
Collect revenue
 ↓
Attribution
 ↓
Compare variants
 ↓
Identify winners
 ↓
Update creative priors
 ↓
Generate next experiments
```

A IA deve aprender combinações como:

```text
Creator A
+ Product B
+ Hook C
+ Format D
+ Market E
= best revenue/video
```

Toda recomendação precisa guardar evidência e janela temporal.

---

## 12. Country Capability Gate

Obrigatório para operação internacional.

Tabela proposta:

```text
provider_country_capabilities
```

Campos:

```text
provider
country
capability
status
requirements
terms_version
last_verified_at
source
```

Estados:

```text
ALLOW
REVIEW_REQUIRED
DENY
UNKNOWN
```

`UNKNOWN` nunca equivale a `ALLOW`.

Antes de ativar um novo país/provider, verificar:

```text
provider availability
seller/creator eligibility
age/account requirements
business registration
payments
banking
currency
VAT/tax requirements
data/privacy requirements
content policy
affiliate rules
API availability
```

---

## 13. Compliance Gate

Executar antes da publicação e antes de ações sensíveis.

Checks:

```text
AI disclosure
product truthfulness
prohibited claims
copyright/assets
identity/likeness rights
market restrictions
platform policy
country capability
commercial disclosure
affiliate disclosure
```

Resultados:

```text
PASS
REVIEW_REQUIRED
BLOCK
```

---

## 14. Risk / autonomy

Reutilizar o modelo existente.

```text
P0 Observe
P1 Work
P2 Operate
P3 Sensitive
P4 Privileged
```

### Exemplos

P0/P1:
- pesquisar tendências;
- analisar produtos;
- gerar roteiros;
- gerar relatórios;
- criar drafts.

P2:
- publicar conteúdo dentro de policy;
- iniciar teste A/B dentro de budget;
- sincronizar catálogos;
- atualizar configurações de campanha de baixo risco.

P3:
- aumento material de budget;
- ativação de novo mercado;
- mudanças importantes de payout;
- integração que exige nova autorização comercial.

P4:
- identidade fiscal;
- segredos;
- alteração de constituição/policies;
- desativação de auditoria;
- bypass de Country Capability Gate.

---

## 15. Workers determinísticos

Não usar LLM para tudo.

Workers:

```text
provider.healthcheck
provider.refresh_auth
provider.sync
provider.webhook.process
creator.analytics.sync
content.metrics.sync
revenue.aggregate
revenue.reconcile
affiliate.commission.sync
attribution.reconcile
revenue.anomaly.scan
```

Somente anomalias, decisões e investigação sobem para agentes.

---

## 16. Eventos

Adicionar ao `event_log` existente:

```text
creator.created
creator.updated
content.concept_created
content.render_started
content.render_completed
content.approved
content.published
content.performance_updated
provider.connected
provider.degraded
provider.auth_expired
product.discovered
product.shortlisted
sale.created
sale.paid
refund.created
commission.created
commission.approved
commission.reversed
commission.paid
attribution.created
revenue.anomaly_detected
experiment.started
experiment.completed
winner.detected
country.capability_changed
```

---

## 17. Command Center

Adicionar dentro do Command Center existente:

```text
/command/creator-commerce
/command/creator-commerce/creators
/command/creator-commerce/products
/command/creator-commerce/content
/command/creator-commerce/experiments
/command/creator-commerce/channels
/command/creator-commerce/attribution
/command/creator-commerce/revenue
```

### Overview

Exibir:

```text
Revenue today
Commission today
GMV
Top creator
Top product
Top creative
Revenue/video
Published today
Experiments running
Integrations health
Incidents
Approvals
```

---

## 18. MCP / CLI

MCP e CLI não devem falar diretamente com providers.

Fluxo:

```text
Claude / Codex / Maestri
 ↓
Lumenva MCP / CLI
 ↓
Policy Gate
 ↓
Domain Service
 ↓
Lumenva Connect
 ↓
Provider
```

### MCP tools

```text
creator_list
creator_get
product_discover
product_rank
content_generate_plan
content_publish
content_performance
affiliate_commissions
revenue_summary
revenue_compare_creators
revenue_compare_products
provider_health
country_capability_check
experiment_create
experiment_result
```

### CLI

```text
lumenva creators list
lumenva products discover
lumenva content queue
lumenva publish status
lumenva affiliate commissions
lumenva revenue today
lumenva revenue creators
lumenva connect health
lumenva country check PT tiktok_shop
```

---

## 19. MVP recomendado

### Phase A — Foundation

Construir sem novos providers:

```text
Creator Persona domain
Creator Commerce events
Revenue attribution schema
Country Capability Gate
Compliance Gate
Connect Gateway interface
```

Usar Nuvemshop existente para provar integração de Revenue OS.

### Phase B — TikTok publishing

```text
OAuth/account connection
content publishing
publication receipts
analytics sync
AI disclosure metadata
```

### Phase C — Affiliate operations

Implementar primeiro os providers disponíveis e autorizados para a operação a partir de Portugal.

Começar por uma combinação como:

```text
TikTok creator content
+ affiliate/product source aprovado
+ Revenue attribution
```

### Phase D — Shopify + Stripe

Criar base de commerce própria para produtos vencedores.

### Phase E — Amazon / Hotmart / redes de afiliados

Expandir somente após Country Capability Gate e termos atuais serem validados.

---

## 20. Estratégia comercial

### Estágio 1 — AI Affiliate Lab

- 1 creator virtual;
- poucos nichos;
- produtos selecionados por score;
- experimentos controlados;
- foco em revenue/video e commission/video.

### Estágio 2 — AI Creator Studio

- escalar criativos vencedores;
- sellers/marcas podem contratar campanhas;
- combinar fee + comissão + performance.

### Estágio 3 — Lumenva Creator Network

- múltiplos creators;
- múltiplos mercados;
- múltiplos sellers;
- distribuição automática de produção baseada em ROI.

Receitas possíveis:

```text
affiliate commissions
brand campaign fees
monthly management
content production
performance bonus
own-product margin
software/managed-service fee
```

---

## 21. Regras constitucionais

1. API oficial primeiro; BrowserMesh apenas quando necessário e permitido.
2. Nenhum segredo em prompt, log ou banco em texto puro.
3. Nenhum país/provider ativa sem Country Capability Gate.
4. Nenhuma publicação comercial ignora Compliance Gate.
5. Conteúdo gerado por IA deve seguir disclosure aplicável.
6. Não copiar identidade de pessoas reais sem autorização.
7. Não fabricar resultados ou características de produto.
8. Não produzir spam de conteúdo quase idêntico.
9. Postgres continua source of truth.
10. Jobs determinísticos executam trabalho repetitivo; agentes decidem e investigam.
11. Revenue OS mede resultado financeiro, não apenas views/likes.
12. Toda ação P2+ gera receipt/evidência.
13. Não criar runtime de agentes paralelo.
14. Não criar Event Bus paralelo.
15. Não mesclar esta branch em `main` sem aprovação explícita.

---

## 22. Critério de sucesso do primeiro MVP

O MVP está validado quando o Owner puder pedir:

> "Como está o creator commerce hoje?"

E receber, sem abrir plataformas externas:

```text
revenue
commission
GMV
creators performance
products performance
content performance
attribution
integrations health
anomalies
experiments
recommendations
```

E depois pedir:

> "Melhore as vendas dentro de €X de orçamento e das políticas permitidas."

O sistema deve:

```text
observe
analyze
plan
classify risk
check country/provider capability
delegate
execute allowed actions
measure
record evidence
learn
escalate only when necessary
```

---

## 23. Encaixe final no Business OS

```text
OWNER
  ↓
MAESTRI
  ↓
LUMENVA BUSINESS OS
  ├── Sales OS
  ├── Marketing OS
  ├── Content OS
  ├── Creator Commerce OS
  ├── Revenue OS
  ├── Agent OS
  ├── Video Engine
  └── Lumenva Connect
          ↓
      Providers
          ↓
      Revenue / Events
          ↓
       Postgres
          ↓
      Command Center
```

**Decisão:** Creator Commerce deve ser uma extensão nativa do Business OS, usando Content OS + Video Engine para criação, Agent OS para operação, Lumenva Connect para providers, Revenue OS para resultado financeiro e Country/Compliance Gates para permitir expansão segura a partir de Portugal para outros mercados.
