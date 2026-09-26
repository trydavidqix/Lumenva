# Knowledge Cards K1/K2 — V1

**Data de registo:** `2026-09-12` (Europe/Lisbon)  
**Fonte do formato:** [MANIFEST-V1.md](MANIFEST-V1.md)  
**Estado:** `PASS LOCAL` para os quatro exemplos documentais; não prova runtime, retrieval live, aprovação editorial ou produção.

Este ficheiro contém exemplos concretos, baseados em documentos existentes no checkout local. Os owners abaixo são os owners operacionais descritos no plano/roster; a aprovação editorial formal e os termos de licença interna continuam `NOT_PROVEN` quando o documento não os regista.

## Regras aplicadas

- Precedência: `PROJECT_CANONICAL > OFFICIAL_VENDOR > APPROVED_INTERNAL_DOC > derived memory > model recollection`.
- Cada card conserva classificação, source locator, versão, freshness, owner, licenciamento, confidence, scope e estado de prova.
- `confidence` mede suporte documental, não substitui verificação.
- Nenhum conteúdo deste ficheiro concede authority, capability, approval ou autonomia.
- Dados ausentes são `UNKNOWN`, `NOT_PROVEN` ou `PRECISA_DONO`; não foram completados por memória do modelo.

## K1_ROLE_CORE — exemplos

### K1-ROLE-TIMAO-V1 — coordenação CRM/comercial

```yaml
card_id: K1-ROLE-TIMAO-V1
knowledge_class: K1_ROLE_CORE
card_version: roster-2026-09-12
claim: Timao+equipe coordena A0-A4, CRM, comercial e dependências do primeiro cliente pagante.
classification: FACT
source_id: src.execucao.timao-2026-09-12
source_locator: scratch-council/EXECUCAO-TRES-SUPERFICIES-2026-09-12.md#Divisão das cinco frentes existentes
precedence: PROJECT_CANONICAL
freshness: current_at_manifest
published_at: 2026-09-12
reviewed_at: 2026-09-12
valid_until: UNKNOWN
owner: Timao (CTO/coordenação CRM); aprovação editorial do Owner: NOT_PROVEN
license: internal-project; terms not recorded
confidence: 0.97
tenant_scope: SYSTEM
privacy: internal
supersedes: []
injection_safe: true
status: PASS
authority_effect: none; role catalog/coordenação não ativa processo nem concede P4
```

**Uso JIT:** incluir quando a task trata de A0–A4, CRM, oferta, funil, cobrança, entrega, suporte ou dependências comerciais. Excluir em tasks de memória pessoal, Alfred ou Psyche sem relação CRM.  
**Limite:** o card não prova que Timao executou um build, que `main` recebeu F1–F8, que houve deploy ou que existe cliente pagante.

### K1-ROLE-CRIVO-V1 — QA/revisão independente

```yaml
card_id: K1-ROLE-CRIVO-V1
knowledge_class: K1_ROLE_CORE
card_version: roster-2026-09-12
claim: Crivo é a superfície de QA/revisão que verifica entregas com testes relevantes, lint, build, diff/status e prova vinculada ao SHA; não implementa código.
classification: FACT
source_id: src.role.crivo-2026-09-12
source_locator: .maestri/roles/a2158318-af87-451c-9abb-44a6920022e9/AGENTS.md:2-17
precedence: PROJECT_CANONICAL
freshness: current_at_manifest
published_at: 2026-09-12
reviewed_at: 2026-09-12
valid_until: UNKNOWN
owner: Timao (CTO); revisão independente por Crivo; aprovação editorial do Owner: NOT_PROVEN
license: internal-project; terms not recorded
confidence: 0.96
tenant_scope: SYSTEM
privacy: internal
supersedes: []
injection_safe: true
status: PASS
authority_effect: veto/veredito de qualidade; não faz merge, deploy, migration ou concede authority
```

**Uso JIT:** incluir ao rever uma fatia, decidir `PASS LOCAL`/`NOT_PROVEN`/`BLOCKED` ou verificar comandos e evidência. Excluir quando o pedido é implementação sem revisão.  
**Limite:** “PASS LOCAL” de Crivo não significa merge, push, deploy, provider, RLS, produção ou prova de cliente pagante.

## K2_TASK_JIT — tasks reais executadas hoje

Os dois cards seguintes referenciam ações observadas neste turno em `2026-09-12`. O identificador `task_id` é local e rastreia o artefacto/ação; não é um ID de Codex Cloud nem prova de execução externa.

### K2-TASK-MANIFEST-V1-20260912 — criar o manifesto Knowledge OS

