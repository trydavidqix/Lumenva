# Monorepo Lumenva — pacote DONO dos passos 5 e 6

Data: 2026-09-09  
Branch de preparação: `feat/monorepo-migration-2026-09-09`

Este documento é um pacote operacional para o dono. Nada abaixo foi executado por este commit. Cada ação externa está marcada `PRECISA DONO`.

## Pré-condição de validação

Antes de qualquer preview ou transferência, exigir a validação cloud no SHA da branch:

```text
pnpm install --frozen-lockfile
pnpm --filter lumenva-crm exec tsc --noEmit
pnpm --filter lumenva-website exec tsc --noEmit
pnpm --filter lumenva-crm test:unit
pnpm --filter lumenva-website test
pnpm --filter lumenva-crm build
NEXT_PUBLIC_SITE_URL=https://lumenva.pt pnpm --filter lumenva-website build
```

O resultado deve guardar SHA, repositório, branch, Node/pnpm, comando, exit code e falhas. Sem todos os comandos verdes, não promover preview nem produção.

## Passo 5 — Vercel: Root Directory e preview antes de produção

`PRECISA DONO`: acesso de proprietário aos dois projetos Vercel e autorização para alterar configuração.

1. Confirmar no painel que os projetos estão ligados a `github.com/trydavidqix/Lumenva`, e que a branch de produção é a decidida pelo dono.
2. Definir no projeto CRM: Root Directory `apps/crm`.
3. Definir no projeto site: Root Directory `apps/site`.
4. Manter a instalação automática usando o `pnpm-lock.yaml` raiz. Só definir um install command manual se o log provar que a deteção automática falha; registar o command e o motivo.
5. Criar um Preview Deployment de cada projeto a partir de `feat/monorepo-migration-2026-09-09`.
6. Confirmar nos logs o lockfile raiz, Node 22 e build no diretório correto.
7. Testar no preview do site: `/`, `/blog`, um slug, RSS e sitemap. Testar no preview do CRM: login e uma rota autenticada permitida pelo ambiente de preview.
8. Guardar URL de preview, SHA, logs e prova visual. O dono aprova explicitamente ambos os previews.
9. Só após aprovação, promover para produção e executar smoke test pós-deploy.

Rollback: voltar cada projeto ao último deployment verde e restaurar o Root Directory anterior. Não apagar variáveis, repositórios ou histórico.

## Passo 6 — organização GitHub, transferência e integrações

`PRECISA DONO`: criação de organização, billing, 2FA, transferência, permissões e reautorização Vercel.

1. Confirmar que a organização `lumenva` não existe em conflito e que o dono controla `trydavidqix/Lumenva`.
2. Criar a organização `lumenva`, definir owners, 2FA, teams, billing e política de Actions. Manter Actions desligado até decisão explícita de billing.
3. Transferir `trydavidqix/Lumenva` para `lumenva/Lumenva`, preservando o nome. Não criar fork nem recriar o repositório antigo: o redirect histórico deve permanecer.
4. Depois da transferência, atualizar clones autorizados:

```bash
git remote set-url origin https://github.com/lumenva/Lumenva.git
git fetch origin --prune
git remote -v
```

5. Confirmar redirect do URL antigo, repositório novo, branch `main` e a branch de migração.
6. Reautorizar a organização `lumenva` no GitHub App da Vercel. Reconfirmar os dois projetos e repetir um Preview Deployment pós-reautorização.
7. Verificar webhooks, deploy keys e secrets transferidos sem imprimir valores. Se faltar qualquer integração, parar antes de produção.

Rollback: se a organização ou Vercel não estiver pronta, parar antes da transferência. Após transferência, corrigir permissões e remotes; qualquer nova transferência exige nova decisão do dono.

## CI e follow-up

`PRECISA DONO`: manter um único `.github/workflows/ci.yml`, com Actions off até decisão de billing. Quando autorizado, ativar pela UI/CLI e exigir um run de pull request verde; não incluir deploy ou secrets.

`FOLLOW-UP GETPATTER`: após a migração, abrir tarefa separada para rever o getpatter e referências remanescentes. Não alterar lógica nem misturar esse trabalho com o pacote Vercel/GitHub.

## Critério de fecho

Fechar somente com: validação cloud verde no SHA final; dois previews aprovados; transferência/reautorização autorizadas e verificadas; remotes atualizados; Actions explicitamente `OFF` ou com decisão documentada; e evidência sem credenciais.
