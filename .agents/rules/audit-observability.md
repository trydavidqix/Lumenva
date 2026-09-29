---
paths:
  - "apps/crm/**"
  - "infra/supabase/**"
---

# Auditoria e observabilidade do CRM

> Regra operacional resumida. O contrato do produto pertence à fonte canônica do domínio em `docs/index.md`. O catálogo de actions e schema exatos vivem nas specs/business rules.

## Audit trail

Toda mutação relevante bem-sucedida deve gerar uma entrada em `api_audit_log` conforme o contrato da superfície.

A entrada registra, quando aplicável:

- actor (`user_id`, `api_token_id`, platform admin/bypass);
- action canônica;
- resource type/id;
- organização;
- timestamp;
- request/correlation id;
- metadata/diff suficiente para investigação **sem copiar segredo ou PII desnecessária**.

GET comum não precisa ser auditado por default; exports massivos, operações sensíveis e exceções seguem a spec/regra do domínio.

## Append-only

`api_audit_log` é append-only:

- aplicação/API não atualiza ou deleta linhas existentes;
- UPDATE/DELETE normais são revogados/bloqueados;
- intervenção de DBA é exceção operacional rara e controlada, não API de produto.

## Falha de audit

O contrato documentado é fire-and-forget para não transformar indisponibilidade de observabilidade em indisponibilidade da mutação principal.

- target documentado: write de audit em até 500ms p99;
- falha de write gera alerta operacional/Sentry;
- a mutação principal não deve ser desfeita apenas porque o registro de audit falhou, salvo se uma spec futura explicitamente tornar aquela operação fail-closed.

Isto não autoriza engolir a falha: ela precisa ficar visível operacionalmente.

## Retenção

Contrato vigente da Plataforma Base/business rule L-10:

- retenção total: **5 anos**;
- hot storage: **90 dias**;
- histórico mais antigo: cold storage S3/lifecycle conforme implementação/runbook;
- exceção de purga manual somente sob processo DBA controlado quando exigido por incidente/compliance.

## Logs e Sentry

Nunca grave em log, breadcrumb, trace, erro, screenshot ou fixture:

- password;
- API key;
- bearer token;
- cookie;
- webhook secret;
- CPF/telefone/e-mail ou outra PII além do mínimo estritamente necessário e permitido pelo contrato.

Use o logger estruturado do projeto. `console.log` não é aceito em código merged.

Sentry `beforeSend`/sanitização é uma última barreira, não licença para enviar dado sensível e limpar depois. Minimize/sanitize na origem.

## Tenant scope

Logs/métricas de domínio devem carregar `organization_id` quando não forem globais. Não use o tenant errado só para preencher telemetria; a origem deve ser a mesma fonte confiável usada pela operação.

## Bypass e ações sensíveis

Uso de service role/platform admin deve deixar evidência adequada (`bypassed_rls`, acting-as, action correspondente) quando o contrato exigir. O audit não substitui autorização/RLS.

## Fontes

- `docs/prd/01-prd-platform-base.md` §3.5, §4.2–4.4
- `docs/specs/01-spec-platform-base.md`
- `docs/business-rules/00-business-rules-catalog.md` L-06/L-10/T-08
