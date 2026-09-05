# Runbook — Deploy em produção (VPS)

**GitHub Actions está desabilitado neste repositório (decisão permanente, 2026-08-20).**
`publish-image.yml` não dispara mais — não existe CI publicando imagem no GHCR
automaticamente. O caminho que este runbook chamava de "exceção" (construir a
imagem na própria VPS) é hoje o **único caminho** de deploy. Se um dia isso mudar
(GHCR manual, outro CI), atualize este runbook junto — não deixe duas receitas
divergentes.

---

## 1. O comando

Sem CI publicando imagem, todo deploy constrói na própria VPS. Requisitos: >= 4 GB
de RAM **ou** swap (medido: ~4min num VPS de 3.8 GB com 4 GB de swap).

**Correção (2026-09-02):** 4 GB de swap não é suficiente margem de segurança — um build
real nesta mesma VPS de 3.8 GB estourou a memória durante a etapa de TypeScript check
do `next build` (o build roda `typecheck && test:unit:docker-build && lint:tenant-filter
&& lint:channels && next build` dentro da imagem, tudo isso além dos containers de
produção já rodando). O OOM killer do kernel matou processos de produção no meio do
caminho — **Caddy incluído**, o que derrubou o site por alguns segundos até o Docker
reiniciar os containers sozinho (sem perda de dado, mas foi um incidente real, não
hipotético). Antes de rodar o build numa VPS com essa RAM, garanta **8 GB de swap**, não
4:

```bash
# se só existe /swapfile de 4G, adicione um segundo:
fallocate -l 4G /swapfile2 && chmod 600 /swapfile2 && mkswap /swapfile2 && swapon /swapfile2
# torne permanente no /etc/fstab se ainda não estiver
swapon --show   # confirme 8G total antes de buildar
```

Limpar cache de build antigo (`docker builder prune -af`) antes de um build grande também
ajuda — um cache de builds anteriores chegou a ocupar >20 GB de disco nesta VPS.

**Confirme o path da instalação antes de rodar qualquer coisa** — não é fixo entre
VPS diferentes. A instalação padrão do `hostgator-setup-kit` usa `/root/deskcommcrm`
(confirmado contra a VPS real da Lumenva em 2026-08-22); se a sua instalação usa
outro path, ajuste o `cd` abaixo.

```bash
cd /root/deskcommcrm

# 0) traz o código novo — sem isso o build usa o checkout antigo
git pull origin main

# 1) build local — não existe imagem nova no GHCR pra puxar
APP_IMAGE=deskcomm-app:local docker compose \
  -f docker-compose.prod.yml -f docker-compose.build.yml --env-file .env build app

# 2) sobe com a imagem que acabou de ser construída
APP_IMAGE=deskcomm-app:local APP_PULL_POLICY=never docker compose \
  -f docker-compose.prod.yml --env-file .env \
  --profile ai-memory --profile ai-graph up -d app mem0-postgres mem0 neo4j graphiti
```

Os perfis `ai-memory` e `ai-graph` são incluídos em todo deploy para manter os
quatro sidecars ligados (`restart: unless-stopped`). O comando não usa `down` e
preserva os volumes nomeados `deskcommcrm_mem0-postgres-data` e
`deskcommcrm_neo4j-data`.

`APP_PULL_POLICY=never` é obrigatório no passo 2: sem ele, o compose tenta puxar
`deskcomm-app:local` de um registry (não existe) ou, pior, silenciosamente
substitui a imagem que você acabou de construir pela última do GHCR — revertendo
o deploy sem erro nenhum.

### Qual topologia de proxy a sua VPS usa? Confirme, não presuma.

