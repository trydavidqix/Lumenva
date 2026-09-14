# Inventário de ferramentas e integrações — MVP do primeiro cliente pagante

**Escopo:** exclusivamente o caminho MVP das Etapas/Fases A0–A4 (baseline, oferta/entitlements, funil, cobrança/entrega e smoke de primeira receita). Não inclui as Waves 1–16 nem serviços cognitivos fora do necessário para o MVP.

**Data da verificação:** 2026-09-12 (Europe/Lisbon).

**Regra:** `CONFIGURADO` só significa provado por configuração/health/checkout observado. `PRESENTE_NO_CODIGO` não significa configurado. `NOT_PROVEN` não é PASS. Nenhuma chave, token, cookie ou valor secreto foi impresso.

## 1. Fontes e método

- O `PLANO-FINAL-DEFINITIVO.md` não existe mais neste checkout; usei a secção MVP do `PLANO-MESTRE-DEFINITIVO-2026-09-12.md` como fonte fundida.
- Reutilizei o levantamento anterior em `levantamento-mcp-cli-lumenva.md`, que já classificou MCP/CLI oficial por fornecedor e não repeti essa pesquisa.
- `agent-reach doctor --json` foi executado localmente. Resultado relevante: `gh` disponível, `yt-dlp` disponível, GitHub auth configurada mas não verificada pelo doctor, e fontes web/Reddit/Instagram etc. são irrelevantes para o caminho pagante salvo pesquisa posterior.
- `last30days` v3.19.0 foi executado com sucesso para o tópico de MCP/CLI/integrations, usando a configuração global já completa e sem ler cookies. O resultado foi explicitamente marcado como evidência fina: não substitui documentação oficial nem prova runtime. `last30days` encontrou a confirmação pública do Supabase MCP oficial e discussões de stack GitHub/Supabase/Vercel/Stripe; não produziu prova nova para WAHA ou Resend.
- Worker verificado por SSH em `claude@192.168.1.78`, chave `~/.ssh/lumenva_worker`, repo `/home/claude/src/Lumenva`, branch `main`, SHA `22e87a6feb632be3600f32301708bbacf756c07b`, árvore limpa.
- Health live observado no worker: `https://app.lumenva.pt/api/v1/health` e `https://crm.lumenva.pt/api/v1/health` retornaram HTTP 200 com Supabase, Redis e WAHA `ok`.
- No worker, `.env`/`.env.local` do checkout não existem; os valores de produção são geridos fora do checkout/runtime. Não inferir configuração apenas de `.env.example`.
- No worker, `docker`/`node`/`pnpm`/`git`/`curl`/`jq` existem; `gh`, `supabase`, `stripe`, `hcloud` e `infisical` não estão instalados no PATH. Isto é inventário, não autorização para instalar.

## 2. Veredito rápido

### Já utilizável/provado para o MVP

- Supabase/Postgres/Auth/Storage/Realtime: `CONFIGURADO_LIVE`, limitado à prova de health e histórico do plano; verificar SHA/branch antes de release.
- Redis/Upstash: `CONFIGURADO_LIVE` pelo health 200; configuração concreta permanece fora do checkout.
- WAHA: `CONFIGURADO_LIVE` pelo health 200; número/sessão WhatsApp de cliente continua `NOT_PROVEN`.
- Hosting self-host: `CONFIGURADO_LIVE` nos domínios `app.lumenva.pt`/`crm.lumenva.pt`, Caddy/reverse proxy e VPS; deploy do SHA candidato não está provado.
- Node/pnpm/Docker/Git: presentes no worker.
- MCP HTTP interno do CRM: `PRESENTE_NO_CODIGO`; auth/scopes/tools existem, mas equivalência completa e capabilities reais precisam de gate.
- Email Resend: integração no código; envio real e domínio remetente `NOT_PROVEN`.

### Falta, está incompleto ou não provado

- Stripe no checkout da branch atual: `NOT_PRESENTE_NO_SHA_VERIFICADO`; o plano fundido regista Stripe fechado numa linha anterior (`mvp/crm-completo`), mas o grep do worker `main@22e87a6` não encontrou implementação Stripe em `apps/crm`, `packages` ou `supabase`. Não declarar billing pronto em `main`.
- `db:migrate` no checkout verificado ainda é no-op (`echo 'TODO: wire supabase db push or pg-migrate' && exit 0`); o plano histórico diz que uma correção existiu noutro SHA. Gate de release deve confirmar o SHA correto.
- CLI oficial Stripe/Supabase/GitHub/Infisical/Hetzner: levantamento confirmou existência conforme tabela abaixo, mas os binários não estão todos instalados no worker.
- WhatsApp número real, QR/session `WORKING`, webhook público e consentimento do cliente: `NOT_PROVEN`.
- Resend API key, domínio remetente e deliverability: `NOT_PROVEN`.
- Termos, Política de Privacidade, DPA e Stripe Tax multi-país: `PRECISA DONO/ADVOGADO/CONTABILISTA` antes de cobrar fora de Portugal.
- Cliente, oferta/canal exatos, pagamento live liquidado e entrega/aceite: `NOT_PROVEN`.

