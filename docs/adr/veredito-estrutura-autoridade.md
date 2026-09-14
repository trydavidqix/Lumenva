# Veredito — ESTRUTURA/AUTORIDADE

Data: 2026-09-12. Documentos: 03, 06, 08 e 12. Base: `PLANO-FINAL-DEFINITIVO.md` e `/home/claude/master-blueprint-IMPLEMENTAVEL.md`.

## Veredito executivo

**Aprovar com consolidação e execução faseada.** Os documentos 03 e 06 trazem contratos úteis de autoridade, registry, lifecycle, reviewers, kill-switches, personalidade/afeto bounded e evidência. Devem reforçar as Waves 1/2, não criar um runtime paralelo. Os documentos 08 e 12 são mapas de destino/catálogos, não prova de 154/177/192 agentes implementados.

O caminho mais rápido ao primeiro cliente pagante permanece a prioridade. Em paralelo, implementar já o núcleo exigido pelo dono: personalidade/emocão sintética bounded, memória de agentes com provenance/isolamento e documentação. O Alfred Personal OS (12) permanece separado do Business OS; não unir memória, autoridade, credenciais ou namespaces sem decisão expressa.

## Veredito por documento

### 03 — Agent Authority OS

**APROVADO como contrato canónico de autoridade.**

- **FACT:** separa `CORE` imutável, `CAPABILITIES` concedidas externamente, `OPERATIONAL CONFIG` parcialmente mutável e `STATE` mutável; define P0 Observe, P1 Work, P2 Operate, P3 Sensitive e P4 Privileged.
- **FACT:** proíbe autoelevação, alteração do CORE, exposição de segredos e bypass de aprovação; exige capability map, reviewers, receipts P2+ e Secret Proxy.
- **FACT:** o plano atual já prevê Permission Controller P0–P4, AgentDefinition, CORE/STATE, action receipts, Secret Proxy e evidence.
- **INFERENCE:** é a especificação narrativa mais forte para transformar a Wave 1 em contratos TypeScript/SQL testáveis; não deve gerar um segundo permission engine.
- **CONTRADITO:** Maestri é descrito como coordenador amplo, mas não pode tornar-se emissor paralelo nem conceder privilégios. **Resolução:** manter `tenant/RLS → entitlement → dependências → capability/role → P0–P4 → approval → action`; Maestri orquestra, Permission/Approval Engine decide.
- **UNKNOWN:** não há prova de implementação desses perfis em todas as superfícies atuais.

**Ruído:** listas de permissões/perfis sem consumidor, schema ou teste. `production.write`, sudo, migração e segredos ficam P3/P4, fora do corte inicial.

### 06 — Master Agent Registry V1

**APROVADO como catálogo versionado e fonte de requisitos; não como publicação automática dos 154 papéis.**

- **FACT:** declara 154 papéis em desenho, sem conceder permissões nem publicar agentes automaticamente.
- **FACT:** cada registo inclui manager/reviewer, personalidade, afeto, wake, skills, tools, memória, KPI, autonomia, budget e kill-switch; agentes começam em `SHADOW`/`DRAFT` e só ganham autonomia por evals.
- **FACT:** afeto é determinístico/bounded e falhas verificadas aumentam cautela; confiança relacional não concede permissões; auditoria canónica não pode ser apagada.
- **INFERENCE:** complementa `AgentDefinition` do blueprint com governança de promoção/rebaixamento e owner/manager/reviewer.
- **CONTRADITO:** autonomia/budget por papel pode ser confundida com entitlement comercial. **Resolução:** entitlement continua gate separado e anterior; personalidade, confiança, memória e KPI nunca derivam `ALLOW`.
- **UNKNOWN:** não há schema/seed/runtimes/evals provados para os 154 registos.

**Ruído:** materializar 154 agentes e Big Five completo antes do primeiro cliente. Manter os restantes como `catalog`.

### 08 — Organograma 154 Agents

**MERGE PARCIAL como catálogo e sequência de ativação; rejeitar como organograma executável imediato.**

