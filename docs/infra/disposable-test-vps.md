# VPS descartável de teste — Lumenva

> **NÃO USAR ESTA VPS PARA PRODUÇÃO.**

## Identificação

- **Nome:** `lumenva-disposable-test-vps`
- **ID Hetzner:** `166228238`
- **IP:** `91.99.214.199`
- **Tipo:** `cx33`
- **Recursos:** 4 vCPU, 8 GB RAM, 80 GB NVMe
- **Região:** `fsn1`
- **Imagem:** `ubuntu-24.04`
- **Data de criação:** `2026-09-16`
- **Status:** criada e em execução
- **Swap:** arquivo `/swapfile` de 4 GB, habilitado no boot

## Propósito

Ambiente descartável/teste para CI local e automação Codex Cloud.

**NÃO USAR PRA PRODUÇÃO.**

## Chave SSH

Par dedicado gerado localmente em:

- Privada: `~/.ssh/lumenva-vps-disposable-test-2026-09-17`
- Pública: `~/.ssh/lumenva-vps-disposable-test-2026-09-17.pub`
- Registrada no Hetzner como SSH key ID `130108032`

A chave privada não deve ser commitada, publicada ou incluída nesta nota.

## Infisical

**Status: CONCLUÍDO** — secrets salvos no workspace `Lumenva AI Ecosystem`.

**Caminho:** `/infrastructure/disposable-test-vps` no ambiente `dev`.

Após o login, armazenar no Infisical:

- `DISPOSABLE_VPS_SSH_PRIVATE_KEY`
- `DISPOSABLE_VPS_IP`
- `DISPOSABLE_VPS_NAME`
- `DISPOSABLE_VPS_ID`
- `DISPOSABLE_VPS_PURPOSE`

## Destruição

Quando a VPS não for mais necessária, destruí-la pela API Hetzner:

```text
DELETE https://api.hetzner.cloud/v1/servers/166228238
```

Usar o token de API somente de forma protegida; nunca registrá-lo nesta nota ou no Git.

> **NÃO USAR ESSA VPS PRA PRODUÇÃO.**

## GitHub Actions Self-Hosted Runner

- **Repositório:** `trydavidqix/Lumenva` (privado)
- **Nome do runner:** `lumenva-disposable-test-vps`
- **Label dedicado:** `self-hosted-lumenva-disposable`
- **Agente:** Actions Runner `2.337.0`, instalado em `/opt/actions-runner`
- **Node heap do job pesado:** `--max-old-space-size=6144`
- **Custo Hetzner:** `€8,49/mês` líquido (`€10,4427/mês` bruto pela API, sem IPv4); `€0,0136/h` líquido
- **Serviço:** systemd, habilitado e ativo após reboot/desconexão SSH
- **Usuário do serviço:** `github-runner` (não root)
- **Workflow de teste:** `.github/workflows/self-hosted-runner-smoke.yml`, disparo manual (`workflow_dispatch`)

O runner foi instalado com o pacote oficial `actions/runner` e o SHA-256 do arquivo foi verificado antes da extração. O pipeline de produção (`.github/workflows/ci.yml`) não foi alterado.

O teste de migração na branch de staging eliminou o OOM do Typecheck após o resize para `cx33` e o aumento do heap do Node. A execução ainda falha em erros reais de TypeScript existentes na base; nenhuma correção de código foi feita como parte desta migração.

### Parar ou remover

Na VPS, para parar temporariamente:

```bash
sudo systemctl stop actions.runner.trydavidqix-Lumenva.lumenva-disposable-test-vps.service
```

Para remover o serviço e o registro do GitHub:

```bash
cd /opt/actions-runner
sudo ./svc.sh stop
sudo ./svc.sh uninstall
sudo -u github-runner ./config.sh remove --token '<novo-token-de-remoção>'
```

O token de remoção deve ser gerado somente no momento da remoção pela API de runners do repositório. Não armazená-lo nesta nota, na VPS ou no Git.
