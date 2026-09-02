# Arquitetura de memória do DeskcommCRM/Lumenva

**Status:** recomendação de design, 2026-09-02  
**Escopo:** quatro camadas de memória, sem religar ou alterar infraestrutura nesta entrega.

## Decisão executiva

Manter a memória do orquestrador em Markdown versionado/local (com índice e handoff), manter o CRM relacional como fonte de verdade para identidade, consentimento, mensagens e atividades, e usar um único serviço de memória semântica por instalação para as camadas de produto. A recomendação é **Graphiti/Neo4j como grafo temporal para fatos e relações** e **Mem0 apenas se a equipe confirmar que precisa da extração/consolidação pronta de memórias**; não usar os dois como fontes concorrentes.

Os containers existentes devem permanecer parados até existir um contrato de dados, healthcheck, backup, retenção e teste cross-tenant. **Não religar agora.** O MCP `memory` local também não deve ser fonte de verdade: a falha de inicialização torna-o inadequado para continuidade operacional.

## Evidência recente

Foi executado `agent-reach doctor --json` e uma pesquisa `last30days` com janela de 30 dias (2026-08-03 a 2026-09-02), cobrindo GitHub, Hacker News, Reddit keyless, YouTube, TikTok, Instagram, Threads e Pinterest. O run retornou itens concretos em GitHub/HN/Reddit/TikTok e resultados YouTube fora da janela; Instagram/Threads tiveram cobertura parcial. Portanto, a evidência social é indicativa, não um censo completo. A tendência consistente foi separar memória semântica, episódica e procedural e tratar isolamento por namespace como requisito de aplicação.

Fontes primárias e documentação atual:

