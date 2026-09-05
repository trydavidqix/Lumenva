# Auditoria de renomeação: DeskcommCRM/CRM para Lumenva

**Data:** 2026-08-31  
**Checkout auditado:** `/Users/david/Desktop/Projetos/CRM/DeskcommCRM`  
**Branch observada:** `main`  
**HEAD:** `56260cea7736b9133db2fd816e5fdb8c5df3fa7f`  
**Escopo:** somente auditoria; nenhum arquivo de código, schema, configuração, branch, banco ou infraestrutura foi alterado.

> **Decisão do dono do repositório, 2026-09-04:** escopo do rename fechado em **Fase 0-2**
> (inventário + cosmético local + branding público). Fases 3-8 (código/paths internos,
> pacote/imagem Docker, GitHub/docs externos, env vars/domínios/integrações, schema
> Supabase, validação final) **não serão executadas** — não trazem benefício visível ao
> cliente e carregam risco real (especialmente Fase 7, renomear schema) sem payoff. O plano
> abaixo permanece como referência caso a decisão mude no futuro (ex.: abrir código, vender
> o pacote com outro nome), mas não é mais o roteiro ativo além da Fase 2.

## 1. Confirmação do repositório e estado

`git rev-parse --show-toplevel` retornou:

```text
/Users/david/Desktop/Projetos/CRM/DeskcommCRM
```

`/Users/david/Desktop/Projetos/CRM` é a pasta contêiner; o repositório real é a subpasta `DeskcommCRM`.

O estado inicial observado foi:

```text
## main...origin/main
?? .infisical.json
?? docs/audits/
```

`.infisical.json` e `docs/audits/` já estavam fora do índice antes deste relatório. Foram preservados. Não houve `git reset`, `checkout`, `clean`, `stash`, merge, rebase, commit, push, instalação, download, migração ou ação externa.

`maestri list` foi tentado antes da auditoria, mas o executável não está disponível neste ambiente:

```text
zsh: command not found: maestri
```

## 2. Cobertura de branches e referências

Foram inventariadas referências locais e remotas com `git for-each-ref`, incluindo `refs/heads/*`, `origin/*` e `upstream/*`. O inventário contém 131 referências e 105 objetos SHA distintos.

Branches e referências que carregam explicitamente a identidade:

- `main` e `origin/main`;
- `codex/agent-os-crm-integration-plan`;
- `codex/crm-consolidated` e `origin/codex/crm-consolidated`;
- `codex/voice-crm-config`;
- `gpt-lumenva-content-os` e `origin/gpt-lumenva-content-os`;
- `upstream/feat/crm-vivo`;
- `upstream/ecc-tools/DeskcommCRM-1783368833211`.

As demais branches de `agent-os`, `voice-*`, `implementacao-*`, `docs/*`, `fix/*`, `triagem/*` e `release/*` também devem ser consideradas no plano porque contêm árvores e documentação derivadas do mesmo projeto. Uma substituição feita somente na `main` não cobre branches de trabalho, release ou histórico.

A busca agregada nas referências locais/remotas encontrou 19.776 correspondências de `crm` e variações. O termo `CRM` também aparece como categoria funcional; portanto, a contagem não deve ser interpretada como número de itens a renomear. Cada ocorrência precisa ser classificada por função e contrato.

## 3. Vocabulário recomendado

Antes de qualquer mudança, fixar este vocabulário:

- **Marca pública:** `Lumenva`.
- **Categoria/área funcional:** `CRM`.
- **Nome técnico legado:** `DeskcommCRM`.
- **Pacote legado:** `deskcomm-crm`.
- **Namespace de banco legado:** `crm_`.
- **Nome de exibição recomendado:** `Lumenva` ou `Lumenva CRM`, conforme o contexto.

Não é saudável substituir todo `CRM` por `Lumenva`: em frases como “CRM de vendas”, em nomes de tabelas e em contratos de domínio, `CRM` descreve a capacidade, não a marca.

## 4. Itens ARRISCADOS

ARRISCADO significa que a troca pode quebrar dados, instalações vivas, integrações externas, autenticação, deploy, contratos públicos ou consumidores que não estão sob controle deste checkout.

### 4.1 Supabase `project_id`

Arquivo: `supabase/config.toml:5`.

Ocorrência:

```toml
project_id = "deskcomm-crm"
```

