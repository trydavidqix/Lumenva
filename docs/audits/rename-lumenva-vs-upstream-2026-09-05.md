# Auditoria de rename: NOSSO DeskcommCRM versus upstream, alvo Lumenva

**Data:** 2026-09-05  
**Checkout auditado:** `/Users/david/Desktop/Projetos/CRM/DeskcommCRM`  
**Branch/HEAD:** `main` @ `2d1c2450`  
**Upstream comparado:** `/tmp/upstream-deskcommcrm`, clone shallow de `https://github.com/melgarafael/DeskcommCRM`, HEAD `4bc0fda442d61f7c91291227d61e0d75a4034d33`  
**Escopo:** auditoria e relatório somente. Nenhum código, schema, compose, env, branch, banco, VPS ou deploy foi alterado.

## Resumo executivo

O rename cosmético/branding das Fases 0–2 já está parcialmente aplicado: há conteúdo Lumenva em `website/`, e-mails `@lumenva.pt`, documentação de RGPD e referências de produto. Isso não deve ser recontado como pendência. Permanecem referências técnicas e operacionais deliberadamente fora do escopo decidido em 2026-09-04: nome do pacote, `crm_*` no banco, imagem Docker, containers/labels, cookies e headers, `DESKCOMM_*`, URLs antigas, scripts HostGator, links GitHub e textos herdados.

Contagens abaixo são de ocorrências lexicais encontradas por `rg` na árvore do NOSSO repo, excluindo `.git`, `node_modules`, `coverage`, `dist` e lockfiles quando indicado. Uma mesma linha pode conter mais de uma referência. Para o inventário por categoria, a unidade é uma ocorrência de token/linha na superfície indicada; não é quantidade de mudanças recomendadas.

## 1. Inventário do nome antigo

Busca principal:

```text
DeskcommCRM | Deskcomm | deskcomm | melgarafael | deskcomm.com | crm.deskcomm | app.deskcomm | admin.deskcomm | waha.deskcomm | status.deskcomm
```

| Variante/superfície | Total encontrado | Exemplos confirmados |
|---|---:|---|
| `DeskcommCRM` ou `Deskcomm` (alternativa mais longa primeiro) | **1.361** | README, rules, comentários, UI, scripts, compose |
| handle `melgarafael` | **100** | links GitHub, imagem GHCR, Instagram/YouTube, metadata histórica |
| domínios/endereços contendo `deskcomm` (`deskcomm.com.br`, `.com`, `.app`, `.pt`, `.test`) | **97** | `.env.example`, `app/account-suspended`, docs de deploy, testes |
| subdomínios antigos (`crm.`, `app.`, `admin.`, `waha.`, `status.` + `deskcomm`) | **59** | callbacks, CORS/host, exemplos e runbooks |
| identificadores de ambiente `DESKCOMM_*` | **69** | `DESKCOMM_GOV_*`, `DESKCOMM_AGENT_*` em loop, docs e `hostgator-setup-kit` |
| identificadores de banco contendo `crm_` em `supabase/` | **895** | tabelas, constraints, índices, triggers, policies, migrations, MANIFEST |

Também foram encontradas referências cosméticas locais que já não são “rename pendente” de produto, mas devem ser preservadas ou avaliadas separadamente: `CRM` como categoria funcional, `crm_lead*` como contrato técnico, `crm_*` em eventos/MCP, e texto histórico de auditorias/handoffs.

### 1.1 Categorização

