# Pesquisa de oferta e pricing — DeskcommCRM (Lumenva)

> Gerado em 2026-09-03. Pesquisa de mercado para apoiar decisão comercial da Lumenva.
> Não editar como se fosse doutrina do produto — este documento é pesquisa pontual, não `docs/specs/`.

---

## 1. Inventário de oferta — o que o CRM entrega HOJE

Base: `CLAUDE.md`, `VISION.md`, `docs/current-state.md` (`audited_against: main @ 60ed322f`, 2026-09-01), `docs/business-rules/00-business-rules-catalog.md`. Só itens com código+testes confirmados no repo (não roadmap).

### (a) Produto — vira licença/self-host/mensalidade

| Área | O que existe de verdade |
|---|---|
| **Core CRM** | Pipelines/estágios com `vocabulary` configurável por nicho (kanban, fractional indexing), leads, contatos (`contacts` como fonte única de identidade), atividades, tags, customer 360 |
| **WhatsApp/WAHA** | WAHA Plus multi-número, engine NOWEB, inbox 3 painéis tempo real, mídia via Storage, anti-banimento (throttle 1.2s+jitter, campanha 5s+jitter, warm-up 7–14 dias, janela 7h–22h), STOP/opt-out (`STOP`/`PARAR`/`SAIR`/`UNSUBSCRIBE`/`CANCELAR`), multi-device (`message.any`/`fromMe`), automações QUANDO/SE/ENTÃO |
| **IA nativa** | Agentes com RAG por tenant (pgvector), providers Anthropic/OpenAI/Google via AI Gateway, IA como assignee de primeira classe, handoff IA→humano auditado, sentiment, budget de IA por organização, MCP server interno |
| **Multi-tenancy / RBAC / MFA** | RLS desde o início, papéis `viewer<agent<manager<admin`, platform admin cross-tenant via `platform_admins`, MFA TOTP obrigatório para admin/platform admin |
| **RGPD/Privacidade** | Anonimização preferida a delete físico, cascade de redact, SLA 1 mês (+2 extensão), notificação de violação 72h (processo manual), audit `lgpd.*`/`privacy.*` append-only — diferencial concreto pra cliente europeu |
| **Self-host** | `hostgator-setup-kit`, `docker compose` genérico funcional, `baseline.sql` auto-curativo, runbook de deploy documentado, 100% MIT sem feature travada |
| **Governança de atendimento** | Épico G1–G6 completo: atribuição/transferência auditada, roteamento automático com fila, painel de gestão, métricas por atendente |
| **Relay e-mail→WhatsApp (GPT Action)** | Confirmado em produção 2026-09-02 contra `crm.lumenva.pt` — ChatGPT Work notifica dono via WhatsApp |

### (b) Serviço/consultoria — vira implementação/customização

| Área | O que se vende como serviço |
|---|---|
| Setup inicial self-host (VPS, deploy, DNS, WAHA pairing) | Kit existe, mas alguém precisa rodar/operar numa VPS do cliente |
| Migração de dados de CRM anterior (Kommo, planilha, Nuvemshop) | Sem importador genérico automatizado no produto — é trabalho manual/script por cliente |
| Customização de `vocabulary`/pipeline por nicho (clínica, imobiliária, infoproduto) | Templates por nicho estão no roadmap ("próximo", não entregue); hoje é configuração manual guiada |
| Configuração de automações QUANDO/SE/ENTÃO e agentes de IA (prompt, RAG, budget) | Depende de entendimento do negócio do cliente — trabalho de consultoria |
| Treinamento de equipe (uso do inbox, kanban, papéis) | Onboarding institucional, não documentação self-service ainda |
| Suporte contínuo / manutenção da VPS | Produto não é SaaS gerenciado; alguém precisa manter a instância viva |
| Integrações extras (Nuvemshop dormente hoje, Meta Cloud API, futura VTEX/Shopify) | Trabalho de configuração/dev por integração |

**Achado relevante para o pricing:** o software em si é MIT, sem tier pago — a Lumenva não vende licença de feature. A oferta comercial real é (1) hosting/infra gerenciada + (2) implementação/customização + (3) suporte recorrente. Isso aproxima o modelo mais de "agência que roda open source pro cliente" do que de "SaaS com plano".

---

## 2. Preços reais de mercado

### 2.1 Concorrentes diretos (SaaS CRM fechado) — preço de tabela oficial