Se esse identificador corresponder a um projeto Supabase existente, a troca não é cosmética. O valor pode estar ligado a deploys, secrets, CLI, pipelines, ambientes e documentação operacional. Não alterar sem confirmar o projeto real, os consumidores e a estratégia de migração. Criar outro projeto exige migração de dados, secrets, URLs, autenticação e rollback.

**Risco:** ARRISCADO.

### 4.2 Tabelas e objetos de banco com prefixo `crm_`

Arquivos principais: `supabase/baseline.sql` e migrations `supabase/migrations/*_crm_*.sql`.

Tabelas canônicas encontradas:

- `public.crm_leads`;
- `public.crm_pipelines`;
- `public.crm_stages`;
- `public.crm_lead_activities`;
- `public.crm_lead_links`;
- `public.crm_lead_scores`;
- `public.crm_lead_risk_states`;
- tabelas relacionadas a reativação e atividades com referências `crm_*`.

O baseline cria as tabelas em `supabase/baseline.sql:1424-1538`. Chaves primárias e constraints aparecem em `:2060-2081`; índices e índices únicos em `:2394-2646`; triggers em `:2718-2786`; foreign keys em `:3035-3091`; RLS em `:3327-3339`; policies em `:3498-3518`; grants em `:3827-3853`; e publicação/realtime em `:4086`.

Funções, triggers, índices, constraints e políticas incluem nomes como:

- `fn_crm_lead_close_on_stage`;
- `trg_crm_lead_close_on_stage`;
- `trg_crm_leads_updated_at`;
- `trg_crm_pipelines_updated_at`;
- `trg_crm_stages_updated_at`;
- `uniq_crm_lead_links_lead_target_link`;
- `uniq_crm_leads_org_source_external`;
- `uniq_crm_pipelines_org_default`;
- `uniq_crm_pipelines_org_slug`;
- `uniq_crm_stages_pipeline_slug`;
- `uniq_crm_stages_pipeline_won`;
- `uniq_crm_stages_pipeline_lost`;
- `idx_crm_leads_*`;
- `idx_crm_pipelines_*`;
- `idx_crm_stages_*`;
- constraints como `crm_leads_status_enum` e `crm_stages_won_lost_mutex`.

O código usa diretamente `.from("crm_leads")`, `.from("crm_pipelines")`, `.from("crm_stages")`, `.from("crm_lead_activities")` e consultas relacionais do Supabase. Testes também verificam nomes de tabela e mensagens de erro com esses identificadores.

**Risco:** ARRISCADO.

Não usar busca-substituição nem `DROP TABLE` + `CREATE TABLE`. Se uma troca de namespace for realmente aprovada, usar migration incremental com `ALTER TABLE ... RENAME`, atualizar funções, triggers, constraints, índices, foreign keys, RLS, grants, realtime, tipos gerados e todas as queries. A recomendação é manter `crm_*` como namespace técnico e trocar apenas a marca pública.

### 4.3 Imagem Docker publicada

Ocorrências:

- `.env.hostgator.example:13`:

  ```text
  APP_IMAGE=ghcr.io/melgarafael/deskcommcrm:latest
  ```

- `docker-compose.prod.yml:19`:

  ```yaml
  image: ${APP_IMAGE:-ghcr.io/melgarafael/deskcommcrm:latest}
  ```

- `hostgator-setup-kit/update.sh:50,158`;
- `hostgator-setup-kit/install.sh:892`;
- `CHANGELOG.md:272`.

Instalações self-host podem fazer pull desse caminho. Renomear a imagem sem manter uma tag/alias quebra novos boots, atualizações e recuperação de VPS.

**Risco:** ARRISCADO.

Estratégia: publicar a imagem Lumenva, manter a referência antiga como alias durante a transição, alterar `APP_IMAGE` por instalação e só retirar o nome antigo depois de validar pull, upgrade e rollback.

### 4.4 Repositório GitHub e URLs de código

Ocorrências principais:

- `https://github.com/melgarafael/DeskcommCRM`;
- `https://github.com/melgarafael/DeskcommCRM.git`.

Arquivos: `README.md`, `README.en.md`, `README.es.md`, `SECURITY.md`, `CONTRIBUTING.md`, `.github/ISSUE_TEMPLATE/*`, `CHANGELOG.md`, `public/llms.txt`, `hostgator-setup-kit/comecar.sh`, `hostgator-setup-kit/install.sh`, docs de deploy e testes de harness.

