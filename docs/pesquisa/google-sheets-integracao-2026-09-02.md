# Integração Google Sheets — inventário e preparação (2026-09-02)

## Resultado

Não havia integração Google Sheets instalada ou configurada nesta máquina.

Foi instalado globalmente:

```text
@googleworkspace/cli@0.22.5
binário: /usr/local/bin/gws
```

O comando foi validado sem credenciais com `gws --version`, `gws --help`,
`gws auth --help` e `gws schema sheets.spreadsheets.values.get --help`.
O schema dinâmico retornou o endpoint Sheets API v4 e os parâmetros
`spreadsheetId`/`range`. A instalação não criou `~/.config/gws` nem qualquer
token.

## Inventário local

- `codex mcp list`: `computer-use`, `context7`, `cua_repl`, `github`,
  `memory`, `node_repl`, `playwright` e `sequential-thinking`, além de
  Cloudflare, Exa, Neon, Resend e Vercel remotos. Nenhum servidor chamado
  Google, Workspace ou Sheets.
- Executáveis procurados (`gsheets`, `gcalcli`, `gws`, `google`, `clasp`,
  `gdrive`, `gog`): nenhum existia antes; `gws` passou a existir após a
  instalação. `gcloud` não está instalado.
- Pacotes npm globais anteriores não continham integração Google/Sheets.
  O pacote agora instalado é `@googleworkspace/cli@0.22.5`.
- `pip list` não continha `gspread`, Google Sheets ou Google Workspace.
- Skills instaladas foram pesquisadas por nome/conteúdo. Não existe skill
  dedicada a Google Sheets/Workspace. `maestri-workspace` é genérica; as
  referências a `@ai-sdk/google` no projeto são Gemini, não Sheets.

## Escolha técnica

`gws` é a opção local mais útil para este ambiente: é uma CLI open source que
expõe dinamicamente Drive, Sheets, Gmail, Docs e outros serviços a partir dos
Discovery Documents, com JSON estruturado, introspecção de schema e comandos
`--dry-run`/paginação. O repositório `googleworkspace/cli` estava ativo na
verificação: 30.697 estrelas, atualização em 2026-09-02 e último push em
2026-08-25; npm latest era `0.22.5`.

Importante: o próprio projeto declara que **não é um produto Google
oficialmente suportado**. Para um MCP, a alternativa oficial atualmente em
Developer Preview é o servidor remoto Google Sheets:
`https://sheetsmcp.googleapis.com/mcp/v1`. Ele não foi adicionado ao Codex
porque isso exigiria configurar OAuth e um client ID/secret humanos.

Fontes consultadas:

- [Google — configurar o Sheets MCP server](https://developers.google.com/workspace/sheets/api/guides/configure-mcp-server)
- [Google — configurar os Workspace MCP servers](https://developers.google.com/workspace/guides/configure-mcp-servers)
- [googleworkspace/cli — README, autenticação e atividade](https://github.com/googleworkspace/cli)

## Autorização humana: CLI `gws`

1. Crie ou selecione um projeto no [Google Cloud Console](https://console.cloud.google.com/).
2. Ative a **Google Sheets API**. Ative também a **Google Drive API** se as
   planilhas estiverem no Drive ou se for necessário listar/abrir arquivos.
3. Em **Google Auth Platform → Branding/Audience**, configure a tela OAuth.
   Para app externo em modo Testing, adicione a conta do dono em **Test users**.
4. Em **Google Auth Platform → Clients → Create client**, escolha **Desktop
   app** e descarregue o JSON. Salve-o como:
   `~/.config/gws/client_secret.json`.
5. Execute `gws auth login` e conclua o login/consentimento no navegador humano.
   Para limitar escopos, use `gws auth login -s sheets` ou
   `gws auth login -s drive,sheets`. Não cole tokens no repositório, shell
   history, issues ou documentação.
6. Confirme com `gws auth status`.
7. Faça um teste somente de leitura, substituindo os placeholders localmente:

   ```bash
   gws sheets spreadsheets values get --params '{"spreadsheetId":"SPREADSHEET_ID","range":"Sheet1!A1:C10"}'
   ```

   Para mutações, primeiro use `--dry-run`; revise o payload e só então
   remova `--dry-run` conscientemente.

O `gws auth setup` também existe, mas requer instalar/configurar `gcloud`; não
foi executado. A CLI cifra credenciais em repouso usando o keyring do sistema
(ou `~/.config/gws/.encryption_key` quando o backend `file` for escolhido).

## Autorização humana: MCP oficial remoto

O servidor oficial está em Developer Preview e usa OAuth 2.0. O dono deve:

1. No projeto Google Cloud, ativar `sheets.googleapis.com` e
   `sheetsmcp.googleapis.com`.
2. Configurar a tela OAuth em Google Auth Platform e os escopos publicados
   pelo guia oficial do Sheets:
   `https://www.googleapis.com/auth/drive.readonly`,
   `https://www.googleapis.com/auth/drive.file`,
   `https://www.googleapis.com/auth/spreadsheets.readonly` e
   `https://www.googleapis.com/auth/spreadsheets`.
3. Criar um OAuth client conforme o MCP host. Para Claude, por exemplo, é
   **Web application** com redirect URI
   `https://claude.ai/api/mcp/auth_callback`; outros hosts fornecem o seu
   callback.
4. No cliente MCP, adicionar servidor `sheets`, transporte HTTP, URL
   `https://sheetsmcp.googleapis.com/mcp/v1`, e informar o client ID/secret.
5. Completar o consentimento no navegador humano e testar `sheets.get_values`
   em uma planilha não sensível. O servidor oferece `get_values`,
   `get_spreadsheet`, `update_spreadsheet`, `update_values`, `update_formulas`
   e `insert_dimension`.

O Codex desta máquina continua sem esse MCP configurado até o dono escolher o
host e concluir OAuth. Não foram usadas credenciais reais, nem abertas URLs de
login.

## Segurança operacional

O MCP oficial pode ler, modificar e apagar dados acessíveis pela conta; a
documentação Google alerta para prompt injection indireto. Comece com uma
planilha de teste, escopos mínimos, revisão humana de toda mutação e nunca
processe conteúdo não confiável sem filtragem.
