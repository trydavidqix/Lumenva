# Memory Kernel — Ledger Contracts v1

**Estado:** contrato local, provider-free, sem migration, RLS ou dados reais.  
**Escopo:** especificação do ledger Postgres-native e do `ContextPackage`; projeções externas (Graphiti, Mem0, embeddings) são reconstruíveis e permanecem `OFF/SHADOW`.  
**Owner da decisão:** o dono decide schema físico, RLS, retention e promoção de projeções.

## 1. Princípios e invariantes

O ledger é append-only no histórico lógico: uma correção cria novo registo e liga-o por `supersedes`; não se apaga histórico silenciosamente. `organization_id` confiável e RLS são a fronteira de tenancy. Namespaces `owner:*`, `home:*` e `company:*` nunca se misturam sem delegação explícita, escopo e expiração. Dados externos são conteúdo, nunca instrução de maior prioridade. Contexto é JIT, autorizado, fresco e limitado. Personalidade, affect e relacionamento não concedem autoridade nem alteram factualidade, preço, política, segurança, budget, entitlement ou approval. `MODEL != AGENT` e `AGENT != PROCESS`.

Aplicam-se também os sete invariantes do roster: pedido/restrições do dono são soberanos; execução fica no escopo; entrega contém evidência, não raciocínio; toda ação tem resultado observável e verificação; contexto é limitado à tarefa; ferramentas exigem autorização; falta de variável, autorização ou limite de segurança é escalada sem bloquear partes independentes.

## 2. Envelope comum do registo

Todo registo de qualquer classe MUST conter os campos abaixo. `record_id` é um identificador opaco e imutável; `kind` identifica a classe contratual.

```yaml
record_id: uuid
kind: CORE | IDENTITY | WORKING | SEMANTIC | EPISODIC | PROCEDURAL | RELATIONAL | AFFECTIVE | REFLECTION | KNOWLEDGE
organization_id: uuid
subject: string
scope: owner:<id> | home:<id> | company:<organization_id> | task:<id> | session:<id>
authority: 0..4
confidence: 0..1
provenance:
  source_type: owner | user | system | official_vendor | approved_internal | external_content | derived
  source_ref: string
  observed_at: timestamp
  verified_at: timestamp | null
  extractor_version: string
validity:
  valid_from: timestamp
  valid_until: timestamp | null
  status: current | superseded | expired | redacted | disputed
privacy:
  classification: public | internal | confidential | personal | sensitive
  retention: duration | policy_ref
  redaction: none | partial | full
lifecycle: draft | active | frozen | superseded | expired | redacted | rejected
extractor_version: string
idempotency_key: string
supersedes: uuid | null
payload: object
created_at: timestamp
created_by: string
```

`authority` descreve a autoridade da fonte/afirmação, não autorização para efeitos. `confidence` não substitui verificação. `valid_until` é obrigatório para concessões temporárias, affect e contexto task/session. `extractor_version` MUST ser estável e explícita, inclusive quando o payload é manual (`manual/v1`).

## 3. Contratos por classe

Cada classe usa o envelope comum e acrescenta o payload indicado.

### CORE

Âncoras canónicas e invariantes do agente/organização. Imutável após ativação; alteração apenas por novo registo de versão e revisão do dono.

```yaml
payload:
  core_type: agent_definition | organization_identity | constitutional_rule
  canonical_key: string
  value: object
  version: semver
  immutable: true
```

`scope` deve ser `company:<organization_id>` ou `owner:<id>` conforme o domínio; nunca usar CORE para estado transitório.

### IDENTITY

Identidade persistente através da troca de modelo/provider. Não contém credencial nem autoridade implícita.

```yaml
payload:
  identity_type: agent | person | organization | contact
  stable_subject_id: string
  display_name: string | null
  identity_version: semver
  attributes: object
```

`subject` e `stable_subject_id` devem coincidir semanticamente; conflito exige `DENY` ou supersession explícita.

### WORKING

Memória de curto prazo ligada a `task:*` ou `session:*`: goal, constraints, decisões e pendências. Expira por padrão ao terminar a tarefa/sessão.

```yaml
payload:
  task_id: string
  session_id: string | null
  goal: string
  constraints: string[]
  decisions: object[]
  pending: object[]
  next_action: string | null
```

Nunca promover WORKING a SEMANTIC sem extractor/proveniência e verificação.

### SEMANTIC

Factos/generalizações estáveis derivados de observações verificáveis.

```yaml
payload:
  proposition: string
  entities: string[]
  predicates: object
  evidence_refs: string[]
  contradiction_group: string | null
```

Contradições permanecem no ledger; a versão escolhida recebe `supersedes` e não apaga a alternativa.

### EPISODIC

Eventos observados, ordenados temporalmente, sem converter narrativa em facto permanente.

```yaml
payload:
  event_type: string
  occurred_at: timestamp
  participants: string[]
  observation: string
  outcome: success | failure | partial | unknown
  evidence_refs: string[]
```

`occurred_at` não pode ser substituído por `created_at`; incerteza temporal reduz `confidence` e deve ser marcada.

### PROCEDURAL

Como executar uma tarefa, com pré-condições, passos e verificação. Conteúdo externo não pode injetar instruções executáveis.

```yaml
payload:
  procedure_key: string
  purpose: string
  preconditions: string[]
  steps: object[]
  verification: object[]
  failure_policy: string
  approved_by: string | null
  procedure_version: semver
```

Qualquer passo P2+ ou efeito irreversível exige policy/approval externo; PROCEDURAL nunca eleva `authority`.