Esses links servem para clone, issues, security advisories, releases, documentação e scripts de instalação. Se o repositório for renomeado, é necessário confirmar o redirect do GitHub, atualizar workflows e preservar compatibilidade.

**Risco:** ARRISCADO.

### 4.5 Domínios, subdomínios e e-mails

Foram encontrados domínios e endereços potencialmente operacionais:

- `deskcomm.com.br`;
- `crm.deskcomm.com.br`;
- `app.deskcomm.com.br`;
- `admin.deskcomm.com.br`;
- `api.deskcomm.com`;
- `waha.deskcomm.com.br`;
- `status.deskcomm.com`;
- `support@deskcomm.com.br`;
- `ops@deskcomm.com.br`;
- `contato@deskcomm.com.br`.

Também há produção documentada em `https://crm.lumenva.pt/`, que deve ser tratada como domínio real até prova em contrário.

Referências relevantes:

- `app/account-suspended/page.tsx:17`;
- `hostgator-setup-kit/test-validators.sh:388,399`;
- `docs/specs/08-spec-deploy-observability.md:47`;
- `docs/runbooks/waha-hostgator.md:109-190`;
- `docs/growth/awesome-selfhosted-deskcommcrm.yml:17`;
- `docs/current-state.md`.

Trocar domínio exige DNS, certificados, redirects, canonical URL, OAuth callbacks, CORS, cookies, WAHA webhooks, Caddy/Traefik, monitoramento e e-mail.

**Risco:** ARRISCADO para domínios reais, `AUTH_COOKIE_DOMAIN`, callbacks, webhooks e e-mails; SEGURO apenas para exemplos explicitamente fictícios.

### 4.6 Variáveis de ambiente com dependências externas

Valores e variáveis que podem participar de contratos vivos:

- `APP_IMAGE`;
- `DOMAIN`;
- `NEXT_PUBLIC_APP_URL`;
- `NEXT_PUBLIC_ADMIN_URL`;
- `WAHA_API_BASE_URL`;
- `WAHA_WEBHOOK_BASE_URL`;
- `AUTH_COOKIE_DOMAIN`;
- `NEXT_PUBLIC_ADMIN_HOST` documentada nas specs.

Exemplos aparecem em `.env.example:43-56,220-224`, `.env.hostgator.example:13,19,64-67` e nas docs de deploy.

Renomear o nome da variável ou trocar seu valor pode quebrar deploy, OAuth, cookies, CORS, webhooks, jobs e integrações. Manter aliases de leitura durante a transição.

**Risco:** ARRISCADO quando a instalação ou sistema externo já depende da variável.

### 4.7 Diretório de instalação no VPS e scripts de upgrade

Ocorrências:

- `hostgator-setup-kit/install.sh:22` → `REPO_DIR=deskcommcrm`;
- `hostgator-setup-kit/comecar.sh:148-149` → clona e entra em `deskcommcrm`;
- `hostgator-setup-kit/_common.sh:272,394`;
- `hostgator-setup-kit/backup.sh:5`;
- `hostgator-setup-kit/test-validators.sh:999-1005`;
- referências a `deskcommcrm-setup-kit.zip` no `.gitignore`.

O diretório é usado por instalação, update, backup, cron, volumes e operadores. Renomeá-lo sem compatibilidade pode criar uma segunda instalação ou deixar a antiga sem manutenção.

**Risco:** ARRISCADO para instalações existentes; MÉDIO para documentação e scripts não usados.

## 5. Itens MÉDIOS

MÉDIO significa que a troca é possível, mas exige atualização coordenada de imports, testes, manifests, configurações ou contratos internos.

### 5.1 Caminhos e arquivos de código

Ocorrências atuais:

- `.agents/skills/DeskcommCRM/`;
- `.claude/skills/DeskcommCRM/`;
- `app/api/v1/contacts/[id]/crm-summary/`;
- `components/inbox/CRMSidePanel.tsx`;
- `docs/architecture/crm-vivo.architecture.json`;
- `docs/examples/n8n/crm-lead-created.md`;
- `docs/examples/n8n/crm-read-write.md`;
- `docs/growth/awesome-selfhosted-deskcommcrm.yml`;
- `docs/handoffs/BRIEFING-crm-vivo.md`;
- `docs/handoffs/HANDOFF-crm-vivo.md`;
- `lib/agent-engine/edge/crm/`;
- `lib/agent-engine/product-agents/crm-operator.ts`;
- `lib/followup/retorno-crm.ts`;
- `scripts/seed-crm-vivo.ts`;
- `website/app/solucoes/vendas-crm/`;
- `website/components/sections/VendasCrmMockup.tsx`;
- `website/components/sections/VendasCrmMockup.module.css`;
- `hooks/notifications/useCrmAlerts.ts` em branches alternativas;
- `.specs/features/crm-automacao-fluxos/*` em branches alternativas.

Renomear exige atualização atômica de imports, aliases, testes, snapshots, harness e documentação.

**Risco:** MÉDIO.

### 5.2 Skills, adapters e manifests

Arquivos e referências:

- `.agents/skills/DeskcommCRM/SKILL.md`;
- `.agents/skills/DeskcommCRM/agents/openai.yaml`;
- `.claude/skills/DeskcommCRM/SKILL.md`;
- `.claude/homunculus/instincts/inherited/DeskcommCRM-instincts.yaml`;
- `.codex/AGENTS.md`;
- `.claude/ecc-tools.json`;
- `.claude/rules/*`.

Esses caminhos são carregados por ferramentas. Renomear a pasta sem atualizar manifests pode impedir carregamento de skills, roteamento de agentes e validações.

**Risco:** MÉDIO; ARRISCADO se o caminho estiver embutido em automação de produção.

### 5.3 Valores de API, MCP, eventos e auditoria

Ocorrências no código:

- `crm_create_lead`;
- `crm_send_whatsapp_message`;
- `sourceModule: "crm"`;
- `resourceType: "crm_lead"`;
- `p_entity_kind: "crm_lead"`;
- `resource: "crm_leads"`;
- `crm_pipeline`;
- `crm_stage`.

Se forem apenas internos, podem receber aliases. Se forem enviados por MCP, webhooks, eventos, logs consumidos por terceiros ou clientes self-host, são contratos públicos e devem ser versionados.

**Risco:** MÉDIO internamente; ARRISCADO quando público, persistido ou consumido externamente.

### 5.4 Docker local e roteamento Traefik

Ocorrências:

- `deskcomm-app:local` em `docker-compose.build.yml`;
- `deskcomm-waha` em `docker-compose.yml`;
- `deskcomm-agent-worker` em `docker-compose.yml`;
- routers/services/middlewares `deskcomm`, `deskcomm-compress`, `deskcomm-waha-block`, `deskcomm-deny`, `deskcomm-http`, `deskcomm-https` em `docker-compose.traefik.yml`.

Comentários são SEGUROS isoladamente. Nomes usados em labels, volumes, scripts e comandos de operação exigem atualização conjunta.

**Risco:** MÉDIO para stacks locais controladas; ARRISCADO para stacks existentes.

### 5.5 Chaves persistidas no browser

`app/layout.tsx:57` lê:

```ts
localStorage.getItem('deskcomm-theme')
```

Trocar a chave sem ler e migrar a chave antiga perde a preferência de tema dos usuários. Se a troca for desejada, implementar leitura dupla e escrita na chave nova durante uma janela.

**Risco:** MÉDIO.

### 5.6 Package npm raiz

`package.json:2`:

```json
"name": "deskcomm-crm"
```

`package.json:5` contém a descrição `DeskcommCRM`. O pacote está com `"private": true`, portanto não há evidência no manifesto de publicação npm pública. Ainda assim, o nome pode ser consumido por scripts, lockfiles, observabilidade ou ferramentas internas.

`website/package.json` já usa `lumenva-website` e `workers/voice-worker/package.json` já usa `@lumenva/voice-worker`.

**Risco:** MÉDIO até confirmar ausência de consumidores externos; ARRISCADO se houver publicação ou dependência real.

### 5.7 Caminhos absolutos de worktree e loop

Há referências em `loop/loop.config.json`, `loop/RUN.md` e handoffs a caminhos como `/Users/rafaelmelgaco/DeskcommCRM` e worktrees `DeskcommCRM-*`.

Essas referências não são necessariamente o checkout atual, mas podem ser usadas pelo loop, handoffs ou scripts operacionais.

