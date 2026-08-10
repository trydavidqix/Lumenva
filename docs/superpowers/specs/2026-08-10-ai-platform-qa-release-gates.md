# AI Platform QA & Release Gates

**Data:** 2026-08-10  
**Aplica-se a:** Fases 0–7 da AI Platform  
**Regra:** nenhum `GO` sem evidência fresca.

## 1. Política de severidade

### P0 — bloqueia imediatamente

- vazamento cross-tenant;
- secret/token persistido em memória, grafo, telemetry ou fixture;
- ação HIGH-risk autorizada apenas por Mem0/Graphiti/inference;
- duplicação de side effect financeiro/comercial/mensagem por retry/replay/resume;
- LGPD delete que deixa dado pessoal acessível em derived store;
- migration que quebra RLS/baseline/fresh install;
- kill switch que não desliga o provider;
- provider externo que derruba o atendimento principal.

### P1 — bloqueia promoção de fase

- regressão de qualidade acima do orçamento aprovado;
- projection replay inconsistente;
- out-of-order event restaurando estado antigo;
- observability exportando PII além do contrato;
- provider timeout sem fallback;
- falta de idempotência em delivery n8n/LangGraph;
- canary sem rollback comprovado.

### P2 — pode seguir com issue registrada

- ergonomia de dashboard interno;
- documentação secundária incompleta;
- métrica não crítica ausente;
- otimização de custo/performance fora do hot path.

## 2. Gate 0 — baseline antes de qualquer feature nova