| Produto | Plano entrada | Plano meio | Plano avançado | Moeda/billing | Fonte | Data consulta |
|---|---|---|---|---|---|---|
| Pipedrive | $14/user/mês (anual) | $39–49/user/mês | $79/user/mês | USD, anual; mensal 20-25% mais caro | [Pipedrive pricing 2026 — costbench](https://costbench.com/software/crm/pipedrive/) | 2026-09-03 |
| HubSpot CRM | $15/seat/mês (Starter, anual) | $90/seat/mês (Professional) + **$1.500 onboarding obrigatório** | Enterprise (custom) | USD | [HubSpot pricing 2026 — engagebay](https://www.engagebay.com/blog/hubspot-pricing/) | 2026-09-03 |
| Kommo (ex-amoCRM) | $15/user/mês (Base) | $25/user/mês (Advanced) | $45/user/mês (Pro), Enterprise custom | USD, mín. 6 meses | [Kommo pricing 2026](https://www.kommo.com/blog/kommo-pricing/) | 2026-09-03 |
| monday CRM | $12/seat/mês (Basic, anual, mín. 3 seats) | $17/seat/mês (Standard) | $28/seat/mês (Pro) | USD; mensal $18/$25/$41 | [monday pricing 2026 — usecarly](https://www.usecarly.com/blog/monday-pricing/) | 2026-09-03 |
| Zoho CRM | Grátis até 3 users; $14/user/mês (Standard) | $23/user/mês (Professional) | $40/user/mês (Enterprise), $52 (Ultimate) | USD, anual; mensal 20-34% mais | [Zoho CRM pricing 2026](https://leadhaste.com/blog/zoho-crm-pricing-2026) | 2026-09-03 |

**Comparável direto (open source self-host, mesma categoria "atendimento via chat"):**

| Produto | Cloud | Self-host pago (suporte) | Self-host free | Fonte | Data |
|---|---|---|---|---|---|
| Chatwoot | $19/$39/$99 por agente/mês (anual) | $19–$99/agente/mês (com manutenção gerenciada) | Community Edition grátis (custo é infra+tempo) | [Chatwoot pricing 2026 — eesel](https://www.eesel.ai/blog/chatwoot-pricing) | 2026-09-03 |

Chatwoot é a referência mais próxima do modelo DeskcommCRM: código aberto, self-host grátis, e cobra por suporte/hosting gerenciado — exatamente o modelo que a Lumenva provavelmente vai seguir com DeskcommCRM.

### 2.2 Freelancer/consultoria equivalente (Portugal / Suíça)

| Item | Valor | Moeda | Fonte | Data |
|---|---|---|---|---|
| Software developer (geral), Portugal | $29–$53/h (~€27–€49/h) | USD/hr | [lemon.io Portugal rate calculator](https://lemon.io/rate-calculator/portugal/) | 2026-09-03 |
| Software developer (geral), Suíça | 80–150 CHF/h padrão; 160–200+ CHF/h especialista/agência | CHF/hr | [lemon.io Switzerland](https://lemon.io/rate-calculator/switzerland/) | 2026-09-03 |
| Consultor de negócio/estratégia (proxy CRM consulting), Malt França | Média €712/dia (€387–€894) | EUR/dia | [Malt barômetro tarifas 2026](https://www.malt.fr/t/barometre-tarifs/business-conseil) | 2026-09-03 |
| Consultor CRM, Malt (117 freelancers listados) | Página específica bloqueada (403) — número exato não confirmado | — | [Malt CRM consultant](https://www.malt.com/en-gb/t/average-freelance-rates/marketing/crm-consultant) | 2026-09-03 |
| API/Integration developer (WhatsApp Business API etc.), Upwork | $20–$40/h manutenção geral; $75–$150/h dev especializado | USD/hr | [Upwork hourly rates 2026](https://www.upwork.com/resources/upwork-hourly-rates) | 2026-09-03 |

**Conversão de referência (2026-09-03, aproximada):** 1 USD ≈ 0.92 EUR ≈ 0.80 CHF (ordem de grandeza, não taxa exata do dia).

### 2.3 Agência implementadora de CRM

| Item | Valor | Mercado | Fonte | Data |
|---|---|---|---|---|
| Implementação CRM à Medida (PME), setup + mensal | €450 setup + €90/mês (usuários ilimitados) | Portugal | [CRM à Medida — preços](https://crmamedida.pt/precos/) | 2026-09-03 |
| Consultoria de martech/CRM (implementação estratégica) | A partir de €15.000 (projeto) | Portugal | [Liminal](https://liminal.pt/produtos/implementacao-crm-map.html) | 2026-09-03 |
| HubSpot Implementation Partner (geral) | $3.000–$20.000+ (projeto único, sem onboarding fee da HubSpot) | Internacional/EUR equivalente | [Markestac — HubSpot implementation cost](https://www.markestac.com/blog/hubspot-implementation-cost-guide) | 2026-09-03 |
| HubSpot build empresa 50–200 pessoas | CHF 20.000–45.000 (fora das licenças) | Suíça | [Advanzo — HubSpot/Pipedrive Suíça](https://www.advanzo.ch/en-ch/blog/hubspot-salesforce-pipedrive-compared) | 2026-09-03 |

---

## 3. Faixa de preço recomendada — Lumenva vende DeskcommCRM

### Produto (self-host gerenciado, modelo Chatwoot-like)

| Componente | Faixa recomendada | Racional |
|---|---|---|
| **Setup fee (implantação inicial)** | €800–€2.500 por tenant | Abaixo do "CRM à Medida" high-end e muito abaixo de HubSpot partner ($3k+), mas acima do piso €450 porque inclui WAHA pairing + configuração de IA/RAG, que exige mais trabalho técnico que um CRM genérico. Escala com complexidade (nº de nichos/pipelines, integrações). |
| **Mensalidade "hosting gerenciado + suporte"** | €69–€199/mês por organização (não por seat — usuários ilimitados é diferencial de venda vs. concorrência seat-based) | Ancorado no Chatwoot self-host pago ($19–99/agente/mês) mas convertido para org-flat porque o produto já não cobra por seat — isso é a proposta de valor central contra Pipedrive/HubSpot/Kommo (que cobram $12–90 por usuário). Faixa cobre 1 VPS pequena/média + horas de suporte reativo. |
| **Suíça (CHF)** | Setup CHF 900–2.800; mensalidade CHF 75–220 | Ajuste de ~+10-15% sobre EUR pela paridade CHF/EUR atual e custo de vida/suporte local mais caro. |

### Serviço/consultoria (implementação + customização por projeto)

| Pacote | Faixa | Racional |
|---|---|---|
| **Implementação básica** (1 número WhatsApp, pipeline único, sem IA customizada) | €1.500–€3.500 | Abaixo do piso de agência HubSpot ($3k+) — vantagem competitiva de vender "mais barato que implementar um SaaS fechado" porque não há custo de licença embutido. |
| **Implementação completa** (multi-pipeline, IA/RAG configurada, automações QUANDO/SE/ENTÃO, treinamento equipe) | €4.000–€9.000 | Comparável a projeto de consultoria martech portuguesa (€15k é teto para operação grande; DeskcommCRM entrega mais pronto de fábrica, então fica no terço inferior desse tipo de projeto). |
| **Hora avulsa de customização/suporte** | €45–€90/h (Portugal) / CHF 90–160/h (Suíça) | Ancorado nos freelancers de dev Portugal (€27–49/h base) com markup de especialização em WAHA/IA + margem de agência, e no patamar 80-150 CHF/h de dev suíço padrão (sem chegar no topo "especialista" de 200 CHF/h, porque a stack já vem pronta — não é greenfield). |

**Por que essa faixa faz sentido no todo:** o diferencial de venda do DeskcommCRM não é "mais barato por feature" (concorrentes SaaS cobram $12–90/user/mês, que pra uma equipe de 5-10 pessoas já supera a mensalidade org-flat proposta) — é **dono do dado + sem lock-in + IA nativa + RGPD by-design**, com preço posicionado abaixo do custo agregado de licença SaaS + agência de implementação separada. Setup fee cobre o trabalho real de configuração (que hoje é manual, não self-service), e a mensalidade paga hosting+suporte, não "acesso a feature".

---

## 4. Não foi possível confirmar

- **Preço específico "CRM consultant" no Malt** — a página oficial (`malt.com/.../crm-consultant`) retornou 403 ao fetch direto; usei o proxy "consultor de negócio/estratégia" (€712/dia médio) como aproximação, não é o número exato da categoria CRM.
- **Tarifa de freelancer CRM/dev especificamente na Suíça via Malt** — a busca só retornou grades de tarifas para o mercado francês; não achei página equivalente Malt Suíça com número confirmado.
- **Preço de agência implementadora de Pipedrive/Kommo em Portugal ou Suíça** — encontrei apenas material sobre HubSpot; não há fonte confiável equivalente para os outros concorrentes citados na tabela 2.1.
- **Custo real de VPS recomendada (HostGator ou genérica) para rodar DeskcommCRM em produção** — fora do escopo desta pesquisa de mercado (seria pesquisa de custo de infra, não de pricing comercial), mas é insumo direto pro cálculo de margem da mensalidade proposta na Seção 3 e deveria ser levantado antes de fechar o número final.
- **Taxa de câmbio EUR/CHF/USD do dia exato** — usei ordem de grandeza aproximada (não é cotação travada de mercado financeiro em tempo real).