| Categoria pedida | Total auditado | Superfícies e exemplos |
|---|---:|---|
| (a) texto visível/UI/e-mail | **28 linhas de ocorrência de marca** | `app/design/page.tsx`, `app/design/layout.tsx`, `app/account-suspended/page.tsx`, billing, `public/llms.txt`, recovery-codes filename, suporte `support@deskcomm.com.br`; já há `contato@lumenva.pt` no website |
| (b) identificadores de código/paths | **365 linhas de ocorrência de marca** | `deskcomm-card-pulse`, `deskcomm-theme`, `deskcomm-impersonate`, `x-deskcomm-signature`, caminhos/nomes de scripts e adapters |
| (c) pacote/workspace/imports | **2 referências centrais** | `package.json:name = deskcomm-crm`; lockfile/workspace deve ser confirmado antes de qualquer refactor. Não há pacote Lumenva equivalente aplicado |
| (d) schema/DB | **895 tokens `crm_*` em `supabase/`** | `crm_leads`, `crm_pipelines`, `crm_stages`, `crm_lead_activities`, `crm_lead_links`, `crm_lead_scores`, `crm_lead_risk_states`, `crm_lead_reactivations`, constraints, índices, triggers, RLS, realtime e funções |
| (e) Docker/compose | **120 ocorrências legacy-token** | `ghcr.io/melgarafael/deskcommcrm`, `deskcomm-app:local`, `deskcomm-waha`, `deskcomm-agent-worker`, labels/routers/middlewares Traefik `deskcomm-*`, comentários e diretórios HostGator |
| (f) prefixos de env | **69 tokens `DESKCOMM_*`** | `DESKCOMM_GOV_INVARIANTS_EDIT`, `DESKCOMM_GOV_PLAN_EDIT`, `DESKCOMM_GOV_PHASE_MERGE`, `DESKCOMM_GOV_MIGRATION_EDIT`, `DESKCOMM_AGENT_REPORT*` |
| (g) URLs/domínios/CORS/allowed hosts | **154 ocorrências URL/domínio** | `github.com/melgarafael/DeskcommCRM`, `deskcomm.com.br`, `crm.deskcomm.com.br`, `app.deskcomm.com`, `admin.deskcomm.com`, `waha.deskcomm.com`, `status.deskcomm.com`, e-mails; `crm.lumenva.pt` é o domínio servido documentado e não deve ser tratado como legado |
| (h) docs/Markdown | **160 ficheiros com ocorrência** | README(s), `docs/SETUP.md`, runbooks, specs, rules, handoffs, audits, evidence e planos; muita ocorrência é histórica ou contrato interno, não texto público |
| (i) metadata Git/package/LICENSE/README | **92 ocorrências** | `README.md`, `README.en.md`, `README.es.md`, `SECURITY.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `.github/ISSUE_TEMPLATE/*`, links e handle do autor |

### 1.2 Itens técnicos representativos

- **Pacote:** `package.json:2` mantém `"name": "deskcomm-crm"`; `package.json:5` mantém a descrição DeskcommCRM.
- **Supabase:** `supabase/config.toml:5` mantém `project_id = "deskcomm-crm"`. O baseline inclui todas as tabelas/objetos `crm_*`; a troca não é cosmética.
- **Imagem publicada:** `.env.hostgator.example:13` e `docker-compose.prod.yml:19` usam `ghcr.io/melgarafael/deskcommcrm:latest`; `hostgator-setup-kit/update.sh` monta tags do mesmo registry.
- **Stack local/produção:** `docker-compose.yml` usa `deskcomm-waha` e `deskcomm-agent-worker`; `docker-compose.traefik.yml` usa routers, services e middlewares `deskcomm-*`.
- **Env/instalação:** `hostgator-setup-kit/install.sh`, `_common.sh`, `comecar.sh`, `backup.sh` e `update.sh` usam diretório `deskcommcrm`, comentários de cron e imagem antiga.
- **Contrato web:** `app/api/v1/webhooks/in/[token]/route.ts:91` usa `x-deskcomm-signature`; rotas de impersonação usam cookie `deskcomm-impersonate`.
- **Marca pública residual:** design showcase ainda mostra `DeskcommCRM`; suspensão de conta usa `support@deskcomm.com.br`; billing usa `suporte@deskcomm.app`; README(s) apontam para o GitHub do upstream.

## 2. Comparação com o upstream

Foi comparado cada ficheiro do NOSSO checkout que continha uma referência antiga com o mesmo caminho no clone shallow. Resultado do conjunto de **349 ficheiros**:

| Estado | Ficheiros | Interpretação para futuro `git pull` |
|---|---:|---|
| **HERDADO_IGUAL** | **142** | O caminho e conteúdo ainda coincidem; um rename cosmético nesses ficheiros será conflito provável quando o upstream mudar a mesma linha |
| **DIVERGENTE_NOSSO** | **104** | O NOSSO já tem conteúdo diferente; não assumir que um patch do upstream possa substituir a versão local. O risco de conflito de rename é localizado, mas há risco de perder trabalho ao reconciliar |
| **OURS_ONLY** | **103** | Ficheiro inexistente no clone upstream (docs/audits, Agent OS, voz, regras novas e artefactos locais); não há conflito direto de três vias, mas o nome antigo pode continuar em material próprio |

Ficheiros-chave comparados e classificados como **DIVERGENTE_NOSSO**: `README.md`, `package.json`, `docker-compose.prod.yml`, `docker-compose.yml`, `supabase/config.toml`, `supabase/baseline.sql`, `hostgator-setup-kit/install.sh`, `app/layout.tsx` e `app/account-suspended/page.tsx`. A divergência não prova que o nome antigo foi resolvido; prova apenas que o NOSSO e o upstream já não têm o mesmo conteúdo.

Ficheiros **HERDADO_IGUAL** devem ser tratados como pontos de conflito de um futuro pull: os adapters/rules herdados, templates e documentos que continuam iguais ao upstream não devem receber uma substituição em massa sem patch pequeno e rebase/reconciliação controlados. Ficheiros **OURS_ONLY** não devem ser enviados ao upstream nem usados para inferir que a origem abandonou o contrato.

## 3. Mudanças possíveis, destino, motivo e risco

O vocabulário recomendado é: **marca pública `Lumenva`**, capacidade funcional **`CRM`**, namespace técnico **`crm_*`**, pacote/infraestrutura antiga mantidos com alias enquanto houver instalações vivas.

| Mudança proposta | Para quê | Motivo | Risco concreto | Classificação |
|---|---|---|---|---|
| Texto público e UI claramente visíveis (`DeskcommCRM` → `Lumenva`/`Lumenva CRM`) | Marca consistente | Completar Fases 0–2 sem alterar contratos | snapshots, títulos, suporte e testes de branding podem divergir; baixo impacto se limitado a UI | **SEGURO** |
| README/docs públicos e exemplos não operacionais | `Lumenva` + links atuais | Remover marca antiga da apresentação | links quebrados, instruções de clone erradas e documentação que contradiz a instalação | **SEGURO** se cada link for revalidado; **MÉDIO** para quickstarts |
| GitHub `melgarafael/DeskcommCRM` → repositório/URL Lumenva | novo endereço oficial | propriedade e descoberta pública | clone, issue, security advisory, raw installer, redirects e referências externas quebram; pode quebrar update em VPS | **PERIGOSO** |
| `package.json`/workspace `deskcomm-crm` → `lumenva` | identidade npm/workspace | alinhar pacote ao produto | imports, scripts, caches e lockfile podem mudar; consumidores self-host podem usar o nome antigo | **MÉDIO** |
| Funções/classes/ficheiros internos `deskcomm*` → `lumenva*` | coerência interna | retirar legado de código | imports, aliases, testes, manifests de skills, cookies/headers e integrações internas quebram | **MÉDIO**; **PERIGOSO** se contrato externo |
| Header `x-deskcomm-signature` e cookie `deskcomm-impersonate` | aliases versionados Lumenva | alinhar boundary web | webhooks e sessões existentes deixam de validar; rollout precisa aceitar antigo + novo e expirar depois | **PERIGOSO** |
| Enum/valor persistido ou tabela/coluna `crm_*` → `lumenva_*` | novo namespace DB | não misturar marca e schema, se houver decisão futura | exige migration + backfill + tipos + queries + RLS + índices + triggers + realtime; comparações literais e dados existentes quebram | **PERIGOSO** |
| `project_id = deskcomm-crm` → outro ID Supabase | novo projeto | identidade de projeto | CLI, URLs, secrets, auth, migrations e dados podem apontar para outro projeto; risco de perda/indisponibilidade | **PERIGOSO** |
| Imagem GHCR `ghcr.io/melgarafael/deskcommcrm` → imagem Lumenva | registry público novo | publicação com marca nova | pull/update/rollback da VPS deixam de encontrar imagem; exige alias/tag antiga e validação de recuperação | **PERIGOSO** |
| Nome de serviço/container/rede/volume/labels Docker `deskcomm*` → `lumenva*` | topologia nominal nova | consistência da stack | Compose pode criar segunda stack; referências, volumes e labels de proxy deixam containers sem rede/roteamento. A VPS tem stack em execução | **PERIGOSO** |
| `DESKCOMM_*` → `LUMENVA_*` | namespace de configuração | alinhar env ao nome público | `.env` da VPS e Infisical não são ressincronizados automaticamente; workers/hooks deixam de executar ou iniciam com defaults | **PERIGOSO** |
| Domínios/cookies/CORS/allowed hosts `deskcomm.*` → `lumenva.*` | domínio oficial | migração de presença | DNS, TLS, OAuth callbacks, cookies, CORS, WAHA webhooks, Caddy/Traefik e e-mails podem falhar; precisa janela e rollback | **PERIGOSO** |
| `melgarafael` em atribuição histórica, LICENSE e changelog | autoria correta | preservar proveniência | remover autoria viola histórico/licença ou impede contato; não é rename de produto | **SEGURO** manter; **MÉDIO** alterar após revisão jurídica |

## 4. Plano por fases

### Fase 0 — baseline e vocabulário (sem downtime)

Congelar a lista de aliases e decidir, por superfície, se o destino é `Lumenva`, `Lumenva CRM`, `CRM` funcional ou legado técnico. Registrar redirects e política de compatibilidade. Não alterar produção.

### Fase 1 — texto público e documentação não operacional (sem downtime)

Atualizar títulos, páginas de marketing, showcase, README de apresentação e docs que não sejam receitas de instalação. Manter instruções históricas e links antigos quando forem evidência. Validar links e testes de branding. Esta é a única faixa recomendada para execução imediata sem janela.

### Fase 2 — documentação operacional com aliases (sem downtime, depois de revisão)

Atualizar exemplos de env/compose e runbooks apenas adicionando destino Lumenva e marcando o valor antigo como compatibilidade. Não trocar variáveis, imagens, diretórios ou domínios por substituição cega. Revalidar `install`, `update`, backup e rollback em ambiente descartável.

### Fase 3 — pacote e identificadores internos (janela de manutenção lógica)

Refatorar imports, caminhos, manifests, cookies/headers versionados e testes. Aceitar tokens antigos durante uma janela de compatibilidade. Rodar typecheck, unit, harness, E2E e prova de webhook antes de qualquer release. Não misturar com alteração de schema ou domínio.

### Fase 4 — imagem, compose e instalação self-host (janela de VPS)

Publicar imagem Lumenva mantendo tag/alias antigo; testar pull, `docker compose config`, upgrade, restart, volumes, redes, proxy e rollback. Só depois trocar `APP_IMAGE`, diretório e nomes de serviço. Nunca renomear volume/rede em produção sem inventário e backup verificado: pode deixar a instalação viva órfã ou criar stack paralela.

### Fase 5 — env, DNS, CORS, OAuth e webhooks (janela coordenada)

Adicionar leitura dupla `LUMENVA_*`/`DESKCOMM_*`, sincronizar `.env`/Infisical explicitamente, publicar DNS/TLS, atualizar callbacks, cookies, CORS e WAHA, observar logs e manter rollback. Trocar o domínio só com prova de auth, webhook assinado, e-mail e healthcheck pelo domínio final.

### Fase 6 — schema/DB (último, janela de migração)

Somente se houver benefício de produto aprovado: migration forward-only, backfill, aliases/views quando possível, atualização de `baseline.sql`, MANIFEST, tipos gerados, queries, RLS, policies, índices, triggers, grants e realtime. Fazer backup/restore ensaiado, teste cross-tenant e plano de rollback. A decisão atual mantém `crm_*` para evitar este risco.

## 5. Decisão atual e não executado

- Fases 3–8 do audit anterior continuam **desescopadas**: código/paths internos, pacote/imagem Docker, GitHub/docs externos, env/domínios/integrações, schema Supabase e validação final de rename.
- `CRM` funcional e `crm_*` técnico não devem ser substituídos por `Lumenva` sem decisão nova.
- Não houve deploy, acesso à VPS, migração, alteração de env/Infisical, uso de credenciais, alteração de remote Git, commit ou push.
- O clone upstream foi feito somente em `/tmp/upstream-deskcommcrm` com profundidade 1; não foi adicionado como remote ao NOSSO repo.

## 6. Evidência e limites

Comandos principais executados: `rg` por variante/categoria, `git status --short --branch`, comparação byte a byte dos caminhos comuns e `maestri list`. A busca é exaustiva para a árvore acessível, mas não cobre segredos fora do checkout, dados do banco, estado real da VPS, DNS, Infisical ou consumidores externos. Ausência de uma ocorrência no código não prova que não exista referência operacional fora dele.