## 3. Inventário por ferramenta/serviço

### 3.1 Código, worker e entrega

| Item | Necessidade no MVP | Estado verificado | MCP/CLI oficial | Instalação/configuração | Gate |
|---|---|---|---|---|---|
| Git | Branch/SHA/worktree/diff/release | `CONFIGURADO`: presente no worker; repo `main@22e87a6` limpo | N/A; Git CLI oficial | Já presente no worker Linux. Nunca editar `main` diretamente; usar worktree autorizado | A0: SHA, status e proveniência do candidato |
| GitHub | remoto, revisão e fonte de código | `PRESENTE_NO_REPO`; `gh` presente localmente no Mac, ausente no worker; auth GitHub não foi verificada live pelo doctor | **SIM:** GitHub MCP Server oficial e `gh` oficial | Se necessário, instalar `gh` somente no worker por método aprovado; configurar auth sem imprimir token. MCP é opcional para o fluxo, não autoridade | `gh auth status` no worker + branch remota comprovada |
| Node.js/pnpm | build, testes e scripts Next.js | `CONFIGURADO`: presentes no worker | N/A | Já presentes no worker; não instalar no Mac para substituir gate do worker | typecheck/testes no SHA final |
| Docker/Compose | app/worker/WAHA/Redis/Caddy self-host | `PRESENTE`: Docker existe; `docker compose` falha sem secrets de Graphiti/Mem0 no arquivo de produção | N/A | Não ligar Graphiti/Mem0 para o MVP; usar compose mínimo autorizado ou runtime já gerido | compose/app health sem dependências cognitivas |
| Worktree Linux | implementação e release isolados | `CONFIGURADO`: worker Linux existe; host `lumenva-worker` | N/A | Toda implementação e instalação do MVP no worker Linux; nunca instalar dependências de projeto no Mac | branch/worktree/SHA/evidence |
| GitHub Actions | CI/CD | `OFF` por doutrina do repo; não é dependência | `gh` não substitui CI | Não ativar sem autorização | gates manuais/runbook explícitos |

### 3.2 Base, autenticação e dados