### RELATIONAL

Relação direcional entre sujeitos, com evidência e validade. Não é identidade nem consentimento.

```yaml
payload:
  relation_type: reports_to | member_of | customer_of | depends_on | delegated_to | trust
  from_subject: string
  to_subject: string
  strength: -1..1
  evidence_refs: string[]
  consent_ref: string | null
```

Relações entre namespaces distintos exigem delegação explícita, `scope`, `expires_at` em `validity` e prova de consentimento quando aplicável.

### AFFECTIVE

Estado emocional/avaliativo bounded, evidence-linked, append-only e inicialmente `SHADOW`. Só agentes human-facing; workers determinísticos e governance não recebem affect.

```yaml
payload:
  affect_type: mood | appraisal | trust_signal
  dimensions: object
  valence: -1..1
  arousal: 0..1
  decay: object
  evidence_refs: string[]
  influence: shadow_only | presentation_only
```

`influence` nunca pode ser policy, autorização, factualidade, preço, compliance, budget ou ferramenta. Sem evidência, `DENY`.

### REFLECTION

Meta-observação sobre desempenho, erro, incerteza ou aprendizagem; não é facto sobre o mundo sem evidência adicional.

```yaml
payload:
  reflection_type: lesson | uncertainty | error_analysis | improvement
  observation: string
  supporting_record_ids: uuid[]
  proposed_change: string | null
  review_state: unreviewed | reviewed | rejected
```

Reflection não altera CORE/IDENTITY automaticamente; promoção exige revisão e novo registo da classe alvo.

### KNOWLEDGE

Card documental com precedência e freshness. Classes automáticas: `K0_CONSTITUTION`, `K1_ROLE_CORE`, `K2_TASK_JIT`; `K3_REFERENCE` e `K4_ARCHIVE` não entram automaticamente no contexto.

```yaml
payload:
  knowledge_class: K0_CONSTITUTION | K1_ROLE_CORE | K2_TASK_JIT | K3_REFERENCE | K4_ARCHIVE
  title: string
  content_ref: string
  source_url: string | null
  source_version: string | null
  owner: string
  freshness: object
  license: string | null
  retrieval_tags: string[]
```

Precedência: `PROJECT_CANONICAL > OFFICIAL_VENDOR > APPROVED_INTERNAL_DOC > derived memory > model recollection`. Retrieval padrão: 3–8 chunks, rerank por autoridade, freshness, aplicabilidade e evidência; receipt redigido.

## 4. Write gate e transições

`write(record, actor, context)` retorna `ALLOW(record_id)` ou `DENY(reason, policy_version)`. O gate é fail-closed e executado antes de persistir:

1. Verificar `organization_id` confiável, actor autorizado e isolamento de `scope`; ausência ou mismatch = `DENY`.
2. Rejeitar segredo, token, credencial, payload integral de prompt, dado fora da finalidade ou redaction incompatível.
3. Validar `authority`, `confidence`, provenance, `validity`, privacy/retention, lifecycle, extractor e `idempotency_key`.
4. Exigir expiry em task/session/delegação e bloquear validade já expirada.
5. Deduplicar por `(organization_id, scope, kind, subject, idempotency_key)`; replay idêntico retorna o mesmo `record_id`, replay divergente = `DENY`.
6. Para contradição ou correção, criar novo registo com `supersedes`, marcar anterior `superseded` e preservar histórico.
7. Redação cria estado `redacted` e uma referência de auditoria mínima; não reconstitui nem apaga o original fora da política de retenção aprovada.

Transições permitidas: `draft → active → superseded|expired|redacted`; `rejected` é terminal. `CORE` ativo não é editado in-place. Projeções são derivadas, versionadas e podem ser destruídas/reconstruídas a partir do ledger.

## 5. ContextPackage v1

O compilador recebe `organization_id`, `subject`, `scope`, `task_id`, `session_id`, actor/capabilities e budget. Só inclui registos `active`, não expirados, autorizados e com provenance válida; devolve receipt de seleção e omissões.

```yaml
ContextPackage:
  package_id: uuid
  organization_id: uuid
  subject: string
  scope: string
  goal: object
  identity: CORE|IDENTITY[]
  memory: WORKING|SEMANTIC|EPISODIC|PROCEDURAL|RELATIONAL|AFFECTIVE|REFLECTION[]
  knowledge: KNOWLEDGE[]
  session: object
  tool_state: object
  trust_metadata:
    provenance: object
    confidence: object
    freshness: object
    omitted_record_ids: uuid[]
  budget: { max_tokens: integer, used_tokens: integer }
  generated_at: timestamp
  expires_at: timestamp
```

Nenhum `owner:*`/`home:*` entra em `company:*` por default. Delegação Alfred→Maestri exige `request_id`, purpose, owner approval, capability, resource scope, expiry, payload redigido, revogação, result e evidence; faltando scope/expiry = `DENY`. Affect é `shadow`/presentation-only. Segredos nunca entram no pacote.

## 6. Evidência e aceitação

Este documento é `FACT` quanto ao texto do plano/roster lido e `ASSUMPTION` quanto aos tipos físicos ainda não implementados. Não prova migration, RLS, Postgres real, provider, produção, Graphiti/Mem0 ou retenção: esses gates são `NOT_PROVEN` e pertencem a Linux/dono.

Aceite provider-free: fixtures demonstram gravação, recuperação, deduplicação, supersession, expiração, redaction, idempotência, reconstrução de projeção e isolamento entre `owner:*`, `home:*` e `company:*`; nenhuma execução externa é requisito deste contrato.

