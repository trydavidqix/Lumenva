# Pipeline permanente de leads

O `scripts/lead-pipeline/lead_pipeline.py` é a ferramenta operacional oficial
para descobrir negócios locais e preparar leads para o CRM. A execução é local,
repetível e não instala binários, navegadores ou chaves automaticamente.

## Execução

No diretório raiz do repositório:

```bash
python3 scripts/lead-pipeline/lead_pipeline.py --scraper-bin /caminho/para/google-maps-scraper --query "clínica dentária em Lisboa" --out-dir docs/pesquisa/lead-pipeline-run-AAAA-MM-DD
```

`--scraper-bin` aponta para o binário já instalado do `gosom/google-maps-scraper`.
O diretório de saída é criado se não existir e contém `leads.csv`, logs e
artefactos de cada etapa.

## Etapas e justificativa

- **gosom/google-maps-scraper:** encontra negócios, telefone, site, endereço e
  link de Maps a partir de uma consulta local.
- **ScrapeGraphAI (opcional):** etapa de enriquecimento de WhatsApp protegida
  por uma chave `OPENAI_API_KEY` ou `ANTHROPIC_API_KEY`. Sem chave, ela é
  explicitamente pulada (como na execução de prova abaixo); o pipeline não pede
  nem cria credenciais. A implementação disponível também procura links
  WhatsApp diretamente no HTML do site, sem persistir conteúdo desnecessário.
- **agent-reach via `mcporter`/Exa:** adiciona contexto de mercado para uma
  amostra dos negócios, separado do CSV principal.
- **last30days:** valida sinais recentes de demanda relacionados ao nicho e à
  cidade; o plano, log e relatório bruto ficam no diretório da execução.

## Resultado e artefactos

O CSV canónico é `docs/pesquisa/<execução>/leads.csv`, com as colunas brutas do
pipeline (`title`, `phone`, `website`, `whatsapp`, `address`, avaliações e
`link`). Os ficheiros `gosom.log`, `agent-reach-context.txt`,
`last30days.log`, `last30days-plan.json` e `pipeline-status.json` permitem
auditar a execução sem depender de memória de sessão.

Execução real confirmada em **2026-09-02**, no diretório
`docs/pesquisa/lead-pipeline-run-2026-09-02c/`:

- 20 leads de teste gravados em `leads.csv`;
- 10 dos 20 com link WhatsApp confirmado;
- gosom `v1.17.4`, `numOfJobsFailed: 0`;
- `last30days_returncode: 0`;
- ScrapeGraphAI marcado como `skipped-no-OPENAI_API_KEY-or-ANTHROPIC_API_KEY`;
- logs e contexto agent-reach presentes no diretório.

## Exportação para Google Sheets

Depois de obter um CSV, gerar uma planilha nova (ou atualizar uma existente)
com cabeçalho formatado, filtro manual posterior e estado de contato:

```bash
python3 scripts/lead-pipeline/export-to-sheets.py docs/pesquisa/lead-pipeline-run-2026-09-02c/leads.csv --nicho "clínicas dentárias" --cidade Lisboa
```

Para uma planilha existente, acrescente `--spreadsheet-id ID` (e, se
necessário, `--sheet`/`--sheet-id`). A exportação cria/atualiza as colunas
`Nome do Negócio`, `Telefone`, `WhatsApp`, `Site`, `Endereço`, `Nicho`,
`Cidade`, `Fonte`, `Data Encontrado`, `Status` e `Notas`; congela a primeira
linha, aplica cabeçalho verde escuro em negrito e dimensiona as colunas.

Antes da primeira execução real, o dono deve concluir o OAuth descrito em
[`../pesquisa/google-sheets-integracao-2026-09-02.md`](../pesquisa/google-sheets-integracao-2026-09-02.md).
O exportador falha claramente se `gws auth status` indicar que não há
credenciais. Para validar sem autenticação:

```bash
python3 scripts/lead-pipeline/export-to-sheets.py /tmp/leads-mock.csv --nicho teste --cidade Lisboa --dry-run
```
