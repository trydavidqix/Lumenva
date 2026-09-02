# Pipeline permanente de leads

Esta é a ferramenta oficial e repetível do projeto. Executa o binário nativo do `gosom/google-maps-scraper`, extrai CSV, procura
links `wa.me`/WhatsApp nos sites encontrados, consulta contexto via Exa através
do `agent-reach`/`mcporter` e valida sinais recentes com `last30days`.

```bash
python3 scripts/lead-pipeline/lead_pipeline.py \
  --scraper-bin /caminho/para/google-maps-scraper \
  --out-dir docs/pesquisa/lead-pipeline-run
```

O enriquecimento ScrapeGraphAI é marcado como `skipped-no-OPENAI_API_KEY-or-ANTHROPIC_API_KEY` quando nenhuma dessas chaves existe no ambiente; o pipeline não cria nem solicita chaves.

Execução validada em 2026-09-02:

- binário oficial `v1.17.4` macOS amd64;
- 20 resultados, `numOfJobsFailed: 0`;
- `last30days_returncode: 0`;
- 20 linhas em `leads.csv`, com telefone, site quando disponível e links WhatsApp encontrados por HTTP;
- artefactos: `gosom.log`, `agent-reach-context.txt`, `last30days.log` e relatório bruto do `last30days`.

## Exportação Google Sheets

Com OAuth já concluído pelo dono (`gws auth status`), exporte o CSV:

```bash
python3 scripts/lead-pipeline/export-to-sheets.py docs/pesquisa/lead-pipeline-run-2026-09-02c/leads.csv --nicho "clínicas dentárias" --cidade Lisboa
```

Use `--spreadsheet-id ID` para uma planilha existente. Sem autenticação o
exportador termina com mensagem e referência ao guia de setup; não tenta login.
Use `--dry-run` para testar a geração dos pedidos `spreadsheets.create`,
`values.update` e `batchUpdate` offline.

O guia operacional completo está em [`docs/guides/lead-pipeline.md`](../../docs/guides/lead-pipeline.md).
