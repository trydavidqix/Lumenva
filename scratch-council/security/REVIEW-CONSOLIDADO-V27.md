# Revisão consolidada — Wave 2 authority, Wave 6 portal tokens, consent TOCTOU e Wave 14 receipts

Data: 2026-09-13  
Método: leitura read-only no worker, testes Vitest independentes e PostgreSQL descartável quando o teste conectou. Nenhum segredo foi exposto; containers criados foram removidos.

## 1. Vértice — Wave 2 Agent Birth server-side authority

Worktree: `/home/claude/src/worktrees/wave2-agent-birth-2026-09-12`, HEAD `d4a88e85` (`feat(agent-birth): enforce server-side authority`). O Registry agora exige `authorityStore.verify(...)` antes de certificar; o store devolve actor canônico ativo e approval canônico, ambos vinculados por tenant, definição/versão e ator autor. O adapter PostgreSQL usa predicados server-side para `tenant_id`, actor ativo, `approval_id`, `definition_id`, `definition_version`, `author_actor_id`, `approver_id` e `status='APPROVED'`.

Teste real: **4 arquivos, 31 testes, exit 0** (`agent-definition` 15, Registry 7, authority store 3, Prompt Compiler 6). O teste PostgreSQL do authority store é apenas um fake queryable que inspeciona SQL; não houve banco real/RLS.

**PASS-CONDICIONAL.** O bypass por objeto de approval fornecido pelo caller foi fechado no código; falta prova de integração contra schema/RLS real e teste de capability do approver fora do payload.

## 2. Vértice — Wave 6 client portal token store

Worktree: `/home/claude/src/worktrees/wave6-studio-comercial-2026-09-12`, HEAD `3b4d4a8e`. O store grava `token_hash` SHA-256, escopa `organization_id` e `project_id`, exige não revogado/não expirado e usa `UPDATE ... WHERE ... (single_use=false OR used_at IS NULL) RETURNING`, tornando consumo único atômico. A migration `0166_studio_client_portal_tokens.sql` define chave, unique `(organization_id, token_hash)`, checks de scope/hash e RLS via `fn_user_org_ids()`.

Teste unitário: **2 testes passaram, exit 0**. Teste de integração com PostgreSQL descartável: **1 teste passou, exit 0**; 16 consumes concorrentes produziram exatamente um resultado e um `used_at`. A tabela usada foi um schema mínimo equivalente; a migration completa/RLS não foi aplicada no harness.

**PASS-CONDICIONAL.** Atomicidade e isolamento por predicados foram provados; RLS da migration e integração com `organizations`/função de claims continuam NOT_PROVEN.

## 3. Fornalha — consent gate TOCTOU (`fn_publish_content_if_consent`)

Worktree: `/home/claude/src/worktrees/wave12-marketing-content-2026-09-13`, HEAD `801f5de8`. A função SQL é `security invoker`, bloqueia lista vazia, seleciona consentimentos do tenant com `FOR UPDATE`, rejeita status não `GRANTED`, futuro, revogado ou expirado, verifica contagem completa e só então atualiza `content_items` também filtrado por organização. `publishContentItem` faz preflight e exige `publishWithConsent` atômico para requisitos de consentimento.

Teste unitário: **7 testes passaram, exit 0**. O teste de integração TOCTOU foi executado sem `DATABASE_URL` e ficou **1 teste skipped**; a tentativa de harness descartável não chegou a executar a função por erro de criação SQL do harness (`unrecognized exception condition "publication_consent_required"`). Portanto, a corrida de revogação durante o lock não foi independentemente reproduzida nesta rodada.

**PASS-CONDICIONAL.** O desenho SQL fecha a janela TOCTOU no código lido, mas a prova concorrente real permanece NOT_PROVEN.

## 4. Telar — Wave 14 PostgresEvolutionReceiptStore + ActionBus

Worktree: `/home/claude/src/worktrees/wave14-15-evals-autonomy-2026-09-12`, HEAD `565dd5ca`. `ActionBus` valida actor/capability/tenant e exige requester quando há persistência. `PostgresEvolutionReceiptStore` revalida requester autenticado, usa `INSERT ... ON CONFLICT (organization_id, actor_id, action_id, idempotency_key) DO NOTHING`, e recupera receipt existente pela mesma chave. Migration define primary key composta e status limitado a `PERSISTED`.

Teste com PostgreSQL descartável: **2 de 3 testes passaram** (requester não autenticado e ActionBus ligado ao store real). O teste de dois processos falhou com **timeout 15 s** e dois erros não tratados `spawn /usr/bin/node ENOENT`; o teste não chegou a disputar a chave. O unitário ActionBus adicional passou (**7 testes, exit 0**). Não há prova concorrente independente válida nesta execução.

**BLOCKED.** A SQL é fail-safe e a integração de um processo passou, mas a prova exigida de concorrência real falhou por erro concreto do runner (`/usr/bin/node` inexistente). Corrigir o caminho de Node/runner e repetir dois processos contra PostgreSQL antes de aprovar.

## Veredito consolidado

- Wave 2 server-side authority: **PASS-CONDICIONAL** — autoridade canônica implementada; integração/RLS real pendente.
- Wave 6 portal token persistence: **PASS-CONDICIONAL** — consumo concorrente atômico provado; RLS da migration pendente.
- Consent publication TOCTOU: **PASS-CONDICIONAL** — função `FOR UPDATE` correta por inspeção e unit tests passam; corrida real não executada.
- Wave 14 Evolution receipts/ActionBus: **BLOCKED** — teste concorrente real falhou com `spawn /usr/bin/node ENOENT`.

SELF-CHECK: PASS — código real e SHAs conferidos, testes executados com saída registrada, falhas não mascaradas e containers descartáveis removidos.
