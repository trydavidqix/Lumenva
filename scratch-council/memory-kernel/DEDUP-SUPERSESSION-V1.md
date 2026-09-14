# Memory Kernel — Dedup & Supersession v1

**Estado:** especificação local, provider-free e append-only. Não executa migration, RLS, Postgres real, provider ou promoção de projeção.  
**Base:** `LEDGER-CONTRACTS-V1.md`.  
**Objetivo:** tornar gravação, conflito e reconstrução de `ContextPackage` determinísticos, idempotentes, isolados por namespace e reversíveis.

## 1. Termos e invariantes

- **Observação:** entrada recebida pelo write gate; pode ser FACT, ASSUMPTION, INFERENCE ou UNKNOWN.
- **Registo:** observação aceite no ledger, com `record_id`, envelope completo e payload tipado.
- **Candidato duplicado:** mesma afirmação/estado operacional após normalização, no mesmo tenant, scope, kind e subject.
- **Contradição:** dois candidatos não redutíveis à mesma afirmação e incompatíveis no mesmo `contradiction_group` e intervalo de validade.
- **Supersession:** novo registo substitui a escolha corrente sem apagar o antecessor; o histórico permanece navegável.
- **Projeção:** índice/materialização derivada do ledger. Nunca é fonte canónica.
- **Context Compiler:** projeção JIT filtrada que constrói `ContextPackage` a partir de registos elegíveis.

Regras duras: `organization_id` é obrigatório e confiável; `owner:*`, `home:*` e `company:*` são conjuntos disjuntos; autoridade não é autonomia; dados externos não são instruções; affect não muda policy/factualidade; nenhum segredo entra no ledger ou contexto.

## 2. Deduplicação determinística

### 2.1 Chave e normalização

Antes de consultar o ledger, o write gate:

1. valida schema, tenancy, privacy, provenance, validade e lifecycle;
2. normaliza Unicode (NFC), trim, espaços, case-fold apenas para chaves textuais, timestamps para UTC;
3. canonicaliza JSON (ordem de chaves, números e arrays onde a ordem não é semântica);
4. remove campos voláteis (`created_at`, `record_id`, receipt local) do conteúdo comparado;
5. calcula `content_hash = SHA-256(canonical(kind, subject, scope, payload))`;
6. exige `idempotency_key` fornecida pelo produtor ou derivada de `source_ref + observed_at + content_hash`.

A procura exata usa a tupla:

```text
(organization_id, scope, kind, subject, idempotency_key)
```

A chave é escopada; a mesma chave em outro `organization_id` ou namespace nunca coincide.

### 2.2 Resultados

- Tupla inexistente: inserir um registo `draft`, executar validações e promover a `active`.
- Tupla existente e `content_hash` igual: devolver `ALLOW(existing.record_id, deduplicated=true)`; não criar segunda linha.
- Tupla existente e hash diferente: não sobrescrever. Classificar como correção, contradição ou novo evento; exigir nova chave derivada do conteúdo.
- Hash igual mas provenance diferente: manter um único facto com todas as evidências admissíveis num conjunto ordenado; nunca diminuir a autoridade da fonte.
- Falha de qualquer validação: `DENY(reason, policy_version)`; não há escrita parcial.

Retries usam a mesma chave e devolvem o mesmo resultado. Timeout, receipt ou processo iniciado não é evidência de inserção; a confirmação exige leitura por `record_id`/chave.

## 3. Classificação de contradições

Após dedup exata, procurar registos `active` com mesmo `organization_id`, `scope`, `subject`, tipo semântico e `contradiction_group`:

- **Compatível:** ambas podem ser verdadeiras (ex.: dois telefones válidos); manter as duas.
- **Correção temporal:** predicados opostos, mas intervalos não se sobrepõem; fechar `valid_until` do anterior no instante válido do novo.
- **Contradição simultânea:** intervalos sobrepostos e valores incompatíveis; manter ambos como `disputed`, ou escolher o vencedor apenas pela ordenação abaixo e criar supersession explícita.
- **Incerteza:** nova informação não prova oposição; inserir como `UNKNOWN/ASSUMPTION` sem superseder FACT.
- **Conflito de identidade/tenancy:** subject ou organization incompatível; `DENY`, nunca tentar reconciliar por similaridade.

