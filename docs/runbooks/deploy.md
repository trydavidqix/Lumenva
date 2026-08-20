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

```bash
cd /var/www/crm

# 0) traz o código novo — sem isso o build usa o checkout antigo
git pull origin main

# 1) build local — não existe imagem nova no GHCR pra puxar
APP_IMAGE=deskcomm-app:local docker compose \
  -f docker-compose.prod.yml -f docker-compose.build.yml --env-file .env build app

# 2) sobe com a imagem que acabou de ser construída
APP_IMAGE=deskcomm-app:local APP_PULL_POLICY=never docker compose \
  -f docker-compose.prod.yml -f docker-compose.traefik.yml --env-file .env up -d app
```

`APP_PULL_POLICY=never` é obrigatório no passo 2: sem ele, o compose tenta puxar
`deskcomm-app:local` de um registry (não existe) ou, pior, silenciosamente
substitui a imagem que você acabou de construir pela última do GHCR — revertendo
o deploy sem erro nenhum.

### Os DOIS `-f` são obrigatórios no passo 2. Sempre.

Esta é a pegadinha que já derrubou o site inteiro em produção (2026-08-05).

A VPS (Hostinger) vem com um **Traefik próprio** ocupando as portas 80/443.
`docker-compose.traefik.yml` é o ÚNICO lugar que:

- coloca no contêiner `app` as labels de roteamento
  (`traefik.http.routers.deskcomm.rule=Host(...)`);
- associa o contêiner à rede que o Traefik enxerga (`TRAEFIK_DOCKER_NETWORK`);
- desliga o `caddy` do compose base por profile (senão dois processos brigam
  pela mesma porta).

Rodar só com `-f docker-compose.prod.yml` recria o contêiner **sem labels
nenhuma**. O Traefik deixa de enxergá-lo e o domínio inteiro passa a responder
`404 page not found` — não é erro do Next, é o 404 genérico do Traefik. A app
está no ar, saudável, e inalcançável.

---

## 2. Verificação pós-deploy (não pule)

`healthy` no `docker ps` **não prova que o site está acessível** — o healthcheck
é um probe TCP interno e passa mesmo com o roteamento quebrado. Verifique as
duas coisas:

```bash
# 1) as labels do Traefik existem?
#    O nome do contêiner é <pasta-do-projeto>-app-1, então pergunte ao compose
#    em vez de chutar. Aqui um -f só basta: o `ps -q` resolve pelo nome do
#    projeto + serviço, não pelo conteúdo do arquivo (medido: com um -f ou com
#    os dois, devolve o MESMO contêiner). Quem precisa dos dois é o `up -d`.
docker inspect "$(docker compose -f docker-compose.prod.yml ps -q app)" \
  --format '{{.Config.Labels}}' | grep -o 'traefik.enable:[^ ]*'
# esperado: traefik.enable:true   (vazio = roteamento quebrado)

# 2) o domínio responde?
curl -s -o /dev/null -w "%{http_code}\n" https://<DOMAIN>/
# esperado: 307 (redireciona pro login)
# 404      = labels perdidas, refaça o deploy com os dois -f
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