| Item | Necessidade no MVP | Estado verificado | MCP/CLI oficial | Instalação/configuração | Gate |
|---|---|---|---|---|---|
| Supabase | Auth, Postgres, RLS, Storage, Realtime | `CONFIGURADO_LIVE`: health 200 em dois domínios; env fora do checkout | **SIM:** [Supabase MCP](https://supabase.com/docs/guides/ai-tools/mcp), URL oficial `https://mcp.supabase.com/mcp`; **SIM:** [Supabase CLI](https://supabase.com/docs/reference/cli/getting-started) | CLI deve ser instalado somente no worker se migration/dev exigir; MCP escopado/read-only. Nunca colocar service role em prompt/CLI input | migration real, RLS, dois tenants, schema e SHA candidato |
| Postgres Supabase | fonte operacional CRM, entitlements, leads, conversations, organization_plan | `CONFIGURADO_LIVE` por health; schema/SHA de release `NOT_PROVEN` | Supabase CLI/MCP; SQL via migration oficial | Usar `DATABASE_URL`/pooler autorizado; não copiar valores para logs | migration/replay/idempotência |
| Supabase Auth/MFA | login, sessão, admin, tenant | `PRESENTE_NO_CODIGO`; health não prova fluxo autenticado | Supabase MCP/CLI | Configuração gerida no projeto Supabase; não instalar no Mac | smoke login/MFA/cookie autenticado |
| Supabase Storage | media/attachments quando o canal exigir | `PRESENTE_NO_CODIGO`; bucket/policy live `NOT_PROVEN` | Supabase MCP/CLI | Criar bucket/policy só com autorização | upload/download scoped e RLS |
| Redis/Upstash | rate limit, idempotência e health | `CONFIGURADO_LIVE` pelo health; env não está no checkout | Não há MCP/CLI oficial adotado no levantamento; API REST/SDK | Configuração no provider/runtime; nenhum binário necessário no worker | rate-limit/idempotency e retry |

### 3.3 Billing e dinheiro

| Item | Necessidade no MVP | Estado verificado | MCP/CLI oficial | Instalação/configuração | Gate |
|---|---|---|---|---|---|
| Stripe account | checkout/subscription/webhook | Conta existe segundo plano fundido; integração live/conta não foi confirmada nesta branch | **SIM:** [Stripe MCP](https://docs.stripe.com/mcp); **SIM:** [Stripe CLI](https://docs.stripe.com/stripe-cli) | Instalar Stripe CLI somente no worker se `stripe listen/trigger` for autorizado; configurar secret fora do Git | Checkout server-side, HMAC raw body, event idempotente, `payment_status`, `organization_plan` |
| Stripe products/prices | Básico €29, Médio €79, Premium €199 | Plano histórico diz criados; código Stripe não encontrado em `main@22e87a6`; `NOT_PROVEN` no SHA atual | Stripe MCP/CLI | Não recriar produtos sem verificar account/mode e IDs | IDs/mode/price mapping e webhook |
| Pagamento manual | fallback para primeiro cliente se Stripe não estiver autorizado | `NOT_CONFIGURADO`; processo precisa owner, valor, método, estado, data e comprovativo | N/A | Registrar no CRM/ledger, sem chamar automático | recibo e aceite manual rastreáveis |
| Stripe Tax/VAT | cobrança fora PT | `NOT_PROVEN`; requer dono/contabilista | Stripe Tax é produto Stripe; CLI/MCP não substituem parecer | Configurar entidade, tax codes, head office, VAT IDs, países e invoice só após decisão | PT/UE/Brasil/EUA conforme países autorizados |
| Finance ledger | contribuição/margem/payback do MVP | `NOT_CONFIGURADO como fatia mínima`; não usar investimento | N/A | Implementar ledger interno separado de entitlements, approval-only | receita − taxas/impostos − delivery − API/cloud − aquisição |

### 3.4 Canal de aquisição/atendimento

| Item | Necessidade no MVP | Estado verificado | MCP/CLI oficial | Instalação/configuração | Gate |
|---|---|---|---|---|---|
| WAHA | WhatsApp pragmático para receber/atender lead | `CONFIGURADO_LIVE` pelo health 200; sessão/número não provados | **NÃO PROVADO** MCP/CLI oficial; REST/API e Docker oficiais documentados | Não instalar no Mac; container/runtime no VPS/worker conforme ambiente autorizado; configurar URL/key/webhook/HMAC fora do Git | QR/session `WORKING`, webhook HTTPS, consentimento, inbound→reply |
| WhatsApp number/device | canal comercial real | `NOT_PROVEN` | WAHA REST; não oficial MCP/CLI | Dono precisa fornecer número e completar QR/Business policy | mensagem real recebida/enviada com tenant |
| Meta WhatsApp Cloud API | alternativa oficial ao WAHA | Código/env seams presentes; credenciais/app/WABA/phone `NOT_PROVEN` | **NÃO PROVADO** MCP/CLI oficial Meta; Graph API | Só ativar se dono escolher; OAuth, webhook verify token, system user token no provider | Meta webhook e template aprovados |
| Instagram/Facebook | fora do menor caminho se WAHA basta | código parcial; provider/app review `NOT_PROVEN` | **NÃO PROVADO** MCP/CLI oficial | Manter fora do corte inicial | não bloquear primeiro cliente |
| Email inbound | canal alternativo, se escolhido | `NOT_PROVEN` no ambiente | Não provado MCP/CLI oficial | Escolher provider/forwarding e persistir tenant/consent | lead→conversation por email |

### 3.5 Email, domínio e notificações

| Item | Necessidade no MVP | Estado verificado | MCP/CLI oficial | Instalação/configuração | Gate |
|---|---|---|---|---|---|
| Resend | convites, confirmação e suporte por email | `PRESENTE_NO_CODIGO`; integração importa Resend; API key/domínio/remetente `NOT_PROVEN` | **NÃO PROVADO** MCP/CLI oficial no levantamento; API/SDK | Configurar `RESEND_API_KEY` e `RESEND_FROM_EMAIL` no runtime/secret manager, nunca no Mac/Git | enviar teste redigido, SPF/DKIM/DMARC e retry/idempotência |
| DNS/domain | `app.lumenva.pt`, `crm.lumenva.pt`, webhook HTTPS | `CONFIGURADO_LIVE` indiretamente pelos health 200; zone/owner/records não auditados | N/A; provider-specific CLI não confirmado | Dono/infra administra DNS; não mudar sem autorização | DNS→TLS→host→health e webhook |
| TLS/reverse proxy Caddy | HTTPS, routing, webhook | `PRESENTE/CONFIGURADO` por domínios vivos e compose Caddy; config SHA/runtime não provado | N/A | Configuração no VPS; não no Mac | certificado válido, headers, webhook reachability |
| Hosting self-host/VPS | produção CRM/WAHA/Redis/Caddy | `CONFIGURADO_LIVE` health 200; provider/arquivo de release não provado | [hcloud CLI](https://github.com/hetznercloud/cli) oficial existe; não instalado no worker; MCP oficial não provado | `hcloud` somente se infra autorizado; produção não é ambiente de build | SHA deployado, rollback, backup e owner |
| Vercel | código contém referências AI Gateway/benchmarks, mas repo tem notas self-host | `NÃO NECESSÁRIO` para o caminho self-host atual; deploy Vercel não provado | Vercel CLI oficial existe, mas não é dependência MVP atual | Não instalar/configurar para este corte | não substituir VPS/Caddy sem decisão |

### 3.6 Segredos, observabilidade e AI

| Item | Necessidade no MVP | Estado verificado | MCP/CLI oficial | Instalação/configuração | Gate |
|---|---|---|---|---|---|
| Infisical | secrets de produção e provider | Plano fundido regista projeto/secrets; no worker `infisical` ausente e config local ausente; acesso live `NOT_PROVEN` | **SIM:** Infisical Docs MCP/servidor oficial limitado; **SIM:** Infisical CLI | Instalar/configurar apenas no worker se owner autorizar; secret values nunca imprimir | fetch scoped, audit, rotation e runtime inject |
| Sentry | errors/observability | `PRESENTE_NO_CODIGO`; DSN/configuração `NOT_PROVEN` | Não provado MCP/CLI oficial necessário | DSN no secret manager/runtime | erro scrubbed, sem PII/secrets |
| Vercel AI Gateway | fallback/provider/observability, não obrigatório se provider direto | env seam presente; key/live `NOT_PROVEN` | Vercel APIs/CLI existem; não necessário para MVP se um provider direto aprovado | Escolher uma rota: gateway ou provider direto; não preencher vários sem decisão | resposta/tool calling/custo e fallback |
| Anthropic/OpenAI/Google | modelo de atendimento/agente, pelo menos um provider | env seams presentes; credencial/org/model `NOT_PROVEN` no worker | São providers de modelo, não MCP/CLI operacional do MVP | Chave no secret manager; escolher provider aprovado; não logar | tool calling real, custo, redaction, fallback |
| Composio | tools Google/externas no código; não necessário para CRM mínimo | `PRESENTE_NO_CODIGO`; key `NOT_PROVEN` | Terceiro; não substituir official provider sem decisão | Deixar fora do menor corte se WAHA/CRM bastarem | escopo/auth/idempotência |

### 3.7 Integrações opcionais fora do menor corte

| Item | Veredito MVP | MCP/CLI/ação |
|---|---|---|
| Google Calendar/Gmail/Sheets | `LATER/NOT_REQUIRED` salvo se a oferta exigir agenda | Composio presente; Google official MCP único não provado; `gws` ownership oficial não confirmado |
| Telnyx/Voice | `LATER/NOT_REQUIRED` para primeiro cliente WhatsApp | MCP remoto e CLI oficiais existem; código voice presente, carrier live não provado |
| Asterisk/Pipecat | `LATER/NOT_REQUIRED` | Asterisk CLI nativa existe; MCP oficial/Pipecat CLI não provados |
| Nuvemshop | `OUT_OF_MVP` | API existe; MCP/CLI oficial não provados |
| Meta Instagram/Facebook | `OUT_OF_MVP` se WAHA fecha o canal | Graph API; sem MCP/CLI oficial provado |
| Graphiti/Mem0/Neo4j | `OFF` | Docker compose exige secrets e falha sem eles; não instalar/configurar para MVP |
| Nuvem/Cloudflare/R2 | `OUT_OF_MVP` salvo necessidade de entrega | provider-specific; sem mudança de infra |

## 4. Requisitos de instalação/configuração no worker Linux

### Já presentes no worker

`node`, `pnpm`, `docker`, `git`, `curl`, `jq`.

### Ausentes no worker e apenas instalar se o gate da tarefa autorizar

`gh`, `supabase`, `stripe`, `hcloud`, `infisical`.

Não instalar automaticamente. Quando autorizados, instalar no worker Linux, não no Mac:

1. `gh`: revisão/remoto GitHub e pesquisa; autenticar por fluxo oficial sem expor token.
2. Supabase CLI: migrations/dev e geração/verificação; usar projeto/link autorizado.
3. Stripe CLI: webhook local/testes; nunca usar live mode sem autorização escrita.
4. `hcloud`: somente operações infra descartáveis/protegidas; nunca apagar `lumenva-crm` sem checks de produção.
5. Infisical CLI: somente leitura/fetch scoped de secrets para runtime; não imprimir valores.

As instruções exatas de instalação dependem de distro/pacote e não devem ser executadas até autorização explícita de download/instalação. O MVP pode usar os canais já existentes e provider dashboards sem instalar todos os CLIs.

## 5. Ordem operacional sem expansão do plano grande

1. **A0:** escolher SHA/worktree candidato; resolver a discrepância `main@22e87a6` versus branch histórica com Stripe/entitlements; confirmar migrations reais.
2. **A1:** manter catálogo/gate entitlements; testar HTTP/MCP/CLI com capabilities reais, não `actor.capabilities=[]`.
3. **A2:** escolher um canal: WhatsApp/WAHA é o caminho mais curto; provar sessão `WORKING`, webhook HTTPS, lead, conversation, qualification, briefing e proposal.
4. **A3:** escolher Stripe ou pagamento manual rastreável. Se Stripe, confirmar integração no SHA candidato e IDs/mode; se manual, persistir owner/valor/método/data/status/comprovativo.
5. **A3/A4:** email mínimo (Resend) para convite/suporte, health, entrega e acceptance; não bloquear o smoke se a oferta puder operar com comunicação WhatsApp manual autorizada.
6. **A4:** executar lead → conversa → resposta → proposta → pagamento → entrega → suporte e guardar SHA, timestamp, status HTTP, receipts e evidence redigida.

## 6. Estados finais por item

- `PASS/CONFIGURADO_LIVE`: Supabase health, Redis health, WAHA health, HTTPS/domínios, worker runtime base.
- `PRESENTE_NO_CODIGO`: Resend, Meta seams, Sentry, MCP HTTP CRM, Supabase clients, WAHA adapter, AI/provider seams.
- `NOT_PROVEN`: Stripe no SHA atual, deploy alinhado ao SHA candidato, sessão WhatsApp real, email deliverability, Auth smoke, RLS two-tenant, migration replay, pagamento liquidado, cliente pagante, owner acceptance.
- `PRECISA DONO`: conta/credencial/provider, canal/oferta, Stripe live, impostos/país, domínio/remetente, número WhatsApp, pagamento manual, qualquer instalação/download/upgrade.
- `FORA DO MVP`: Graphiti/Mem0/Neo4j, Meta social quando WAHA basta, voice, Google, Nuvemshop, Product Factory, Vercel migration, Crossmint/Nevermined/eToro, Agent Factory e Waves 1–16.

## 7. Referências reutilizadas

- `PLANO-MESTRE-DEFINITIVO-2026-09-12.md`, secções MVP/A0–A4.
- `levantamento-mcp-cli-lumenva.md`, levantamento anterior do Sonda, data 2026-09-11.
- `last30days` raw run: `/tmp/mvp-last30days/official-mcp-servers-and-clis-for-stripe-supabase-github-waha-resend-vercel-hosting-email-integrations-raw.md` — evidência social/documental fina, não prova de runtime.
- [Stripe MCP](https://docs.stripe.com/mcp), [Stripe CLI](https://docs.stripe.com/stripe-cli).
- [Supabase MCP](https://supabase.com/docs/guides/ai-tools/mcp), [Supabase CLI](https://supabase.com/docs/reference/cli/getting-started).
- [GitHub MCP Server](https://github.com/github/github-mcp-server), [GitHub CLI](https://github.com/cli/cli).
- [Hetzner Cloud API/CLI](https://github.com/hetznercloud/cli), [WAHA docs](https://waha.devlike.pro/docs/overview/introduction/), [Resend API](https://resend.com/docs/api-reference/introduction).

**Conclusão:** o menor MVP usa worker Linux + self-host/Caddy + Supabase/Postgres/Auth + Redis/Upstash + WAHA/WhatsApp + CRM branch autorizada + Stripe ou pagamento manual + Resend opcional para email. Não instalar/configurar o restante até a oferta exigir. A prova de primeira receita continua `NOT_PROVEN` até o smoke completo com pagamento e aceite.