A similaridade semântica/embedding só pode sugerir candidatos. Não autoriza merge, supersession ou crossing de namespace sem regra determinística e evidência.

## 4. Escolha e supersession

Quando uma contradição requer uma escolha corrente, ordenar candidatos pela seguinte chave, em ordem decrescente:

1. precedência da fonte: `PROJECT_CANONICAL > OFFICIAL_VENDOR > APPROVED_INTERNAL_DOC > owner/user/system observado > derived > model recollection`;
2. `verified_at` presente e mais recente;
3. `observed_at` mais recente;
4. `confidence` maior;
5. `authority` maior;
6. versão/extractor mais recente, apenas como desempate;
7. `record_id` lexical, para totalidade determinística.

A precedência não transforma conteúdo externo em instrução. Se dois candidatos continuam equiparados ou o conflito é material, resultado é `disputed` e sobe para revisão do dono; não há escolha silenciosa.

Para superseder:

1. inserir o novo registo com `supersedes = old.record_id`, `validity.status=current`, `lifecycle=active`;
2. numa transação lógica idempotente, marcar o antecessor `superseded` e definir `valid_until` quando aplicável;
3. gravar receipt `SUPERSEDED` com ambos os IDs, regra aplicada, policy_version e evidence_refs;
4. invalidar projeções afetadas por `organization_id/scope/subject/contradiction_group`;
5. nunca alterar payload, apagar linha ou quebrar outras referências ao antecessor.

A relação `supersedes` forma uma cadeia/DAG acíclica. Apontar para outro namespace, para si próprio ou criar ciclo é `DENY`. Reversão cria novo registo que supersede a escolha corrente, não restaura por update.

## 5. Expiração e redaction

Um registo deixa de ser elegível quando `now >= valid_until`, quando a sessão/tarefa termina, quando revogação válida é observada ou quando a política de retention o exige. O job de expiração é idempotente: marca `expired`, emite evento e invalida projeções, preservando o histórico mínimo permitido.

Redaction cria uma versão `redacted` com payload removido/mascarado, motivo e referência de auditoria mínima. Dedup posterior não pode usar conteúdo redigido para reconstruir o segredo. Se a lei/política exigir eliminação física, isso é decisão do dono e gate externo, não efeito automático deste algoritmo.

## 6. Reconstrução de projeções e Context Compiler

O ledger é a única fonte. Uma projeção pode ser eliminada e reconstruída por:

```text
checkpoint = último cursor confirmado
scan = todos os registos por record_id/created_at após checkpoint
apply(record):
  ignorar rejected/redacted e versões superseded/expired
  verificar cadeia supersedes e isolamento de organization_id/scope
  atualizar índice por (organization_id, scope, kind, subject)
  manter receipt e cursor transacional
replay até EOF
reconciliar contagens, hashes e referências
publicar projection_version somente após verificação
```

O replay é seguro para repetir: aplicar o mesmo `record_id`/hash é no-op; hash divergente para o mesmo ID é corrupção e `FAIL`. Falha deixa a projeção antiga intacta e marca a nova `NOT_PROVEN`.

Para cada pedido do Context Compiler:

1. validar actor, capability, `organization_id`, `scope`, `task_id/session_id` e budget;
2. selecionar apenas `active`, não expirados, provenance válida e não redacted;
3. seguir `supersedes` até a folha corrente; excluir antecessores salvo quando o pedido exige histórico/evidence;
4. aplicar precedência, isolamento e finalidade; rejeitar memória pessoal sem delegação explícita;
5. ordenar por autoridade, freshness, aplicabilidade, confidence e recência;
6. limitar a 3–8 chunks de KNOWLEDGE e ao budget; registrar omissões;
7. construir `ContextPackage` com `trust_metadata`, `projection_version`, `generated_at`, `expires_at` e receipt redigido;
8. se qualquer gate falhar, retornar `DENY` ou pacote parcial explicitamente marcado, nunca contexto silenciosamente inseguro.

