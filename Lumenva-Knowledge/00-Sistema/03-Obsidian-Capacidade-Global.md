---
source: local-observation-and-official-docs
date: 2026-09-12
type: capability-record
provenance: Obsidian CLI 1.13.7, official help, local skill marketplace
---

# Obsidian como capacidade global

## Estado confirmado

- O binário oficial `obsidian` está instalado em `/usr/local/bin/obsidian`.
- O caminho é um symlink para `/Applications/Obsidian.app/Contents/MacOS/obsidian-cli`.
- O Obsidian CLI está ativo globalmente. A ativação fica em `~/Library/Application Support/obsidian/obsidian.json`, no campo top-level `cli: true`.
- O socket local está disponível em `~/.obsidian-cli.sock` enquanto o Obsidian está em execução.
- A skill oficial `obsidian-cli` está instalada no marketplace `kepano/obsidian-skills`; as skills relacionadas disponíveis localmente são `json-canvas`, `obsidian-bases`, `obsidian-markdown` e `defuddle`.

## Operação padrão

1. Manter o aplicativo Obsidian aberto.
2. Usar `obsidian help` para descobrir a superfície atual.
3. Passar `vault=<nome>` quando o vault estiver registado; para o workspace atual, o vault registado é `CRM`, que contém `Lumenva-Knowledge` como subpasta.
4. Usar `path=` para caminhos exatos e `silent`/`--copy` quando aplicável.

Exemplos de verificação:

```bash
obsidian help
obsidian vaults verbose
obsidian vault=CRM read path="Lumenva-Knowledge/README.md"
```

## MCP

Não foi encontrado um servidor MCP oficial mantido pela Obsidian. A documentação oficial confirma o CLI, mas não publica um MCP oficial. Existem plugins e servidores de terceiros (REST/MCP e wrappers do CLI); nenhum foi instalado ou configurado nesta capacidade global. A decisão fica deliberadamente em CLI + skills oficiais, sem download ou dependência adicional.

## Limites

Esta capacidade é uma superfície de documentação local. Não transforma o vault em fonte de verdade do CRM, não concede acesso a Postgres e não substitui os controlos de publicação, tenant ou auditoria do produto.