- [Mem0 Entity-Scoped Memory](https://docs.mem0.ai/platform/features/entity-scoped-memory) documenta escopos `user`, `agent`, `app` e `session`, além de particionamento para multi-agente.
- [Mem0 FAQ](https://docs.mem0.ai/platform/faqs) descreve extração/consolidação e armazenamento híbrido vetor + grafo.
- [Graphiti: graph namespacing](https://help.getzep.com/graphiti/core-concepts/graph-namespacing) define `group_id` como namespace de isolamento por organização e exige filtrá-lo em toda escrita/leitura.
- [Graphiti overview](https://help.getzep.com/graphiti/getting-started/welcome) posiciona o projeto como grafo temporal incremental com busca híbrida.
- [LangMem conceptual guide](https://github.com/langchain-ai/langmem/blob/main/docs/docs/concepts/conceptual_guide.md) separa memória semântica (fatos), episódica (contexto temporal) e procedural (regras de comportamento), com namespaces configuráveis.
- [Letta memory blocks](https://www.letta.com/blog/memory-blocks/) e [Letta memory architecture](https://github.com/letta-ai/skills/blob/main/letta/letta-api-client/memory-architecture.md) mostram memória hierárquica: contexto residente pequeno, blocos persistentes e arquivo recuperável.
- [Zep temporal knowledge graph paper](https://arxiv.org/abs/2501.13956) relata integração de conversa e dados estruturados com relações temporais; [Mem0 paper](https://arxiv.org/abs/2504.19413) relata pipeline de extração/consolidação e ganho adicional com grafo.

## Princípios e limites

1. **Relacional é canônico.** Nunca apagar ou substituir `contacts`, `conversations`, `messages`, `crm_lead_activities`, consentimento, audit ou RLS por uma cópia em vetor/grafo.
2. **Memória derivada é reprocessável.** Cada fato/episódio externo guarda `organization_id`, origem (`table`, `row_id`, `conversation_id`/`message_id`), versão do extrator e timestamp.
3. **Tenant primeiro.** O serviço recebe `organization_id` de contexto autenticado; nunca do texto do utilizador nem de body como autoridade. O namespace deve ser `tenant:{organization_id}` e a consulta deve sempre incluir esse filtro.
4. **Tipos distintos.** Episódio = o que aconteceu; semântica = o que se sabe agora; procedural = como agir. Não misturar política/FAQ com preferências de contacto.
5. **Privacidade por desenho.** Minimizar PII, respeitar consentimento/profiling, suportar exportação/redação RGPD por `source_id`, TTL por tipo e deleção/anonimização em cascata. Memória externa não pode virar cópia não auditável.
6. **Leitura explícita.** Cada agente declara quais namespaces e tipos pode ler/escrever; o gateway rejeita ausência de tenant, agente ou finalidade.

## As quatro camadas

### 1. Memória do orquestrador (Claude/Codex)

Continuar em Markdown local, fora do runtime de clientes: `MEMORY.md`, resumos de rollout e notas do projeto. É auditável por diff, portátil entre modelos e adequado para decisões humanas. Um grafo remoto introduziria latência, indisponibilidade e risco de misturar contexto pessoal com dados de clientes.

Formato recomendado: índice curto + notas atômicas com data, confiança, origem e validade; handoff aponta SHA/branch. O orquestrador pode consultar Graphiti somente através de uma ferramenta explícita e somente para fatos do projeto marcados `scope=project`, nunca para `scope=tenant` por padrão.

### 2. Memória do projeto

`docs/specs`, `docs/architecture`, ADRs e handoffs continuam sendo a fonte normativa. Graphiti pode receber uma **projeção derivada** de decisões, incidentes e relações entre componentes (`scope=project`, `group_id=project:deskcommcrm`), com links para o arquivo e SHA. Mem0, se adotado, deve apenas acelerar recuperação de resumos; não recebe autoridade para alterar docs.

Pipeline: commit/documento -> worker idempotente -> extração de fatos/episódios -> Graphiti -> link de origem. Mudanças de documento invalidam ou versionam fatos antigos; nenhuma inferência vira regra sem revisão humana.

### 3. Memória por cliente final

O schema já cobre o registro factual: `contacts` tem `organization_id`, identidade, tags, consentimento e anonimização; `conversations` liga contacto e organização; `messages` preserva histórico; `crm_lead_activities` registra eventos com índices por organização/contacto/lead. Isso é suficiente para auditoria, timeline e obrigações RGPD.

O que falta é recuperação semântica e temporal: preferências expressas, entidades mencionadas, motivos de compra, promessas e resumo de episódios. Projetar isso como projeção Graphiti por contacto:

`group_id=tenant:{org}:contact:{contact_id}` para fatos privados do contacto; `source_id` obrigatório para voltar ao CRM; confiança, validade e `last_confirmed_at`; nenhum dado de outro contacto/tenant no mesmo resultado. Embeddings podem acelerar busca, mas não substituem filtros SQL nem autorização.

### 4. Memória dos agentes de produto

Atendimento, vendas e retenção compartilham memória **do mesmo tenant e contacto**, não memória global. O runtime deve:

1. carregar janela curta da conversa atual diretamente de `messages`;
2. buscar no Graphiti fatos semânticos e episódios recentes do namespace do contacto;
3. buscar políticas/FAQ no Obsidian/RAG do tenant (conhecimento, não memória de pessoa);
4. aplicar regras procedurais do agente (playbook versionado) separadas dos fatos;
5. ao terminar, gravar evento no CRM primeiro e emitir outbox idempotente para atualização da memória derivada.

Agentes diferentes podem ler o mesmo `tenant/contact` com ACL comum, mas escrevem `agent_type` e `run_id`. Memória privada de um agente usa namespace adicional `tenant:{org}:agent:{agent_type}`; nunca fazer fallback silencioso para outro tenant. Handoff humano e decisões sensíveis devem ser fatos no CRM/audit, não somente no grafo.

## Contrato lógico mínimo

```text
MemoryRecord {
  id, organization_id, scope, subject_type, subject_id,
  kind: semantic | episodic | procedural,
  content_or_edges, source_table, source_id,
  conversation_id?, message_id?, agent_type?, run_id?,
  valid_at?, expires_at?, confidence, consent_basis,
  extractor_version, created_at, updated_at
}
```

Chaves de isolamento: `organization_id` validado no gateway + `group_id` determinístico. Toda operação deve ser idempotente por `(organization_id, source_id, extractor_version, kind)`; retries não duplicam episódios.

## Escolha tecnológica

- **Graphiti/Neo4j:** melhor encaixe para relações temporais entre contacto, conversa, produto, promessa e resultado; já existe no VPS. Requer disciplina de `group_id`, backups, limites de consulta e observabilidade.
- **Mem0:** útil como camada de extração/consolidação e API de memória por entidade; a documentação confirma escopos adequados. Se escolhido, deve persistir no mesmo contrato de namespaces e não duplicar Graphiti sem ownership claro.
- **Letta/MemGPT:** padrão de runtime de agente stateful e blocos hierárquicos; não é necessário como datastore adicional enquanto o Agent OS já possui runtime.
- **LangMem:** vocabulário e padrões de consolidação úteis; pode inspirar o worker, não exige novo serviço.
- **Cognee e similares:** avaliar apenas em benchmark controlado de recall, latência, custo e isolamento; não introduzir no caminho crítico agora.

## Plano seguro

**Agora (sem infraestrutura):** congelar a decisão acima, documentar contrato de namespace, inventariar env/config dos compose parados sem iniciar serviços, e criar testes de contrato que provem rejeição cross-tenant e idempotência.

**Antes de religar:** backup restaurável de Neo4j/Postgres, healthchecks, autenticação interna, limites de memória, política RGPD, métricas, runbook de rollback e um tenant sintético sem PII.

**Piloto:** ligar apenas em ambiente isolado; projetar mensagens aprovadas de um tenant sintético; medir recall temporal, latência p95, duplicação e tentativa de fuga. Só depois habilitar leitura para um agente em modo sombra.

**Critério de adoção:** PASS somente com testes cross-tenant, reprocessamento idempotente, redaction por origem e recuperação após restart. Até esses gates, estado recomendado é `NO-GO para religar`.

## Não fazer

Não migrar a memória Markdown pessoal para banco; não indexar todo o Obsidian como memória de cliente; não enviar transcript bruto para serviço externo sem base legal; não permitir que `organization_id` venha do prompt; não tratar container “pronto” ou MCP configurado como prova de disponibilidade; não manter Mem0 e Graphiti escrevendo o mesmo fato sem ownership.