**Risco:** MÉDIO; ARRISCADO se o loop ativo depender do caminho.

## 6. Itens SEGUROS

SEGURO significa cosmético, documental ou configurável, sem alteração de contrato técnico, dados persistidos ou infraestrutura viva.

### 6.1 Marca exibida por `lib/branding.ts`

`lib/branding.ts:19` define:

```ts
DEFAULT_APP_NAME = "DeskcommCRM"
```

O projeto já possui `APP_NAME` para white-label em `.env.example:259` e `.env.hostgator.example:173`. Alterar o default para `Lumenva` é a primeira mudança recomendada, mantendo override por ambiente.

**Risco:** SEGURO.

### 6.2 Metadata e títulos de aplicação

`app/layout.tsx:25-45` usa `branding()` para `title`, `applicationName`, `authors` e keywords. O termo `CRM` em `keywords` pode permanecer como categoria SEO. O website já usa `Lumenva` em `website/app/layout.tsx:17-18`.

Atualizar o nome exibido, título, description e metadata é cosmético, desde que URLs, contratos e nomes de banco permaneçam intactos.

**Risco:** SEGURO.

### 6.3 MFA e nomes amigáveis

`app/actions/auth/enrollMfa.ts:37` usa `friendlyName: \`DeskcommCRM ...\``. É um nome mostrado ao usuário em aplicativo autenticador, não o identificador do tenant nem o segredo TOTP.

**Risco:** SEGURO; considerar manter “Lumenva” para novas inscrições e não invalidar inscrições existentes.

### 6.4 Design system, referências visuais e assets

Itens cosméticos:

- `app/design/layout.tsx`;
- `app/design/page.tsx`;
- `app/design/README.md`;
- `app/design/lib/tokens.ts`;
- `docs/brand/references/crm/`;
- `ref/Lumenva_ CRM e vendas previsíveis.png`;
- `docs/superpowers/plans/2026-08-11-lumenva-crm-fundacao-visual.md`;
- `docs/superpowers/specs/2026-08-11-lumenva-crm-fundacao-visual-design.md`.

Renomear títulos de assets e textos de showcase é SEGURO; referências de arquivo em docs devem ser atualizadas juntas.

### 6.5 Documentação, comentários e textos de posicionamento

Inclui títulos, comentários e prosa em:

- `README.md`, `README.en.md`, `README.es.md`;
- `AGENTS.md`, `CLAUDE.md`, `.codex/AGENTS.md`;
- `ARCHITECTURE.md`, `VISION.md`, `SECURITY.md`, `CONTRIBUTING.md`;
- `CHANGELOG.md` quando a alteração não modificar links operacionais;
- handoffs, plans, specs, pitch deck e docs de produto;
- comentários em Dockerfiles, Compose e scripts;
- `public/llms.txt` depois que os links GitHub forem tratados.

Trocar “DeskcommCRM” por “Lumenva” nesses textos é SEGURO quando não alterar comandos, caminhos, URLs, nomes de tabela, nomes de pacote ou contratos.

### 6.6 E-mails e templates como texto de marca

`supabase/templates/confirmation.html` e `supabase/templates/recovery.html` contêm identidade do produto. Alterar o texto e o nome de exibição é SEGURO, mas deve ser validado com um envio de teste e não deve mudar links de callback sem a migração correspondente.

### 6.7 Exemplos fictícios de domínio

Exemplos como `crm.seudominio.com.br`, `n8n.example.com` e `crm.empresadela.com.br` são SEGUROS para atualização quando estiverem explicitamente marcados como exemplos e não forem usados por testes que dependam da string exata.

## 7. Plano de renomeação por fases

### Fase 0 — Inventário, decisão e congelamento

1. Confirmar marca oficial, categoria funcional e nomes técnicos que serão preservados.
2. Confirmar se `crm.lumenva.pt`, `deskcomm.com.br`, subdomínios, GitHub e GHCR estão ativos.
3. Identificar consumidores de pacote, imagem, domínio, env vars, OAuth, WAHA, Nuvemshop, n8n, MCP e webhooks.
4. Definir quais branches serão migradas: somente `main`, branches ativas, releases ou todas as refs.
5. Registrar SHA, status e inventário antes da primeira alteração.

### Fase 1 — Cosmético local

