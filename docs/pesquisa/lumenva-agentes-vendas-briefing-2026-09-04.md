# Lumenva — agentes Briefing/Vendas e importação de leads (2026-09-04)

## Decisão confirmada

Na organização Lumenva em produção foram criados dois agentes de IA ativos:

- **Briefing**, selecionado pelo router de intenção quando `precisa_briefing`;
- **Vendas**, selecionado quando `pronto_pra_proposta`.

O roteamento reutiliza o router de intenção existente. A alteração é configuração
de produto/dado em produção, não código nem schema; não há migration associada.

O pipeline **Leads Alfred** recebeu a etapa **Novo (frio)**. O contato frio é
manual: a IA pode classificar e encaminhar, mas não deve iniciar mensagem
automática nessa etapa. As demais transições e o atendimento seguem o fluxo
automático já existente, sujeito às regras e gates do tenant.

## Importação do Prospector

O script [`scripts/lead-pipeline/import-to-crm.py`](../../scripts/lead-pipeline/import-to-crm.py)
foi criado na branch `feat/lead-pipeline-import-crm-2026-09-04` (commit `4c477990`),
ainda não mesclada em `main`. Ele lê as linhas `Não contatado`, normaliza telefones,
deduplica por telefone e cria `contacts` e `crm_leads` no pipeline/etapa acima.
Aceita `--dry-run` e não envia mensagens nem atualiza leads existentes.

A primeira rodada real foi conferida por leitura do banco em 2026-09-04: **40
contatos e 40 leads** com `source = prospector_sheets`. Repetir a importação não
deve criar outro contato para um telefone já visto.

Este documento registra decisão e evidência temporal; credenciais, IDs de contatos
e dados pessoais não são versionados aqui.
