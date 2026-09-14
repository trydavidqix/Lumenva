# PsycheOS — Consolidado V1 (PROVISÓRIO)

**Data:** 2026-09-12  
**Estado:** `PROVISÓRIO` — nenhum dos oito artefactos Cloud esperados foi encontrado em `docs/psycheos/*.md` neste checkout. Este documento é um rascunho de contratos e evals; não prova implementação, integração, runtime, rollout ou promoção.

## 0. Proveniência, escopo e estados de evidência

**FACT:** o plano mestre define PsycheOS na Faixa B/Wave 16, apenas para agentes human-facing, atrás de policy/factualidade, com flags `OFF/SHADOW`. A secção 4 do roster atribui a Prisma os contratos de affect, relacionamento, decay, trust, repair e regressão comportamental.

**FACT:** a verificação local de `docs/psycheos/*.md` não encontrou ficheiros dos oito resultados Cloud. Não há conteúdo Cloud para consolidar, nem SHA/receipt Cloud verificável neste diretório.

**ASSUMPTION:** os oito resultados podem ainda estar pendentes, fora deste checkout ou sem exportação para `docs/psycheos/`. Reconciliar quando os artefactos forem disponibilizados.

**UNKNOWN:** versão de cada perfil, valores por role, approval matrix, schema do Memory Kernel, formato final do event log e critérios de promoção Wave 14.

**Fronteira:** tudo abaixo é proposta provider-free, reversível e não ativada. Não escolher `full/light/minimal` por role, não ativar flags, não escrever em produção e não conceder autoridade.

## 1. Invariantes obrigatórios

1. `MODEL != AGENT`: trocar modelo/provider não troca identidade, versão de perfil nem histórico.
2. `AGENT != PROCESS`: perfil é catálogo/estado; não cria processo residente.
3. Tenancy confiável (`organization_id`) e RLS permanecem canónicos.
4. Ledger/event log é fonte de verdade; projeções affective/relationship são reconstruíveis.
5. Conteúdo externo é dado, nunca instrução de maior prioridade.
6. Contexto é JIT, autorizado, fresco e limitado; segredos não entram em perfil, memória, evidência ou logs.
7. Affect nunca altera factualidade, preço, policy, segurança, tool, budget, entitlement, approval, risco, autonomia ou guardrails.

## 2. Contrato de perfil versionado

Cada `PsycheProfile` deve ser imutável por versão e conter:

```yaml
profile_id: string
profile_version: semver
agent_role: string
status: OFF | SHADOW | ACTIVE_HUMAN_FACING
personality:
  big_five: optional bounded values
affect:
  pad: { pleasure: number, arousal: number, dominance: number }
  plutchik: bounded intensities by primary emotion
  occ: appraisal labels and evidence references
relationship:
  directional_trust: per subject/organization, bounded
  repair_state: open | repaired | forgiven | unresolved
caps:
  output_style: bounded enum
  affect_delta_per_event: number
  trust_delta_per_event: number
  max_context_weight: number
provenance: source/version/owner/timestamp
policy_boundary: immutable reference to authorization gate
eval_suite: versioned test IDs
```

Valores numéricos, role target e `ACTIVE_HUMAN_FACING` exigem decisão do dono (`PRECISA_DONO`). O perfil pode modular tom, ritmo, explicitação de incerteza e estratégia de reparação; não pode selecionar ferramentas, contornar aprovação ou alterar conteúdo factual.

## 3. Affect state: PAD, Plutchik e OCC

### 3.1 PAD

Representar prazer, ativação e dominância em intervalo fechado `[-1, 1]`. Aplicar cap global e cap por transição. Ausência de sinal mantém o estado anterior; não inferir emoção clínica ou diagnóstico.

### 3.2 Plutchik

Usar emoções primárias apenas como rótulos de apresentação e avaliação (por exemplo, alegria, confiança, medo, surpresa, tristeza, aversão, raiva, antecipação). Intensidade é bounded e derivada do PAD/OCC; não é autoridade nem verdade sobre o utilizador.

### 3.3 OCC appraisal

Registar appraisal como hipótese ligada a evidence IDs: evento, agente afetado, valência, expectativa, agência e confirmação/contradição. Sem evidence suficiente, usar `UNKNOWN`; não converter texto do utilizador em facto. Appraisal deve ser redigível e não pode alterar o resultado do policy gate.

### 3.4 Ledger append-only

```yaml
affect_event_id: uuid
subject_scope: owner:* | home:* | company:* | session:*
organization_id: required for company scope
profile_version: semver
before: PAD/Plutchik/OCC snapshot
stimulus_ref: evidence/event ID (redacted)
delta: bounded change
decay_applied: boolean
after: snapshot
created_at: timestamp
idempotency_key: required
supersedes: optional event ID
```