O stack padrão (o comando acima) sobe um **Caddy próprio** (definido dentro de
`docker-compose.prod.yml`) que publica as portas 80/443 e faz HTTPS automático
via Let's Encrypt. **Esta é a topologia real da VPS da Lumenva** (confirmado
2026-08-22: `docker ps` mostra `deskcommcrm-caddy-1`, sem rede `traefik`
externa) — o comando de dois `-f` documentado numa versão anterior deste runbook
(`-f docker-compose.prod.yml -f docker-compose.traefik.yml`) **não se aplica a
ela** e falha com `network traefik declared as external, but could not be found`.

Só use `docker-compose.traefik.yml` se a sua VPS **já vem** com um Traefik
próprio ocupando as portas 80/443 antes de qualquer deploy do DeskcommCRM —
comum em Hostinger com painel, Coolify, Dokploy, CapRover e afins. Nesse caso,
e SÓ nesse caso:

```bash
APP_IMAGE=deskcomm-app:local APP_PULL_POLICY=never docker compose \
  -f docker-compose.prod.yml -f docker-compose.traefik.yml --env-file .env \
  --profile ai-memory --profile ai-graph up -d app mem0-postgres mem0 neo4j graphiti
```

O cabeçalho de `docker-compose.traefik.yml` explica a equivalência exata com o
Caddyfile. Rodar esse comando numa VPS que não tem uma rede Docker externa
chamada `traefik` falha antes de subir qualquer contêiner (erro acima) — não é
destrutivo, mas não pule a checagem de topologia achando que "os dois `-f` são
sempre mais seguros".

---

## 2. Verificação pós-deploy (não pule)

`healthy` no `docker ps` **não prova que o site está acessível** — o healthcheck
é um probe TCP interno e passa mesmo com o roteamento quebrado. O domínio
responder é a prova real, e vale para as duas topologias:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://<DOMAIN>/
# esperado: 307 (redireciona pro login)
# 404      = roteamento quebrado — veja a checagem específica da sua topologia abaixo
```

**Se usa o Caddy padrão** (comando sem `-f docker-compose.traefik.yml`):

```bash
docker ps --filter name=caddy --format 'table {{.Names}}\t{{.Status}}'
# esperado: Up, sem "(unhealthy)"
docker logs <projeto>-caddy-1 --tail 20
# procure erro de emissão de certificado (ACME) se o curl acima devolver algo
# diferente de 307/redirect — Caddy renova sozinho, mas o container precisa
# estar saudável para servir HTTPS.
```

**Se usa `docker-compose.traefik.yml`** (VPS com Traefik próprio):

```bash
# as labels do Traefik existem no contêiner app?
#    O nome do contêiner é <pasta-do-projeto>-app-1, então pergunte ao compose
#    em vez de chutar.
docker inspect "$(docker compose -f docker-compose.prod.yml ps -q app)" \
  --format '{{.Config.Labels}}' | grep -o 'traefik.enable:[^ ]*'
# esperado: traefik.enable:true   (vazio = roteamento quebrado, refaça o deploy
# com os dois -f — essa é a pegadinha que já derrubou o site em produção em
# 2026-08-05: rodar só com -f docker-compose.prod.yml numa VPS com Traefik
# externo recria o contêiner sem labels nenhuma, e o domínio responde 404
# genérico do Traefik mesmo com a app saudável e no ar)
```

---

## 3. Fluxo completo (do código à produção)

```
commit → push → PR → merge na main → build na VPS → up -d
```

1. **Commit + push** numa branch de feature. Trabalho que fica só no disco da
   VPS não existe: o Git não o vê, some se a VPS for reconstruída, e é invisível
   pra qualquer outra pessoa.
2. **PR e merge na `main`.** Sem CI, isso não dispara nenhum build automático —
   é só o ponto de integração do código.
3. **Deploy na VPS** com os três comandos da seção 1: `git pull` traz o código
   novo pro checkout da VPS, o `build` gera a imagem local, o `up -d` sobe ela.

Cada deploy reconstrói a imagem do zero na VPS — não há cache de camada
compartilhado entre deploys como havia com o registry. Isso é o custo aceito da
decisão de desligar o CI, não um bug deste runbook.