- **FACT:** define 17 macrosetores, 58 departamentos, níveis Owner→Maestri/Guardian/Auditor/GC/CFO→C-level→specialists/workers e 154 papéis.
- **FACT:** V1 governo e V2 workforce control plane, além de receita, customer, legal, finance, security, memória e research; exige owner, manager, reviewer, escopo, tools, autonomia, budget, eval, wake/sleep, audit, kill-switch e rollback.
- **INFERENCE:** é útil como taxonomia de `department`, `role`, `manager`, `reviewer` e `escalation_target` no registry.
- **CONTRADITO:** “25 estruturais, 30–40 disponíveis, 6–12 executando, 2–5 heavy workers” não pode ser requisito agora e conflita com a arquitetura lazy dos agentes existentes. **Resolução:** usar números só em benchmark; materializar apenas o corte comercial e de governança.
- **UNKNOWN:** não há prova de capacidade, custo, workload, runtime ou necessidade de cada departamento.

**Ruído:** headcount, staffing e runtimes dedicados sem dor comprovada; `Task Dispatcher`, `Shift Manager`, `Model Router`, `Memory Consolidator` e equivalentes devem ser responsabilidades de componentes existentes, não duplicatas.

### 12 — Owner OS / Alfred Organograma Absoluto

**KEEP a fronteira constitucional; MOVE a implementação pessoal para roadmap Alfred próprio.**

- **FACT:** declara 177 papéis Lumenva, 9 agentes pessoais Alfred e 6 componentes do Security Kernel; separa `Owner Finance != Lumenva Finance`.
- **FACT:** define Alfred como domínio do Owner, Maestri como domínio empresarial e Owner acima dos dois.
- **FACT:** enumera saúde, casa, dispositivos, património, documentos e memória pessoal como domínios distintos; não prova runtime, persistência, chaves ou isolamento.
- **CONTRADITO:** “Memory Federation” pode ser lida como memória partilhada e a regra “Owner manda nos dois” pode ser lida como bypass de Permission Controller. **Resolução:** federation apenas como protocolo de interoperabilidade; ledgers, namespaces, ACLs, chaves e retention separados; toda ponte tem scope, purpose, expiry, redaction, approval e receipt.
- **CONTRADITO:** 177+9+6 não coincide com 154 do 08 nem com o registry 06. **Resolução:** números são `ASSUMPTION`/target; adotar IDs versionados e estados `catalog → registered → implemented → certified → active`.
- **UNKNOWN/DECISÃO A CONFIRMAR:** natureza exata dos 6 kernel roles e contrato Alfred→Maestri; não transferir memória pessoal ou autoridade por omissão.

**Ruído:** executar domínios pessoais, saúde, casa, viagens, finanças ou device bridge agora; isso não ajuda o primeiro cliente e pode contaminar dados empresariais.

## Contradições e resolução transversal

1. **FACT:** o plano atual tem entitlement comercial e Permission Controller separados. **INFERENCE:** manter dois boundaries: entitlement responde “tenant comprou módulo?”; autoridade responde “este agente pode executar?”. Nunca usar papel, afeto, confiança, memória ou prompt para bypass.
2. **FACT:** o plano atual tem 22 agentes mapeados/lazy specialists e Agent Factory. **CONTRADITO:** 154/177/192 como runtime já existente. **Resolução:** `role_catalog` único; diff formal contra os 22; restante `catalog_only` ou `runtime_specialist`.
3. **FACT:** o dono exige personalidade, memória e documentação já. **CONTRADITO:** sequências que colocam Psyche/memória só em Waves posteriores. **Resolução:** núcleo bounded e auditável agora; PsycheOS avançada, Graphiti e workforce completo depois.
4. **FACT:** cadeia de comando não equivale a privilégio. **CONTRADITO potencial:** `LEVEL 1` poderia parecer superior a `LEVEL 4`. **Resolução:** registry guarda independentemente `organizational_level`, `autonomy_level`, `permission_profile`, `tenant_scope`, `approval_scope` e `veto_scope`; nível organizacional nunca concede acesso.
5. **FACT:** Alfred e Business OS são domínios distintos. **CONTRADITO:** memória federada ou Owner Gateway único com retrieval cruzado. **Resolução:** deny-by-default e namespaces `owner:personal:*`, `project:lumenva:*`, `tenant:{organization_id}:*`; ponte mínima, aprovada e auditada.