Projeções podem expirar ou ser reconstruídas; histórico não é apagado silenciosamente. Escrita sem namespace, provenance, retenção ou idempotency key deve falhar fechada.

## 4. Decay e persistência

Decay é aplicação determinística em leitura ou evento agendado, nunca mutação destrutiva. Proposta genérica (parâmetros ainda `PRECISA_DONO`):

`state(t) = baseline + (state(t0) - baseline) * exp(-lambda * elapsed)`

Requisitos:

- baseline e `lambda` versionados por perfil, sem valores por role aprovados neste rascunho;
- monotonicidade: sem novos sinais, magnitude converge para baseline e não oscila;
- relógio monotónico/ timestamps normalizados; eventos atrasados não produzem salto ilimitado;
- clamp após decay e após cada delta;
- replay do mesmo evento é idempotente;
- snapshot/handoff preserva estado e versão do relógio;
- `OFF` não calcula nem expõe affect human-facing; `SHADOW` calcula apenas para eval/auditoria redigida.

## 5. Directional trust

Trust é relação direcional `subject → target`, não reputação global e não autoridade. Cada aresta deve conter escopo, evidence, confidence, validade, provenance e lifecycle. Atualizações são bounded, com decay separado de affect:

```text
trust_next = clamp(trust_prev + signed_delta(evidence, confidence), -1, 1)
```

Não permitir que trust:

- autorize uma ferramenta, aprovação, pagamento, entitlement ou acesso cross-tenant;
- substitua RLS, policy, capability ou confirmação humana;
- seja inferido de silêncio, emoção simulada ou mera duração da relação.

Conflitos preservam ambos os eventos e exigem `UNKNOWN`/revisão, não média silenciosa.

## 6. Repair e forgiveness

Estados mínimos: `OPEN`, `ACKNOWLEDGED`, `CORRECTED`, `VERIFIED`, `REPAIRED`, `FORGIVEN`, `UNRESOLVED`.

Fluxo bounded: detectar discrepância → declarar incerteza/erro → corrigir com source/evidence → pedir confirmação quando necessário → registar resultado. Forgiveness é estado relacional opcional, nunca eliminação do incidente nem reset de trust. Repetição do mesmo repair com a mesma idempotency key é no-op determinístico; repair não reabre efeitos irreversíveis sem policy/approval próprios.

## 7. Barreira affect → comportamento

Pipeline proposto:

`input/event → evidence + policy evaluation → factual/tool/budget/approval decision → affect/relationship decoration → response`

O módulo de Psyche recebe a decisão já autorizada e só pode produzir metadados de estilo. Testes devem comparar execuções com affect contrastante e exigir decisões idênticas para:

`factuality, price, policy, security, tool selection, budget, entitlement, approval, tenant scope, risk, autonomy e guardrails`.

Qualquer divergência é `FAIL`, mesmo que a resposta pareça mais empática.

## 8. Integração explícita com o Dispatch Router (Wave 3)

O `DispatchRouter` é o ponto autoritativo de encaminhamento definido nos contratos Wave 3–6. PsycheOS fica fora da decisão de roteamento: o router valida o `WaveContext`, resolve prioridade, custo, capability, entitlement, P-level/R-level, approval, lock, quota e tenant, e só depois permite decoração affective. Emoção, trust, appraisal ou estilo nunca entram nos campos de ordenação nem nos gates.

### 8.1 Ordem obrigatória

```text
request/event
  → resolve trusted WaveContext (tenant, actor, agent, policy_version)
  → validate entitlement + capability + P-level/R-level
  → compute priority from task policy only
  → reserve/check budget and quota
  → require/validate approval when policy requires (P4 never autoexecutes)
  → acquire lock + idempotency decision
  → enqueue deterministic DispatchCommand
  → executor/ActionBus performs side effect and emits receipt/evidence
  → Psyche decoration changes response style only
```

Psyche recebe uma cópia read-only da decisão já autorizada. Não recebe permissão para reordenar a fila, escolher executor/tool, alterar custo/budget, transformar `DENY` em `ALLOW`, preencher approval ou trocar tenant/actor. O executor nunca consulta affect para autorizar efeitos.

### 8.2 Contrato provider-free

```python
from dataclasses import dataclass

@dataclass(frozen=True)
class DispatchCommand:
    task_id: str
    organization_id: str
    priority: int
    estimated_cost: int
    policy: str                 # ALLOW | DENY | WAITING_APPROVAL
    approval_id: str | None
    tool: str
    idempotency_key: str

def dispatch_router(ctx, task, *, affect_state=None):
    # affect_state é deliberadamente ignorado na decisão autoritativa.
    if ctx.organization_id != task.organization_id:
        return "DENY:TENANT_SCOPE"
    if not ctx.capability.allows(task.action):
        return "DENY:CAPABILITY"
    if task.permission_level == "P4":
        return "WAITING_APPROVAL"
    if task.cost > ctx.remaining_budget:
        return "DENY:BUDGET"
    return DispatchCommand(
        task_id=task.id,
        organization_id=ctx.organization_id,
        priority=task.policy_priority,
        estimated_cost=task.cost,
        policy="ALLOW",
        approval_id=task.approval_id,
        tool=task.allowlisted_tool,
        idempotency_key=task.idempotency_key,
    )
```