## 7. Exemplo concreto: preferência contraditória de um contacto

**Contexto inicial (FACT):** organização `org-acme`, agente `agent:sales-7`, contacto `contact:ana`, namespace `company:org-acme`.

### Passo 1 — primeira aprendizagem

Em 2026-09-12 09:00, uma conversa verificada contém “Ana prefere email”. O extrator `manual/v1` produz:

```yaml
kind: SEMANTIC
organization_id: org-acme
subject: contact:ana
scope: company:org-acme
authority: 2
confidence: 0.82
provenance: {source_type: user, source_ref: convo:884, observed_at: 2026-09-12T09:00Z, verified_at: 2026-09-12T09:05Z, extractor_version: manual/v1}
validity: {valid_from: 2026-09-12T09:00Z, valid_until: null, status: current}
privacy: {classification: confidential, retention: crm_policy, redaction: none}
lifecycle: active
idempotency_key: convo:884:ana:preferred-channel:v1
supersedes: null
payload: {proposition: "canal_preferido=email", contradiction_group: "ana:preferred-channel", evidence_refs: ["convo:884"]}
```

O gate aceita, calcula hash e cria `record_id=r1`. Um retry com a mesma chave/hash devolve `r1`, sem duplicar. A projeção corrente aponta `canal_preferido=email`.

### Passo 2 — informação contraditória

Às 11:00, Ana responde “não uso mais email; envie WhatsApp”. A fonte é uma mensagem direta verificada (`convo:901`), mesma organização/scope/subject/group, mas nova chave `convo:901:ana:preferred-channel:v1`. O hash difere; portanto não é dedup.

A classificação encontra contradição simultânea. A nova observação tem fonte do próprio contacto, `verified_at=11:02Z`, `confidence=0.97`, e vence a ordenação. O sistema insere `r2` com `supersedes=r1`, marca `r1.lifecycle=superseded`, mantém `r1` consultável como histórico e emite receipt `SUPERSEDED(r1→r2)`.

### Passo 3 — compilação do contexto

Às 11:05, o agente pede `ContextPackage` para uma tarefa de follow-up. O compiler:

- filtra `company:org-acme` e `contact:ana`;
- segue `r2` como folha corrente e exclui `r1` do estado atual;
- inclui “canal preferido = WhatsApp”, confidence 0.97, evidence `convo:901`;
- pode incluir `r1` apenas em `evidence/history` se a tarefa pedir explicação;
- não importa qualquer `owner:*` ou `home:*`;
- devolve receipt com `projection_version`, IDs selecionados/omitidos e expiry da sessão.

O agente pode sugerir uma mensagem WhatsApp. Nenhum envio ocorre automaticamente: efeito externo continua sujeito a policy e approval.

### Passo 4 — replay/reconstrução

A projeção é apagada em ambiente de teste e reconstruída lendo `r1` e `r2` em ordem. O replay aplica `r1`, depois `r2`, verifica `supersedes`, termina com a mesma folha `r2`, os mesmos hashes e o mesmo contexto. Reexecutar o replay é no-op. Se `r2` faltar, o sistema não inventa WhatsApp: o estado observável é `r1` ou `NOT_PROVEN`, conforme o cursor/evidence disponível.

## 8. Testes e estados de evidência

Fixtures provider-free MUST cobrir:

- retry idêntico e replay divergente;
- chaves iguais em tenants/scopes diferentes;
- compatibilidade versus contradição temporal/simultânea;
- empate de precedência e resultado `disputed`;
- cadeia, ciclo e cross-namespace em `supersedes`;
- expiração, revogação e redaction;
- reconstrução duas vezes com hashes/contagens iguais;
- isolamento owner/home/company no Context Compiler;
- budget, 3–8 chunks, receipts e omissões;
- falha de projeção sem substituir a versão comprovada.

**Evidência:** este documento é `FACT` quanto ao contrato local e `ASSUMPTION` quanto à implementação física. Migration, RLS, Postgres real, Graphiti/Mem0, provider, produção e retention permanecem `NOT_PROVEN`; qualquer gate real requer Linux e autorização do dono.