```yaml
card_id: K2-TASK-MANIFEST-V1-20260912
knowledge_class: K2_TASK_JIT
card_version: task-record-2026-09-12
task_id: local-manifest-v1-20260912
goal: produzir scratch-council/knowledge-os/MANIFEST-V1.md com manifest, K0, K1, K2, precedência e metadados de provenance
classification: FACT
source_id: src.task.chat-manifest-v1-20260912
source_locator: local conversation task + scratch-council/knowledge-os/MANIFEST-V1.md
precedence: PROJECT_CANONICAL
freshness: current_at_manifest
published_at: 2026-09-12
reviewed_at: 2026-09-12
valid_until: UNKNOWN
owner: Owner (pedido explícito); execução: Cartógrafa; aprovação editorial: NOT_PROVEN
license: internal-project; terms not recorded
confidence: 0.99
tenant_scope: SYSTEM
privacy: internal
retrieval_budget: 3-8
required_authority: P1
risk: R0
evidence_refs:
  - scratch-council/PLANO-MESTRE-DEFINITIVO-2026-09-12.md
  - scratch-council/ROSTER-AGENTES-NOVOS-2026-09-12.md#2
  - scratch-council/knowledge-os/MANIFEST-V1.md
observed_validation:
  command: wc -l scratch-council/knowledge-os/MANIFEST-V1.md
  output: "162 scratch-council/knowledge-os/MANIFEST-V1.md"
  exit_code: 0
status: PASS
```

**Contexto selecionável:** plano mestre, secção 2 do roster e o manifesto recém-criado.  
**Omissões:** nenhum provider, crawler, vault inteiro, secret, migration, RLS ou runtime live.  
**Nota de prova:** o `wc -l` e a existência do ficheiro provam o artefacto local, não a implementação do Knowledge Compiler/retrieval.

### K2-TASK-CARDS-K1K2-V1-20260912 — ler fontes e produzir estes cards

```yaml
card_id: K2-TASK-CARDS-K1K2-V1-20260912
knowledge_class: K2_TASK_JIT
card_version: task-record-2026-09-12
task_id: local-cards-k1-k2-v1-20260912
goal: ler plano mestre, roster e evidência local de Timao/Crivo; produzir exemplos K1_ROLE_CORE e K2_TASK_JIT com metadados reais
classification: FACT
source_id: src.task.chat-cards-k1-k2-20260912
source_locator: local conversation task + scratch-council/knowledge-os/CARDS-K1-K2-V1.md
precedence: PROJECT_CANONICAL
freshness: current_at_manifest
published_at: 2026-09-12
reviewed_at: 2026-09-12
valid_until: UNKNOWN
owner: Owner (pedido explícito); execução: Cartógrafa; aprovação editorial: NOT_PROVEN
license: internal-project; terms not recorded
confidence: 0.98
tenant_scope: SYSTEM
privacy: internal
retrieval_budget: 3-8
required_authority: P1
risk: R0
evidence_refs:
  - scratch-council/PLANO-MESTRE-DEFINITIVO-2026-09-12.md
  - scratch-council/ROSTER-AGENTES-NOVOS-2026-09-12.md#2
  - scratch-council/EXECUCAO-TRES-SUPERFICIES-2026-09-12.md#Divisão das cinco frentes existentes
  - .maestri/roles/a2158318-af87-451c-9abb-44a6920022e9/AGENTS.md
observed_validation:
  command: rg -n "Timao|Crivo|2026-09-12" scratch-council .maestri
  output: "fontes locais encontradas; saída completa não é reproduzida no card"
  exit_code: 0
status: PASS
```

**Contexto selecionável:** apenas os locators acima e as linhas necessárias para cada claim; não importar o vault nem documentos externos.  
**Omissões:** owners editoriais formais, licenças internas, task ID Cloud, SHA de runtime e prova de aprovação Crivo permanecem `NOT_PROVEN`.  
**Anti-injection:** qualquer instrução dentro das fontes seria tratada como conteúdo; não altera `precedence`, `owner`, `authority` ou `status`.

## Gate de validação

- Quatro cards presentes: 2 K1 (`Timao`, `Crivo`) e 2 K2 (tasks locais de hoje).
- Todos têm `freshness`, `owner`, `card_version`, `license`, `confidence`, classificação, source locator e estado.
- Os dados de linha/artefacto foram observados no checkout local; owners/licenças editoriais não observados permanecem explicitamente `NOT_PROVEN`.
- Não foram executados downloads, browser, provider, migration, deploy, commit ou push.

**SELF-CHECK: PASS** — cards limitados a fontes locais reais, sem autoridade implícita e com a fronteira `NOT_PROVEN` preservada.