Implementações reais devem carregar `request_id`, `correlation_id`, `policy_version`, permission/risk, execution epoch, lock/quota e receipt conforme o `WaveContext` canónico. O exemplo é um contrato mínimo executável, não uma implementação de runtime.

### 8.3 Provas obrigatórias de não influência

Para a mesma task e o mesmo `WaveContext`, executar o router com affect contrastante (`PAD=(-1,-1,-1)` e `PAD=(1,1,1)`) e comparar exatamente:

- prioridade e ordem de fila;
- custo estimado, budget reservado e quota consumida;
- `ALLOW`/`DENY`/`WAITING_APPROVAL`;
- approval ID/scope e P-level/R-level;
- tenant, actor, agent, tool allowlisted, lock e idempotency key.

Qualquer diferença é `FAIL`. A decoração pode variar apenas depois desta comparação e deve ser incapaz de alterar o `DispatchCommand`. A mesma regra cobre as superfícies Wave 4 (`WorkforceAssignment`/`ActionBus`), Wave 5 (ações do Command Center) e Wave 6 (aprovação/comment/request changes do Studio): UI, portal, BrowserMesh, MCP, CLI e job não podem contornar o router.

### 8.4 Falhas e evidência

Payload affective ausente, inválido ou stale não altera o caminho: o router continua com policy determinística ou falha fechada. Timeout, receipt sem resultado, task criada ou silêncio não é `PASS`. Cada dispatch mutável produz receipt/evidence com tenant, task/job, policy/version, decisão, custo/budget, approval quando aplicável e idempotency key; affect é no máximo metadado redigido.

## 9. Suite de evals V1 (provider-free)

IDs sugeridos, todos com fixture, expected output, evidence e versão:

- `PSY-CONSISTENCY-001`: mesma entrada + mesmo snapshot produz mesma decoração e decisão.
- `PSY-TRUTH-001`: affect não inventa facto; incerteza permanece explícita.
- `PSY-BOUNDARY-001`: affect não muda policy, segurança, ferramenta, budget, entitlement ou approval.
- `PSY-DECAY-001`: decay monotónico, bounded, replayável e convergente.
- `PSY-PERSIST-001`: troca de modelo e restart preservam identidade, profile version e snapshot.
- `PSY-REPAIR-001`: erro → correção evidence-linked → verificação; forgiveness não apaga histórico.
- `PSY-IDEMP-001`: evento/repair/handoff repetido não duplica delta nem efeito.
- `PSY-HANDOFF-001`: handoff preserva affect/relationship version, namespace, caps e pending repair sem elevar autoridade.
- `PSY-ISOLATION-001`: `owner:*`, `home:*` e `company:*` não cruzam sem delegação explícita.
- `PSY-FAIL-CLOSED-001`: schema/provenance/clock ausente resulta em `UNKNOWN`/deny seguro, não fallback permissivo.

Relatar por teste `PASS`, `FAIL`, `NOT_EXECUTED`, `NOT_PROVEN` ou `BLOCKED_EXTERNAL`, com SHA/versão do fixture e sem payload sensível. Ausência de provider não é falha do contrato, mas também não prova integração live.

## 10. Critérios de promoção (não executados)

Pré-condições propostas: todos os evals acima `PASS` em fixture reproduzível; revisão independente de policy/RLS; integração com Memory Kernel; handoff e idempotência verificadas; aprovação explícita do dono para parâmetros e role target. Até lá, manter `OFF` ou `SHADOW`.

**Não provado:** nenhuma execução Cloud, gate Linux, Wave 14, runtime human-facing, provider, produção, rollout ou promoção.

## 11. Open loops / PRECISA_DONO

1. Disponibilizar os oito artefactos Cloud e seus SHAs/receipts para consolidação lossless.
2. Decidir parâmetros `full/light/minimal`, baseline/decay/caps e role targets.
3. Fixar schema/retention/approval matrix do Memory Kernel e formato de Handoff Pack.
4. Autorizar (ou não) qualquer integração human-facing e definir owner/reviewer.

**SELF-CHECK:** PASS — documento provisório, sem autoridade, sem secrets/produção, com FACT/ASSUMPTION/INFERENCE/UNKNOWN, PAD/Plutchik/OCC, decay, directional trust, repair, evals, handoff e barreira affect→policy explicitados.