1. Mudar `DEFAULT_APP_NAME` para `Lumenva`.
2. Atualizar títulos, metadata, headings, e-mails, README, docs, comentários e assets.
3. Atualizar `APP_NAME` default sem remover o override.
4. Manter `CRM` quando representar a categoria funcional.
5. Preservar todos os nomes de tabela, pacote, imagem, domínio, env var e evento.

### Fase 2 — Branding público

1. Atualizar logo, nome exibido e website.
2. Atualizar templates de autenticação e e-mails.
3. Validar metadata, screenshots, links e build.
4. Fazer leitura dupla de chaves persistidas como `deskcomm-theme` se forem renomeadas.

### Fase 3 — Código interno e paths

1. Renomear arquivos e diretórios internos somente quando houver benefício real.
2. Atualizar imports, aliases, testes, fixtures, harness, skills e manifests na mesma mudança.
3. Manter aliases HTTP para rotas públicas que não podem desaparecer.
4. Validar com `pnpm typecheck`, `pnpm lint`, `pnpm test:unit`, `pnpm harness:check` e build.

### Fase 4 — Pacote e artefatos Docker

1. Verificar consumidores do pacote antes de trocar `deskcomm-crm`.
2. Se necessário, publicar nome novo e manter shim/deprecation do nome antigo.
3. Publicar nova imagem Lumenva.
4. Manter `ghcr.io/melgarafael/deskcommcrm:latest` como alias durante a transição.
5. Atualizar `APP_IMAGE`, install, update, backup, cron e runbooks.
6. Validar pull, upgrade, reuso de volumes e rollback.

### Fase 5 — GitHub e documentação externa

1. Renomear o repositório somente com redirect oficial confirmado.
2. Atualizar URLs em docs, issues, security advisories, scripts e `public/llms.txt`.
3. Verificar workflows, webhooks e integrações que apontam para a URL antiga.

### Fase 6 — Variáveis, domínios e integrações

1. Aceitar nomes antigo e novo de variáveis durante a janela de migração.
2. Configurar DNS, TLS, redirects e canonical URL.
3. Atualizar OAuth callbacks, CORS, cookies, WAHA, Nuvemshop, n8n, Sentry, Vercel, Caddy e Traefik.
4. Manter o domínio antigo funcionando até confirmar login, MFA, webhooks, cron e monitoramento no domínio novo.

### Fase 7 — Supabase e schema, somente com decisão explícita

1. Preferir manter `crm_*` como namespace técnico.
2. Se o prefixo precisar mudar, criar migration expand/contract.
3. Usar `ALTER TABLE ... RENAME`, nunca `DROP + CREATE`.
4. Renomear coordenadamente tabelas, índices, constraints, triggers, funções, policies, grants, realtime e tipos gerados.
5. Fazer backup e ensaio em staging.
6. Deployar código compatível com nomes antigos e novos quando possível.
7. Migrar produção em janela controlada, validar RLS, leitura, escrita, workers, filas e rollback.
8. Remover aliases somente após confirmar zero consumidores do legado.

### Fase 8 — Validação final

1. Buscar case-insensitive por `CRM`, `DeskcommCRM`, `deskcomm-crm`, `deskcommcrm`, `deskcomm_crm`, formas kebab, snake e camel em conteúdo e nomes.
2. Repetir a busca em todas as refs selecionadas.
3. Executar typecheck, lint, testes unitários, testes de banco, build, testes do HostGator e harness.
4. Provar instalação nova, upgrade e rollback.
5. Separar evidência local de evidência de provedor, domínio, dispositivo, banco e produção.
6. Só declarar migração concluída com evidência externa específica para GitHub, GHCR, DNS, OAuth, webhooks e banco.

## 8. Decisão recomendada

A estratégia mais segura é:

```text
Marca pública:       Lumenva
Categoria funcional: CRM
Código e banco:      manter crm_* inicialmente
Pacote:              manter deskcomm-crm até haver compatibilidade
Imagem antiga:       manter durante a transição
Domínios antigos:    manter redirects e operação paralela
```

O primeiro lote deve ser exclusivamente cosmético. Banco, pacote, imagem, GitHub, domínios, cookies, webhooks e contratos MCP/API não devem ser alterados por busca-substituição global.

**Resultado da auditoria:** nenhuma alteração de produto ou infraestrutura foi realizada. O relatório é uma análise de risco e plano de migração; a execução requer fases e validações separadas.