## Ações concretas

1. Consolidar `AgentDefinition`, `AuthorityPolicy`, `AutonomyPolicy`, `BehaviorContract`, `MemoryPolicy`, `ToolPolicy`, `SourceProvenance` e `Birth Contract`, com owner/manager/reviewer, data scope, lifecycle e rollback.
2. Implementar `AuthorityEnvelope`/Policy Engine P0–P4 com `intersect(parent, child)` sem alargamento e `persistence_never_raises_authority=true`; adicionar evals de self-grant, prompt injection, cross-tenant e secret extraction.
3. Criar registry manifest canónico com IDs/versões/estado; importar primeiro governo, registry/workforce, revenue/support e os papéis de memória/afeto/documentação. Marcar restantes `catalog_only`.
4. Reutilizar `event_log`/audit para receipts P2+: `agent_id`, `task_id`, tenant, policy decision/version, reviewer, approval, idempotency key, result e evidence redigida.
5. Implementar lifecycle `catalog → draft → shadow → assisted → auto_low_risk → auto_expanded_readonly`; design autonomy nunca é deployed autonomy.
6. Implementar `affect_state` bounded, evidence-linked e append-only para sucesso, falha verificada, incidente, recuperação e `frustration_cap`; afeto só altera tom/cautela/verificação, nunca policy, factualidade, preço, entitlements ou aprovação.
7. Construir Memory Gateway mínimo com `MemoryRecord`, provenance, confidence, TTL, redaction e isolamento por tenant/agente; proposta → aprovação/store. Alfred e Business OS têm ledgers/namespaces/gateways separados.
8. Adicionar Documentation Intake Report e Definition of Ready a cada agente publicado; documentação de autoridade/registry no mesmo change set.
9. Ligar o corte pagante (lead→conversa→qualificação→proposta→pagamento→entrega→suporte/cobrança) ao gate comercial e aos receipts; legal/compliance e finance entram como capabilities mínimas, não como dezenas de agentes.
10. Codificar Alfred→Maestri com `request_id`, purpose, owner approval, capability, resource scope, `expires_at`, payload redigido, revogação, result e evidence. Sem scope/expiry: `DENY`.
11. Criar ADR que reconcilie 154/177/192 sem apagar a visão; nenhum número pode promover agente ou autorizar execução.

## Gates de aceitação

- Dois tenants: entitlement e autoridade decidem independentemente, com `ALLOW`/`DENY` correto.
- Agente filho não alarga envelope; memória, handoff, afeto e persistência não elevam autoridade.
- Agente `catalog` não executa; promoção exige eval, reviewer, política e evidência vinculada ao runtime/SHA.
- P2+ produz receipt verificável; segredos, PII fora de escopo e cross-tenant bloqueados.
- Alfred não lê memória empresarial por omissão; Business OS não lê memória pessoal por omissão; ponte sem contrato falha.
- Smoke comercial continua prioritário e não é confundido com merge, deploy, produção ou cobrança não provados.

## Estado de evidência

**FACT:** os documentos acrescentam contratos úteis de autoridade, registry, lifecycle, reviewers, kill-switches, personalidade bounded, memória e catálogo organizacional.

**INFERENCE:** a integração correta é consolidar no Business OS existente, ativar um corte mínimo orientado ao primeiro cliente e executar personalidade, memória e documentação em paralelo.

**NOT_PROVEN:** runtime completo, publicação dos agentes, coerência das contagens, isolamento Alfred/Business implementado e capacidade operacional dos números. Exigem código e gates próprios.
