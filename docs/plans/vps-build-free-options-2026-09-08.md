# Opções gratuitas para retirar o build da VPS

Data: 2026-09-08  
Branch: `audit/vps-rightsizing-2026-09-08`  
Escopo: pesquisa e plano documental. Nenhuma opção foi ativada, nenhum build foi executado e nenhuma alteração foi feita na VPS, no GitHub, no billing ou na visibilidade do repositório.

## Decisão executiva

O repositório `trydavidqix/Lumenva` permanece privado. O registry não é o gargalo: o GHCR é atualmente gratuito para imagens de container, mas a conta GitHub continua sujeita ao bloqueio de billing e às regras de quota do plano. O gargalo é obter um builder privado, `linux/amd64`, sem custo recorrente.

Recomendação principal, em duas verificações sequenciais:

1. O dono deve verificar no GitHub se o saldo devido é zero e se é possível voltar ao plano Free sem pagamento. Se sim, reativar somente o workflow de publicação de imagem, com limites e permissões mínimas; não reativar `ci`, `e2e` ou `perf`.
2. Se existir saldo real que não possa ser removido sem pagar, usar uma VM Oracle Cloud Always Free Ampere A1, dedicada ao build, com `buildx` + QEMU para produzir `linux/amd64` e publicar no GHCR. Esta é a única opção pesquisada que oferece uma máquina privada contínua sem preço mensal depois do trial, embora tenha risco de capacidade e de reclaim por ociosidade. O Mac do dono fica como fallback manual para uma publicação urgente.

O critério de escolha é custo recorrente zero; “free trial”, créditos promocionais e planos que exigem pagamento para manter o serviço não contam como gratuitos.

## Evidência atual do projeto

- O workflow existente `publish-image.yml` publica a imagem da aplicação, mas o runtime também precisa da imagem do worker (`Dockerfile.worker`). O desenho final precisa publicar e versionar as duas imagens.
- A imagem atual é construída na VPS como `deskcomm-app:local`; o histórico documenta cerca de quatro minutos por build e incidente de falta de memória com 4 GB de swap. A VPS observada tem 3,7 GiB de RAM, swap de 8 GiB com cerca de 2,5 GiB usada, e cache de build Docker de 10,83 GiB.
- O builder externo deve receber apenas o contexto necessário. `mem0-src/` deve continuar excluído pelo `.dockerignore`; segredos não podem entrar no contexto, em argumentos de build, em labels ou nos logs.
- O Supabase/Postgres é Supabase Cloud e permanece fora da VPS e fora do builder. Nenhuma migration deve ser executada pelo pipeline de imagem.
- A conclusão é de capacidade, não de execução: não foi feito build neste trabalho e não houve medição nova de tempo no builder externo.

## Tabela comparativa

