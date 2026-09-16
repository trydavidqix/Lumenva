# VPS descartável de teste — Lumenva

> **NÃO USAR ESTA VPS PARA PRODUÇÃO.**

## Identificação

- **Nome:** `lumenva-disposable-test-vps`
- **ID Hetzner:** `166228238`
- **IP:** `91.99.214.199`
- **Tipo:** `cx23`
- **Região:** `fsn1`
- **Imagem:** `ubuntu-24.04`
- **Data de criação:** `2026-09-16`
- **Status:** criada e em execução

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