Executar no branch e guardar outputs no handoff da fase:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm lint:channels
pnpm test:unit
pnpm test:db
pnpm build
```

Quando o fluxo exigir UI/WhatsApp, executar E2E relevante.

### Condições de GO

- build exit 0;
- typecheck 0 errors;
- lint 0 errors;
- unit 0 failures;
- DB invariants 0 failures;
- nenhum teste removido/skipado para obter verde;
- deployment canary/preview correspondente `READY` quando a task exigir deploy.

### Defeito conhecido na base inicial

Na base `4fa4ca9`, o deployment Vercel observado falhou no typecheck de `website/app/api/contact/route.ts` por import ausente `@/lib/contact-form`. O implementador deve **reproduzir primeiro** e corrigir a causa, sem `ts-ignore`, sem excluir `website` do build e sem remover a rota.

## 3. Golden Dataset

Criar fixtures sintéticas, sem PII real, em:

```text
tests/fixtures/ai-platform/golden-cases.json
```

Schema mínimo por caso:

```json
{
  "id": "memory-preference-supersede-001",
  "organization_id": "00000000-0000-4000-8000-000000000001",
  "contact_id": "00000000-0000-4000-8000-000000000101",
  "input_events": [],
  "query": "qual horário o cliente prefere?",
  "expected": {
    "must_include": [],
    "must_not_include": [],
    "authority_domain": "customer_preference",
    "risk": "low"
  }
}
```

Casos obrigatórios:

1. preferência simples correta;
2. preferência alterada e superseded;
3. memória antiga expirada;
4. CRM oficial contradiz Mem0;
5. knowledge PUBLISHED contradiz memória;
6. consentimento oficial contradiz inference;
7. secret em mensagem não vira memória;
8. e-mail/telefone redacted no trace externo;
9. org A e org B com mesmo nome de contato não cruzam contexto;
10. evento duplicado não duplica projeção;
11. evento fora de ordem não restaura fato antigo;
12. Mem0 timeout mantém resposta nativa;
13. Graphiti timeout mantém resposta nativa;
14. LangSmith down não afeta resposta;
15. LlamaIndex down mantém RAG nativo;
16. n8n down mantém estado e agenda retry;
17. HIGH-risk memory não autoriza ação;
18. LGPD delete remove derived projections;
19. replay reconstrói Mem0 sem divergência;
20. replay reconstrói Graphiti sem divergência;
21. prompt injection em memória não altera system policy;
22. prompt injection em knowledge não ganha autoridade;
23. human handoff continua determinístico;
24. STOP continua bloqueando envio;
25. LangGraph resume não duplica envio.

## 4. Métricas de baseline

Antes de Mem0 medir no runtime atual:

- p50/p95/p99 de turno;
- tokens input/output;
- custo estimado por turno;
- quantidade de tool calls;
- erro de tool;
- RAG hit/no-hit;
- handoff rate;
- contexto total em tokens;
- taxa de resposta sem contexto recuperado;
- taxa de falha do worker/retry.

Salvar baseline em artefato versionado sem PII:

```text
docs/evidence/ai-platform/baseline-summary.md
```

Não colocar dump bruto de produção.

## 5. Gates de segurança

### Tenant isolation

Para toda tabela nova:

- RLS habilitada;
- `organization_id` obrigatório quando tenant-aware;
- authenticated org A não vê/escreve org B;
- service-role code filtra org por fonte confiável;
- invariant específico em `tests/invariants/`.

### Secret handling

Tests devem provar que os padrões abaixo são bloqueados/redacted antes de derived boundaries:

- `sk-...`;
- bearer token;
- JWT-like string;
- cookie/session;
- recovery code;
- variável com nome `*_API_KEY`, `*_TOKEN`, `*_SECRET`;
- credenciais do Infisical/KeePass nunca entram em fixture/log.

### PII

- telefone/e-mail podem existir no CRM oficial quando negócio exige;
- LangSmith recebe versão mascarada/omitida;
- Mem0 recebe somente campos aprovados pela política de memória;
- Graphiti recebe entidades necessárias, preferindo IDs internos/labels minimizados.

## 6. Gates de projection/reconciliation

Para Mem0 e Graphiti:

1. apply event v1;
2. reapply v1 -> no duplicate;
3. apply v2 -> state v2;
4. delayed v1 -> state continua v2;
5. delete -> derived data inacessível;
6. replay from zero -> mesmo estado lógico;
7. provider offline -> ledger retry;
8. provider online -> retry aplica uma vez;
9. poison event -> failed/dead state visível sem travar fila inteira.

## 7. Gates de Context Fusion

Testar:

- providers executam em paralelo;
- timeout individual não cancela os demais;
- CRM official vence domínio oficial;
- knowledge PUBLISHED vence política desatualizada de memória;
- preferência recente confirmada vence preferência antiga;
- confidence não supera autoridade;
- itens duplicados são fundidos;
- context budget não cresce sem limite;
- HIGH-risk item chega marcado `actionable=false`;
- conflito irresolvido gera confirmação/handoff, não invenção.

## 8. Gates por fase

### Fase 0 — Foundation

GO quando:

- baseline verde;
- migration de flags/ledger passa `test:db`;
- flags `OFF/SHADOW/CANARY/ON` testadas;
- kill switch sempre vence flag;
- Golden Dataset existe e roda localmente;
- nenhuma integração externa ainda influencia o agente.

### Fase 1 — LangSmith

GO quando:

- tracing pode ser desligado sem reiniciar lógica de negócio quando design permitir;
- export é best-effort/background;
- redaction tests verdes;
- zero secrets nos traces de teste;
- baseline experiment registrado;
- LangSmith down testado.

### Fase 2 — Mem0

Promoção `SHADOW -> CANARY` requer:

- write projection idempotente;
- read shadow não influencia prompt;
- memory precision mínima definida depois do baseline e atingida;
- zero P0 em Golden Dataset;
- timeout/fallback verdes;
- LGPD purge verde;
- replay verde.

Promoção `CANARY -> ON` requer:

- canary estável por janela observada definida pelo time;
- sem regressão significativa de p95/custo vs orçamento congelado;
- kill switch exercitado;
- feedback/metrics comparados contra native memory.

### Fase 3 — Knowledge

GO quando:

- somente PUBLISHED indexa;
- source/version/provenance preservados;
- LlamaIndex OFF mantém comportamento atual;
- parser failure mantém versão anterior ativa;
- secret/PII scan antes da publicação externa;
- RAG regression suite verde.

### Fase 4 — Graphiti

Promoção requer:

- tenant namespace isolado;
- graph writes idempotentes;
- temporal supersede testado;
- rebuild completo testado;
- graph timeout não afeta resposta;
- graph context não vence official domain;
- FalkorDB backup/restore básico validado.

### Fase 5 — External Guardrails

GO somente se existir gap mensurável no Golden Dataset.

- validator externo melhora o caso alvo;
- não duplica/bypassa guardrails nativos;
- outage degrada para native gates;
- bloqueios críticos permanecem fail-closed.

### Fase 6 — n8n

GO quando:

- outbound HMAC testado;
- anti-SSRF continua ativo;
- retries idempotentes;
- n8n sem service_role;
- inbound usa token escopado;
- n8n down não perde estado;
- duplicate webhook não duplica side effect.

### Fase 7 — LangGraph

GO quando:

- apenas workflow piloto usa LangGraph;
- Postgres checkpointer persistente;
- `thread_id` não é user-controlled;
- interrupt/resume testados;
- send/email/CRM writes idempotentes;
- native agent runtime continua operando sem LangGraph;
- kill switch desvia para caminho seguro/manual.

## 9. Testes de caos/failure injection

Adicionar testes/controladores capazes de simular:

- timeout de 100%, 50% e intermitente do Mem0;
- Graphiti 500;
- FalkorDB conexão recusada;
- LangSmith 401/429/timeout;
- n8n 500/timeout;
- duplicate event delivery;
- worker killed depois de external write e antes de ledger ack;
- retry depois de process restart;
- LangGraph resume repetido.

Objetivo: provar idempotência e graceful degradation.

## 10. Rollback gate

Antes de promover cada provider:

- colocar feature em `OFF`;
- provar que core volta ao comportamento nativo;
- não perder estado oficial;
- nenhum schema rollback destrutivo necessário;
- derived data pode permanecer inacessível até purge/rebuild;
- documentar comando/ação operacional em runbook.

## 11. Evidência permitida

Pode versionar:

- outputs sintéticos;
- métricas agregadas;
- screenshots sem PII;
- IDs artificiais;
- resultados de testes.

Não versionar:

- conversa real de cliente;
- telefone/e-mail real;
- API key/token;
- `.env`;
- trace export bruto de produção;
- screenshot com QR/session/token.

## 12. Formato GO/NO-GO

Fim de cada fase deve produzir:

```markdown
## Release Gate

Decision: GO | NO-GO
Commit range: <sha..sha>
Tests executed:
- command -> result
Metrics:
- baseline -> candidate
P0 open: 0
P1 open: 0
Residual P2:
- ...
Human actions required:
- ...
Rollback verified: yes/no
```

`GO` com P0/P1 aberto é inválido.