| Opção | Limite gratuito documentado | Setup | Custo recorrente | Privado `amd64` app + worker | Riscos e conclusão |
|---|---|---|---|---|---|
| GitHub Actions Free + GHCR | Repositório privado no GitHub Free: 2.000 minutos/mês; 500 MB de artifacts; 1 GB de cache/transferência conforme [Product usage included](https://docs.github.com/en/billing/reference/product-usage-included). O uso de Actions é bloqueado sem método de pagamento válido quando a quota é excedida, conforme [Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions). | Baixo, reutiliza workflow; precisa corrigir o bloqueio de billing e acrescentar worker, cache e permissões. | Zero se permanecer dentro da quota; sem pagamento se o saldo for zero. | Sim; runners Ubuntu hospedam `linux/amd64` nativo. 2.000 min/mês é folgado para builds de aproximadamente 4–6 min, mas deve ser medido. | Melhor integração e menor operação. Hoje bloqueado; saldo devido pode impedir remoção do cartão e reativação. Primeira verificação, não assumir que está disponível. |
| GitLab CI Free | Namespace Free: 400 compute minutes/mês; Linux x86 pequeno usa fator 1, conforme [compute minutes](https://docs.gitlab.com/ci/pipelines/compute_minutes/). Programa Open Source oferece 50.000 min, mas exige projeto elegível e visibilidade pública (com exceções que não garantem este caso), conforme [Community programs](https://docs.gitlab.com/subscriptions/community_programs/). | Médio: mirror ou migração, registry/runner, secrets e proteção de branch. | Zero no plano Free dentro dos 400 min; não há garantia de que a conta privada tenha minutos suficientes para builds frequentes. | Sim em runner Linux x86, se os 400 min forem suficientes. | Limite pequeno, lock-in de mirror e duplicação de secrets. O programa OSS não é compatível por defeito com o requisito de repositório privado. Não recomendado como principal. |
| CircleCI Free | Plano Free privado pessoal: 30.000 créditos/mês, 1 GB de rede e 2 GB-mês de armazenamento; quando os créditos acabam, builds pessoais ficam bloqueados, conforme [credits](https://circleci.com/docs/guides/plans-pricing/credits/) e [pricing](https://circleci.com/pricing/). | Médio: integração OAuth, config, registry token e cálculo de créditos. | Zero dentro da quota; excedente não deve ser autorizado. | Sim em Linux; conversão crédito/minuto depende da classe da máquina e deve ser medida. | Quota mais interessante que GitLab, mas serviço externo e lock-in. Validar que a organização é pessoal e que não existe método de overage. Candidato secundário. |
| Google Cloud Build | 2.500 build-minutos/mês; default documentado `e2-standard-2` (2 vCPU/8 GB), conforme [pricing](https://cloud.google.com/build/pricing). | Médio/alto: projeto Google Cloud, billing account, Artifact Registry ou GHCR, IAM, quotas e budget. | A quota é gratuita, mas exige conta de billing; erro de configuração pode gerar cobrança. | Sim, Docker nativo e memória superior à VPS. | Bom tecnicamente, mas falha o requisito de risco financeiro zero sem budget/hard stop e sem uma conta de billing controlada. Não recomendado sob “não pagar nada”. |
| Oracle Cloud Always Free A1 | Até 1.500 OCPU-horas e 9.000 GB-horas/mês, equivalente a 2 OCPU/12 GB em A1; até 200 GB de block storage, conforme [Always Free resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm). Exige cartão na criação na maioria das regiões. | Alto: tenancy, rede, VM ARM64, Docker/buildx/QEMU, token de registry, hardening e monitorização. | Sem preço mensal após o trial dentro dos limites Always Free; não confundir com os recursos pagos. | Sim via cross-build `linux/amd64`; 12 GB dá margem sobre a VPS, mas QEMU torna o build mais lento. A VM AMD micro de 1 GB não serve para este build. | Melhor opção contínua quando GitHub está bloqueado. Oracle pode apresentar falta de capacidade e pode reclaimar instâncias Always Free com uso muito baixo por 7 dias; ver [Free Tier](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier.htm). Exige aceitar dependência Oracle e risco ARM/QEMU. Recomendação de fallback contínuo. |
| Cirrus CI | Gratuito para repositórios públicos; conta privada pessoal custa US$10/mês, conforme [pricing](https://cirrus-ci.org/pricing/). | Baixo/médio. | Não é zero para privado. | Tecnicamente sim, financeiramente não. | Rejeitado pelo requisito de custo recorrente zero. |
| Codeberg + Woodpecker | Codeberg fornece infraestrutura comunitária e acesso a CI mediante pedido; não há quota privada hospedada garantida na documentação pública, conforme [FAQ](https://docs.codeberg.org/getting-started/faq/). Woodpecker é software livre que normalmente requer agente próprio, conforme [local backend](https://woodpecker-ci.org/docs/3.15/administration/configuration/backends/local). | Alto: servidor/agente, runners e manutenção. | O software é gratuito; a máquina não é. | Sim apenas com runner próprio. | Não é builder hospedado gratuito garantido. Um runner local não-isolado expõe secrets a jobs confiáveis apenas. Rejeitado como solução pronta. |
| Depot.dev | O plano Developer lista 500 Docker build minutes, 2.000 GitHub Actions minutes e cache/registry, mas é um plano pago/trial, conforme [pricing](https://depot.dev/pricing). | Baixo. | Não é zero garantido; excedentes são faturáveis. | Sim. | Boa ergonomia, mas não cumpre “100% grátis” de forma permanente. Rejeitado. |
| Mac do dono + Docker/Colima + buildx | Não há quota de serviço: usa hardware já existente. `buildx` pode emular `linux/amd64` via QEMU. | Médio: instalar/autorizar Docker Desktop ou Colima/QEMU, login no registry, workflow manual e Mac ligado. | Zero recorrente se o hardware/software já estiver disponível; instalação/download requer autorização explícita. | Sim, mas emulação pode ser várias vezes mais lenta e o Mac precisa permanecer ligado durante o build. | Sem reclaim de cloud e sem cobrança de CI; não é unattended e transforma o Mac em ponto operacional. Melhor fallback imediato, não o builder de produção contínua. |

## Billing do GitHub: verificação sem pagar

Nada desta seção foi executado. O dono deve fazer a verificação manualmente:

1. No GitHub, avatar → **Settings** → **Billing & licensing**. Se a cobrança pertence a uma organização, abrir a organização → **Settings** → **Billing & Licensing** como owner ou billing manager.
2. Na página **Overview**, conferir o plano atual, estado de conta bloqueada e qualquer **amount due/past-due balance**.
3. Abrir **Payment information** e **Invoices/Payments** (os nomes podem variar por conta) e confirmar se há uso faturável no mês atual ou anterior. Não introduzir cartão novo apenas para testar.
4. Se o saldo for zero e não houver uso faturável pendente, seguir o caminho documentado: **Current plan → Edit → Downgrade to Free**, conforme [Downgrade plan](https://docs.github.com/en/billing/how-tos/manage-plan-and-licenses/downgrade-plan). Depois confirmar que o plano é Free e que Actions aparece disponível.
5. Só depois de saldo zero e plano Free, remover o método de pagamento em **Payment information**. A documentação de [locked account](https://docs.github.com/en/billing/how-tos/troubleshooting/locked-account) diz que a remoção requer saldo zero e nenhum uso medido faturável atual ou do mês anterior; se a UI impedir, não insistir nem adicionar cartão.
6. Criar um budget de Actions com limite de **US$0** e a opção **Stop usage when budget limit is reached**, conforme [set up budgets](https://docs.github.com/en/billing/how-tos/set-up-budgets?apiVersion=2022-11-28). O budget evita novo overage; não apaga saldo passado.
7. Se houver dívida real, se **Downgrade to Free** não estiver disponível, ou se a remoção do pagamento continuar bloqueada, considerar GitHub Actions indisponível sem pagamento. Não reativar workflows nesse estado. GitHub Support é a única via para contestar um saldo; não há garantia de perdão.

O facto de `67dff648` registrar “recent account payments have failed” prova o bloqueio histórico, mas não prova que o saldo atual seja zero. A UI de billing é a fonte atual necessária.

## Registry: onde publicar

### GHCR

O [GitHub Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry) suporta imagens privadas ligadas ao repositório. A página de [GitHub Packages billing](https://docs.github.com/en/billing/concepts/product-billing/github-packages) informa que armazenamento e bandwidth de container registry estão atualmente gratuitos; a política pode mudar com aviso. O uso privado continua sujeito ao estado de billing e às quotas do plano: sem método de pagamento válido, a conta pode ser bloqueada quando atingir a quota incluída.

Para pull privado na VPS, usar um token de máquina com apenas `read:packages` (ou credencial equivalente de deploy), nunca um token pessoal amplo. O token deve viver somente no mecanismo de secret da VPS e não no repositório, no build context ou no log. O package deve ser ligado ao repositório privado e ter permissões explícitas de leitura.

### Docker Hub

O [Docker Hub usage](https://docs.docker.com/docker-hub/usage/) oferece conta Personal gratuita, mas limita a uma repository privada e pull autenticado pessoal a 200 pulls por janela de 6 horas, conforme [pull limits](https://docs.docker.com/docker-hub/usage/pulls/). Duas imagens podem ser tags de um único repositório privado, mas a política, a retenção e o rate limit tornam-no menos previsível para deploys. Só usar com token separado e pull autenticado.

### Quay.io

As docs oficiais confirmam permissões de repositório privado ([repository permissions](https://docs.quay.io/guides/repo-permissions.html)) e robot/access tokens ([API](https://docs.quay.io/api/)), mas não encontrei nessas docs uma quota pública atual que garanta registry privado gratuito. Sem esse número, Quay não é a escolha auditável para custo zero.

Conclusão: GHCR é o registry preferido, condicionado à recuperação do billing; Docker Hub é fallback de registry, não solução para o builder; Quay fica fora até existir confirmação de quota na conta.

## Recomendação técnica

### Caminho recomendado no estado atual: Oracle A1 + GHCR

Se a verificação do GitHub não confirmar saldo zero e downgrade sem pagamento, provisionar uma A1 Always Free com 2 OCPU/12 GB como builder dedicado. Ela não deve hospedar tráfego, banco, WAHA ou dados de produção. O pipeline seria:

```text
push/tag autorizado
  -> builder A1 ARM64 (buildx + QEMU)
  -> imagem app linux/amd64 + imagem worker linux/amd64
  -> GHCR privado, tags por SHA e digest
  -> VPS faz docker login read-only e pull por digest
  -> compose atualiza app/worker sem compilar
```

A1 é recomendada sobre AMD micro porque 1 GB não é suficiente para este build e sobre Mac porque permite execução unattended. A aceitação explícita do dono é necessária para o cartão Oracle, o risco de capacidade/reclaim e a operação de uma VM adicional. Se esse risco não for aceitável, escolher Mac manual, não fingir que existe um CI privado contínuo gratuito garantido.

Se GitHub voltar ao Free sem pagamento, a recomendação muda para **GitHub Actions + GHCR**, por ter runner amd64, menor superfície operacional e cache integrado. Mesmo nesse caso, publicar app e worker separadamente, fixar digest e manter o budget de US$0.

## Passo a passo proposto

Cada passo abaixo é plano futuro. Nenhum foi executado.

### Passo 0 — decisão e pre-check

- **PRECISA DONO.** Confirmar por escrito se “saldo zero + Free” aparece no GitHub; guardar screenshot sem dados de pagamento.
- Confirmar que o repositório continua privado e que o workflow de gates permanece desativado por decisão consciente.
- Confirmar que `pnpm gov:verify` local é o gate de qualidade aceito; `ci`, `e2e` e `perf` ficam OFF de propósito, não por acidente.
- Abort: qualquer cobrança pendente, quota desconhecida ou pedido de cartão que contradiga custo zero.

### Passo 1 — escolher o builder

- Se GitHub Free estiver funcional: habilitar apenas a publicação de imagem após revisão do workflow.
- Caso contrário, **PRECISA DONO** para criar Oracle A1 Always Free ou autorizar uso do Mac. Verificar região, capacidade, 2 OCPU/12 GB, disco e firewall sem abrir portas públicas desnecessárias.
- No caso Oracle, instalar somente ferramentas autorizadas e fixar a plataforma do builder. O download de Docker/QEMU requer autorização explícita antes de começar.
- Abort: VM ARM sem capacidade, memória inferior a 12 GB, cobrança fora do Always Free ou necessidade de expor daemon Docker.

### Passo 2 — preparar build reprodutível

- **PRECISA DONO.** Revisar workflow/script para construir ambos: `Dockerfile` (app) e `Dockerfile.worker` (worker), com `--platform linux/amd64`.
- Usar tags imutáveis por commit e capturar os dois digests. Não passar secrets por `ARG`, `ENV`, `--build-arg`, `RUN`, cache ou artifact.
- Manter `.dockerignore` com `mem0-src/`, `.env*`, chaves, dumps e dados locais.
- Rodar somente `pnpm gov:verify` no ambiente autorizado; o build é a prova do builder, não `docker exec` no container de runtime.
- Abort: qualquer secret no contexto/log, digest ausente, imagem de plataforma errada ou falha de reprodutibilidade.

### Passo 3 — autenticar e publicar

- **PRECISA DONO.** Criar token mínimo de push no builder (`packages:write` no GHCR ou equivalente). Guardá-lo no secret store do builder; nunca commitá-lo.
- Publicar `app` e `worker` no GHCR privado, aplicar retenção por digest/tag e registrar os digests.
- Revogar o token de push após validar a publicação, se o modo de operação permitir; manter token de pull separado.
- Abort: package público, permissão excessiva, log contendo token ou quota/billing inesperado.

### Passo 4 — preparar pull na VPS

- **PRECISA DONO + JANELA DE PRODUÇÃO.** Fazer backup verificado da configuração de produção e confirmar que o token read-only já existe sem imprimir o valor.
- O token de pull do GHCR deve ser tratado como segredo da VPS. `docker login ghcr.io` grava credenciais em `~/.docker/config.json` do utilizador que executa o comando; o formato base64 não é cifrado. Usar permissões de ficheiro restritas, preferir um credential helper quando disponível e nunca colar o conteúdo em logs.
- Alterar apenas `APP_IMAGE`/imagem worker para referências por digest e manter `APP_PULL_POLICY=missing`. Com digest imutável, `missing` é suficiente e mais resiliente que `always`: um restart não falha apenas porque o GHCR está temporariamente inacessível. O pull inicial/rollout deve ser explícito e verificado.
- Abort: pull não autenticado, digest inexistente, alteração de volumes/rede, ou necessidade de `docker compose down`.

### Passo 5 — rollout e rollback

- **PRECISA DONO + JANELA DE PRODUÇÃO.** Fazer pull das duas imagens, verificar digest local, atualizar app e worker um de cada vez conforme o runbook existente; não reconstruir na VPS.
- Validar healthchecks, HTTP público, logs sem erro novo e continuidade de WAHA/Redis/Caddy. Não aplicar migrations.
- Rollback: restaurar os dois digests anteriores, fazer pull explícito e reiniciar somente os serviços afetados; não remover volumes e não usar `docker system prune`.
- Abort: qualquer healthcheck vermelho, aumento de erro HTTP, perda de sessão WAHA, pressão de memória anormal ou divergência de digest.

## Segurança e custos

- GHCR privado, tokens separados para push e pull, menor privilégio e rotação documentada.
- Nunca registrar valores de secrets, `~/.docker/config.json`, tokens, URLs com credenciais ou conteúdo de `.env`.
- A VM de build não recebe `.env` de produção, chaves Supabase, credenciais WAHA, dados de clientes ou volumes. O build deve ser puramente de código e dependências públicas/lockfile.
- GitHub Actions, GitLab, CircleCI e Cloud Build precisam de hard stop de quota; ausência de cobrança observada não é prova de custo zero futuro.
- Asterisk continua fora dos 11 containers e consome RAM da VPS; remover o build da VPS reduz pico de memória, mas não resolve sozinho o orçamento total.

## Top 3 trade-offs

1. **Operação versus custo:** Oracle A1 evita custo mensal, mas adiciona VM, hardening, monitorização e risco de reclaim; GitHub Actions é mais simples, mas depende de billing desbloqueado.
2. **Arquitetura versus velocidade:** A1 ARM64 com QEMU produz o `amd64` necessário, porém pode ser mais lento e mais difícil de diagnosticar que runner amd64; Mac é simples para emergência, mas depende de o computador estar ligado.
3. **Resiliência versus disponibilidade do registry:** GHCR + digest + `APP_PULL_POLICY=missing` evita rebuild e tolera indisponibilidade durante restart, mas o primeiro pull e qualquer rollout continuam dependentes do token, da quota e da disponibilidade do GHCR.

## Fontes oficiais consultadas

- [GitHub Product usage included](https://docs.github.com/en/billing/reference/product-usage-included)
- [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
- [GitHub locked account](https://docs.github.com/en/billing/how-tos/troubleshooting/locked-account)
- [GitHub downgrade plan](https://docs.github.com/en/billing/how-tos/manage-plan-and-licenses/downgrade-plan)
- [GitHub budgets](https://docs.github.com/en/billing/how-tos/set-up-budgets?apiVersion=2022-11-28)
- [GitHub Packages billing](https://docs.github.com/en/billing/concepts/product-billing/github-packages)
- [GitHub Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [GitLab compute minutes](https://docs.gitlab.com/ci/pipelines/compute_minutes/)
- [GitLab Community programs](https://docs.gitlab.com/subscriptions/community_programs/)
- [CircleCI credits](https://circleci.com/docs/guides/plans-pricing/credits/)
- [CircleCI pricing](https://circleci.com/pricing/)
- [Google Cloud Build pricing](https://cloud.google.com/build/pricing)
- [Oracle Always Free resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)
- [Oracle Free Tier](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier.htm)
- [Cirrus pricing](https://cirrus-ci.org/pricing/)
- [Codeberg FAQ](https://docs.codeberg.org/getting-started/faq/)
- [Woodpecker local backend](https://woodpecker-ci.org/docs/3.15/administration/configuration/backends/local)
- [Depot pricing](https://depot.dev/pricing)
- [Docker Hub usage](https://docs.docker.com/docker-hub/usage/)
- [Docker Hub pull limits](https://docs.docker.com/docker-hub/usage/pulls/)
- [Quay repository permissions](https://docs.quay.io/guides/repo-permissions.html)
- [Quay API and robot tokens](https://docs.quay.io/api/)
