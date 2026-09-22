# Audit — AI Platform Knowledge/Graph para o Command Center standalone

**Data:** 2026-09-22  
**Escopo:** somente o Command Center sem CRM.  
**Fonte:** planos e gates oficiais do AI Platform existentes no repositório.

## Veredito

Os planos corretos são:

1. **Phase 3 — Knowledge / Obsidian / LlamaIndex**
2. **Phase 4 — Graphiti + FalkorDB**

As duas fases têm gate `GO` no AI Platform. Isso prova a implementação no stack antigo, não a integração no Command Center standalone.

## Estado por componente

| Componente | AI Platform | Command Center standalone | Ação |
|---|---:|---:|---|
| Obsidian como autoria humana | `GO` | `0%` | extrair `ObsidianAdapter` para pacote independente |
| publicação `PUBLISHED` + scanner | `GO` | `0%` | reutilizar contratos sem depender da UI/DB do CRM |
| LlamaIndex opcional | `GO` / OFF-SHADOW | `0%` | adapter opcional no Context Engine |
| Graphiti temporal | `GO` / SHADOW | `0%` | portar `KnowledgeGraphPort` e cliente para o Core |
| FalkorDB | substituído | `não usar por padrão` | plano original; incompatível com a imagem Graphiti validada |
| Neo4j Community | validado e gratuito self-host | `0%` | backend atual do Graphiti, atrás do gateway |
| Graph View | não entregue no gate antigo | `0%` | criar view read-only no Command Center |

## O que já está comprovado

- Phase 3: nove tarefas concluídas; exportação Obsidian, validação, scanner, publicação, provenance e adapter LlamaIndex testados.
- Phase 3: existe uma lacuna deliberada: exportação → upload → indexação ainda tem intervenção humana.
- Phase 4: projeção, busca, purge, rebuild, isolamento, sanitização e degradação foram testados.
- Phase 4: FalkorDB foi trocado por Neo4j Community porque a imagem oficial do Graphiti validada aceita Neo4j.
- Neo4j Community é gratuito e self-host; não exige serviço pago.

## O que não pode ser carregado diretamente

- dependência do CRM/Postgres como runtime;
- upload pela UI do CRM;
- `organization_id` recebido do prompt;
- leitura automática de todo o vault;
- promoção automática de fatos do grafo para autoridade;
- claims de `SHADOW` real antes de ligar o provider ao Core standalone.

## Próximos entregáveis standalone

1. `packages/knowledge` — frontmatter, sanitizer, publicação, provenance e indexação local.
2. `packages/knowledge-graph` — `KnowledgeGraphPort`, namespace, Graphiti client, rebuild e health.
3. `apps/core` — event bus e projection worker local, sem CRM.
4. `Context Engine` — retrieval progressivo de Obsidian + Graphiti + arquivos do projeto.
5. `Graph View` — visualização read-only com drill-down até source/SHA.

## Progresso standalone — 2026-09-22

- `packages/knowledge`: publicado local, scanner e provenance implementados; 5/5 testes.
- `packages/knowledge-graph`: namespace, `NullKnowledgeGraph`, projection worker e adapter HTTP Graphiti; 4/4 testes.
- Typecheck dos dois pacotes: PASS.
- `apps/core`: SQLite persistente, migração inicial, tarefas idempotentes, replay ordenado e EventBus; 2/2 testes.
- Typecheck do Core: PASS.
- `apps/core`: `CoreRuntime` com `start`, `health`, `stop` e recuperação para `RECOVERING`; 3/3 testes do pacote.
- `apps/core`: API loopback com health, task idempotente, task get e event replay; 4/4 testes do pacote.
- `apps/core`: adapter local chama o `compileContext` real do MCG; sucesso registra `context.requested/completed`, falha registra `context.failed` com `MCG_UNAVAILABLE`; 7/7 testes do pacote.
- `apps/core`: fluxo Obsidian `PUBLISHED` → scanner → Graph projection → provenance/eventos; 8/8 testes do pacote.
- `apps/core`: `CoreTelemetrySink` persiste eventos de task/context no ledger MCG com provenance e measurement type; dashboard consome esses eventos end-to-end; 10/10 testes do pacote e typecheck PASS.
- `apps/core`: `ContextPacket` progressivo implementado em L0/L1/L2, com hard cap, ordenação determinística e hash de versão reproduzível; 12/12 testes do pacote e typecheck PASS.
- `apps/core`: Budget Engine multidimensional implementado para tokens, contexto, tools, tempo, custo e quota, com falha fechada e violações determinísticas; 14/14 testes do pacote e typecheck PASS.
- `apps/core`: `ContextPacket` opcional atravessa `CoreRuntime.requestContext` e o adapter local converte excerpts em fragments MCG; chamadas legadas sem packet continuam compatíveis; 15/15 testes do pacote e typecheck PASS.
- `apps/core`: preflight de budget bloqueia requests excedentes antes do adapter, persiste `context.failed` com `BUDGET_EXCEEDED` e mantém o adapter sem chamada; 16/16 testes do pacote e typecheck PASS.
- Commits: `3c951634`, `124c8448`, `ccb4d3dd`, `91523605`.
- Graph View conectado e Context Engine progressivo continuam pendentes.

## Gates antes de ativar

- Graphiti começa `OFF`.
- Não habilitar `SHADOW` para dados reais sem decisão de redaction por contacto.
- Toda aresta precisa de source, timestamp, namespace e confidence.
- O grafo nunca autoriza ação de alto risco.
- Rebuild local deve reconstruir a projeção a partir dos eventos/documentos canônicos.

## Referências

- `docs/superpowers/plans/2026-08-10-ai-platform-phase-3-knowledge.md`
- `docs/superpowers/plans/2026-08-10-ai-platform-phase-4-graphiti.md`
- `docs/evidence/ai-platform/phase-3-knowledge-gate.md`
- `docs/evidence/ai-platform/phase-4-graphiti-gate.md`
- `docs/runbooks/graphiti.md`
- `docs/runbooks/obsidian-knowledge.md`
