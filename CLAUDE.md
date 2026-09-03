# CLAUDE.md — Lumenva

> Entrada canônica para sessões Claude neste repositório. Leia antes de planejar, executar comandos ou editar código.

**Este arquivo é a autoridade final de doutrina do repositório.** Regras modulares em `.claude/rules/` detalham domínios específicos sem substituir esta fonte.

Ordem de apoio:

1. [`AGENTS.md`](AGENTS.md) — contrato portátil para Codex/Cursor/Copilot e outros agentes.
2. [`.claude/rules/`](.claude/rules/) — regras modulares compartilhadas por domínio.
3. [`docs/index.md`](docs/index.md) — índice e precedência documental.
4. [`docs/current-state.md`](docs/current-state.md) — snapshot de estado; confira `audited_against` antes de tratá-lo como atual.
5. [`docs/harness-audit.md`](docs/harness-audit.md) — lacunas conhecidas do harness.
6. [`docs/threat-model.md`](docs/threat-model.md) — superfície de ataque documentada.
7. [`docs/harness-doctrine-matrix.md`](docs/harness-doctrine-matrix.md) — reconciliação entre a doutrina histórica e a árvore modular atual.

Quando uma rule, skill, agent ou artefato gerado conflitar com este arquivo, **este arquivo vence**. Quando uma frase histórica sobre o produto conflitar com Spec/PRD/business-rule atual, siga a precedência documental e registre a reconciliação em vez de manter duas verdades.

---

## Visão

Lumenva é um sistema operacional de vendas open source com agentes de IA nativos, multi-nicho, WhatsApp como canal primário via WAHA, CRM multi-tenant com RLS desde o início e LGPD by-design. A monetização é self-host em VPS, não assinatura. Uma instalação fresca que quebra é bug de produto.

Posicionamento: [`VISION.md`](VISION.md).

---

## Stack canônica

- **Frontend:** Next.js 16 App Router + React 19 + TypeScript 6 estrito + Tailwind + shadcn/ui.
- **Backend:** Next.js Route Handlers no mesmo repo; workers via `event_log` + scheduler/cron.
- **DB/Auth/Realtime/Storage:** Supabase/Postgres + `@supabase/ssr`.
- **WhatsApp:** WAHA Plus, engine NOWEB por default.
- **Fila/eventos:** `event_log` + workers.
- **Rate limit:** Upstash Redis.
- **AI:** Vercel AI Gateway; providers/modelos seguem a configuração canônica atual, não snapshots antigos de preferência.
- **Validação:** Zod em input externo.
- **Observabilidade:** Sentry + logger estruturado.
- **Runtime:** Node >=22.
- **Gerenciador:** pnpm 9.15.9 (`packageManager`).

Patch versions, contagens de arquivos, quantidade de testes e estado corrente de CI são **snapshots**, não doutrina permanente.

---

## Regras modulares obrigatórias

Carregue a rule correspondente ao domínio antes de alterar aquela superfície:

| Domínio | Rule |
|---|---|
| Git, branches, worktrees | [`.claude/rules/git-workflow.md`](.claude/rules/git-workflow.md) |
| Segurança, secrets, auth/RBAC | [`.claude/rules/security.md`](.claude/rules/security.md) |
| Multi-tenancy, RLS, service role | [`.claude/rules/multi-tenancy.md`](.claude/rules/multi-tenancy.md) |
| API, idempotência, rate limit | [`.claude/rules/api-contract.md`](.claude/rules/api-contract.md) |
| Audit e observabilidade | [`.claude/rules/audit-observability.md`](.claude/rules/audit-observability.md) |
| LGPD e dados pessoais | [`.claude/rules/lgpd.md`](.claude/rules/lgpd.md) |
| WhatsApp / WAHA | [`.claude/rules/whatsapp-waha.md`](.claude/rules/whatsapp-waha.md) |
| Modelagem de dados | [`.claude/rules/data-modeling.md`](.claude/rules/data-modeling.md) |
| Schema e migrations | [`.claude/rules/database-migrations.md`](.claude/rules/database-migrations.md) |
| Testes, QA e evidência | [`.claude/rules/testing-verification.md`](.claude/rules/testing-verification.md) |
| Documentação | [`.claude/rules/documentation.md`](.claude/rules/documentation.md) |
| Graphify | [`.claude/rules/graphify.md`](.claude/rules/graphify.md) |
| Skills/agentes | [`.claude/rules/skill-routing.md`](.claude/rules/skill-routing.md) |

`.claude/settings.json` é configuração local da estação e não é fonte de doutrina compartilhada.

---

## Invariantes NÃO NEGOCIÁVEIS

### 1. Multi-tenancy

- Toda tabela tenant-aware possui `organization_id` e RLS conforme o padrão do repo.
- `organization_id` vem de fonte confiável; **nunca do body como autoridade**.
- Service role bypassa RLS; query tenant-aware com admin client filtra `organization_id` manualmente.
- Query que cruza tabelas tenant-aware preserva o tenant explicitamente.
- Mudança em tenancy/RLS exige teste cross-tenant.
- O único papel cross-tenant do contrato base é platform admin, representado pela tabela canônica `platform_admins` da Spec 01; não trate `is_platform_admin` em `auth.users` como schema canônico.

Detalhe: `.claude/rules/multi-tenancy.md`.

### 2. Auth e RBAC

- Backend usa `getUser()`, nunca `getSession()` como prova de identidade.
- Roles tenant: `viewer < agent < manager < admin`.
- MFA TOTP é obrigatório para `admin` e platform admin conforme PRD 01.
- Enforcement é server-side; esconder botão não é autorização.
- API key/token nunca em query string.
- Plaintext de bearer não é persistido como segredo recuperável.
- `user_pipeline_access` permanece fora do MVP enquanto a fonte canônica mantiver essa decisão.

Detalhe: `.claude/rules/security.md`.

### 3. Schema sai em tripla

Toda mudança de schema inclui:

1. migration nova em `supabase/migrations/`;
2. apêndice idempotente correspondente em `supabase/baseline.sql`;
3. linha em `supabase/migrations/MANIFEST.md`.

Se o contrato mudou, regenere `lib/database.types.ts`; não edite manualmente o arquivo gerado.

Nunca edite migration já aplicada. Corrija com forward-fix. Constraint nova corrige/backfill dados incompatíveis antes de ser criada.

Detalhe: `.claude/rules/database-migrations.md`.

### 4. Trigger Postgres nunca faz HTTP

Trigger registra evento/estado local. Side effect de rede pertence a worker/consumer fora da transação.

### 5. Idempotência

- Mensagens/eventos externos usam chave externa tenant-aware e tratam `23505` quando o padrão da superfície exigir.
- POSTs de criação cobertos pelo contrato base usam `Idempotency-Key` com TTL 24h e conflito 409 quando a mesma key chega com payload incompatível.
- Side effects reexecutáveis precisam de proteção contra duplicação e ownership claro de retry.

Detalhe: `.claude/rules/api-contract.md`.

### 6. Audit

- Mutação relevante bem-sucedida gera `api_audit_log` conforme o contrato da superfície.
- Audit é append-only.
- O contrato base documenta retenção de 5 anos, 90 dias hot + cold storage para o histórico.
- Falha de write de audit fica visível operacionalmente e, pelo contrato atual, não bloqueia a mutação principal.
- Audit não pode vazar segredo/PII.

Detalhe: `.claude/rules/audit-observability.md`.

### 7. Privacidade / RGPD

> Migrado de LGPD (lei brasileira) para RGPD/GDPR em 2026-08-20 — clientela europeia, operação sediada em Portugal.

- Anonimização é preferida sobre delete físico quando há dependências históricas.
- Anonimização é irreversível.
- Data request e redact têm o mesmo SLA sob o RGPD: 1 mês corrido a partir do recebimento (Art. 12(3)), extensível por mais 2 meses em casos complexos com notificação ao titular — não são mais dias úteis nem prazos diferentes por tipo, como era na LGPD.
- Cascade e consentimento cobrem o grafo de dados definido nas specs; não faça redact parcial por conveniência.
- Operações de privacidade/dados sensíveis geram audit canônico.
- Violação de dados: notificação à autoridade em até 72h fixas (RGPD Art. 33) — hoje é processo manual, sem automação no código.

Detalhe: `.claude/rules/lgpd.md` (nome do arquivo mantido por dependência do harness-check; conteúdo já é RGPD).

### 8. Input, erros e segurança de dados

- Input externo é validado com Zod.
- API `/api/v1/` usa helpers `ok()`/`fail()` e códigos canônicos de `lib/api/errors.ts`.
- Nunca exponha secrets, tokens, cookies, conteúdo de `.env*` ou PII em mensagem, log, teste, screenshot, commit ou documentação.
- Não deixe erro engolido nem `console.log` em código merged.

Detalhes: `.claude/rules/security.md` e `.claude/rules/api-contract.md`.

### 9. Self-host é produto

- Mudança que só funciona na máquina do dev e quebra clone/VPS é bug.
- Não torne serviço pago obrigatório sem decisão explícita de produto.
- Env var nova precisa de contrato coerente em `.env.example` e `lib/env.ts` quando aplicável.
- Alteração de deploy/instalação lê o runbook antes de operar.

### 10. Nenhuma feature nomeia provider fora do boundary apropriado

Provider/canal vive no boundary canônico do projeto. `pnpm lint:channels` é gate; não contorne a lista/invariante.

---

## API `/api/v1/`

- JSON `snake_case` na **API**; isso não define naming de arquivos TypeScript.
- UUID v4; datas ISO-8601 UTC; dinheiro em `_cents` + `currency` ISO-4217.
- Sucesso: `{ data, meta? }` via `ok()`.
- Erro: `{ error: { code, message, details? } }` via `fail()`.
- Paginação do contrato base usa cursor opaco protegido por HMAC.
- Auth: cookie validado ou `Authorization: Bearer ...`, conforme a superfície.
- API key nunca em query string.
- Bearer plaintext é mostrado uma vez e depois apenas representação não recuperável/hash conforme contrato.
- POST de criação usa `Idempotency-Key`/TTL 24h quando coberto pelo contrato base.
- `X-RateLimit-*`, `Retry-After` e `X-Request-Id` seguem o contrato base/helpers vigentes.

Detalhe: `.claude/rules/api-contract.md`.

---

## WhatsApp / WAHA

Regras operacionais que não podem ser “resumidas fora”:

- WAHA Plus; NOWEB default; WEBJS apenas quando a feature realmente exigir.
- Server WAHA recebe hash SHA512 da API key; cliente usa plaintext em `X-Api-Key` via secret/env apropriado.
- Webhook usa HMAC-SHA512 timing-safe.
- Inbound é idempotente por `(organization_id, external_id)`/contrato equivalente.
- Anti-banimento respeita throttle 1 msg/1.2s + jitter <=800ms; campanha 1/5s; warm-up 7–14 dias; limites/janela/spinning conforme PRD/business rules.
- STOP/opt-out vigente inclui `CANCELAR` além das palavras históricas e bloqueia outbound automatizado.
- `message.any`/`fromMe` preservam histórico multi-device sem duplicação.
- Grupos não viram binding CRM/lead indevido no MVP.
- `recover-stuck-messages` trata `sending` >5min, não toca `queued`, não reenvia automaticamente e torna a falha visível na Central conforme W-12/implementação atual.

Mídia usa Storage/URL como caminho canônico; business rule W-08 documenta exceção para payload pequeno, então não imponha uma proibição absoluta que contradiga a fonte atual.

Detalhe: `.claude/rules/whatsapp-waha.md`.

---

## Modelagem

Antes de adicionar campo, aplique DIRC:

- **D**uplicar — vive realmente aqui?
- **I**ntegrar — deveria vir de outra tabela/FK?
- **R**eferenciar — basta um ponteiro?
- **C**alcular — pode ser derivado on-demand?

O núcleo CRM, fractional indexing, `external_id` nullable em lifecycles que exigem, vocabulários/check constraints, `tags`/GIN, `custom_fields` e `vocabulary` por pipeline ficam detalhados em `.claude/rules/data-modeling.md`.

Anti-patterns continuam proibidos: string onde deveria existir FK; duplicação sem source of truth; evento sem consumer; inferência por nome em lugar de FK; cron usado para sincronização que deveria ser relação/evento; `jsonb` sem schema central; cascade que destrói histórico; polimorfismo sem vocabulário; trigger fazendo HTTP; service role sem tenant; `getSession()` backend; API key em query; bearer plaintext persistido; `console.log` merged.

---

## Paths sensíveis/importantes

| Path | Regra |
|---|---|
| `supabase/baseline.sql` | self-host aplica; mudança de schema precisa chegar aqui |
| `supabase/migrations/` | migrations versionadas; não editar já aplicada |
| `supabase/migrations/MANIFEST.md` | registro da cadeia |
| `lib/database.types.ts` | gerado; não editar à mão |
| `lib/supabase/admin.ts` | service role; cuidado com filtro de tenant |
| `lib/auth/public-paths.ts` | alterar pode remover auth de borda |
| `lib/api/wrappers.ts` | `ok()` / `fail()` canônicos |
| `lib/api/errors.ts` | códigos canônicos |
| `lib/env.ts` | contrato Zod de env |
| `docs/runbooks/deploy.md` | ler antes de qualquer deploy |
| `docs/specs/` | contrato técnico |
| `docs/business-rules/` | regras de negócio fora do código |
| `docs/doctrine/` | doutrina especializada |
| `loop/` | gov-loop; não alterar fora do fluxo apropriado |

`graphify-out/` é gerado localmente e ignorado pelo Git; veja `.claude/rules/graphify.md`.

---

## Deploy

**Não opere produção por memória. Leia `docs/runbooks/deploy.md`.**

**GitHub Actions está desabilitado neste repositório (decisão permanente, 2026-08-20).** Não existe
mais CI/registry publicando imagem automaticamente. O caminho da VPS que o runbook chamava de
"exceção" (build ad-hoc) é hoje o único caminho — veja `docs/runbooks/deploy.md` para o comando
atual.

Na topologia documentada com proxy reverso externo, esquecer o compose/labels de roteamento pode deixar o contêiner saudável e o domínio em 404.

O comando exato, os dois arquivos de compose e a verificação HTTP pós-deploy ficam no runbook para não haver duas receitas operacionais divergentes.

Qualquer ação em produção, credencial ou dado real exige autorização explícita.

---

## Testes e QA

- `test:unit` não prova banco/RLS.
- `test:db` é a prova do baseline install/update e invariantes de banco.
- UI/fluxo visível é provado pela tela; `curl` não prova UX.
- Quando o critério é instalação fresca/self-host, use ambiente estilo VPS conforme `.claude/rules/testing-verification.md`: baseline fresco, runtime de produção e dependências/envs coerentes com primeiro deploy.
- Side effect externo de alto risco deve ser provado no caminho real/receiver controlado quando o contrato exigir; mock não prova egress/assinatura/anti-SSRF.
- **GitHub Actions está desabilitado (permanente).** Não existe mais gate de CI automático em PR —
  `verify`/`invariants`/`e2e`/`perf`/`publish-image` não rodam. Verificação local
  (`pnpm typecheck && pnpm lint && pnpm test:unit`, `pnpm test:db` quando schema/RLS mudou) e Vercel
  Preview passam a ser a prova, não um complemento ao CI.
- **Vercel Preview só no fim da tarefa, não a cada subtask.** Uma tarefa com várias subtasks (ex.: 10)
  executa todas primeiro; só a última roda a validação completa via Preview. Detalhe/motivo:
  `.claude/rules/testing-verification.md`.

Não congele aqui a quantidade atual de specs, arquivos de teste ou quais checks são obrigatórios numa data específica; isso pertence a `docs/current-state.md`/`docs/harness-audit.md`.

---

## Comandos canônicos

```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm lint:channels
pnpm lint:tenant-filter
pnpm typecheck
pnpm test:unit
pnpm test:db
pnpm test:e2e
pnpm test:harness
pnpm harness:check
pnpm gov:verify
```

`pnpm gov:verify` é gate rápido; não inclui `test:db` nem `test:e2e`.

Detalhe de prova: `.claude/rules/testing-verification.md`.

---

## Skills e agentes

Antes de uma tarefa, identifique skills/processos aplicáveis e leia a versão instalada. Processo vem antes de implementação quando aplicável.

Referência de roteamento: `.claude/rules/skill-routing.md`.

Superpowers mais frequentes:

- brainstorming — feature/alteração de comportamento;
- writing-plans — implementação multi-etapa já desenhada;
- systematic-debugging — bug/comportamento inesperado;
- test-driven-development — feature/bugfix quando aplicável;
- verification-before-completion — antes de declarar conclusão.

Não trate nomes de skills como doutrina do produto; a regra do repositório continua aqui/specs.

---

## Disciplina de escopo e Git

- Entenda o comportamento atual antes de mudar.
- Faça a menor alteração correta.
- Não use a tarefa para refatorar área não relacionada.
- Não invente regra de negócio, SLA, número ou comportamento ausente de PRD/spec/business-rule.
- Se encontrar problema fora do escopo, registre e reporte; não corrija automaticamente.
- Ações destrutivas, produção, credenciais, custo e expansão material de escopo exigem autorização.
- `main` é integração/produção; trabalhe em branch própria e mantenha a branch sincronizada com `main` por fast-forward/merge seguro em árvore limpa.
- Nunca use `reset --hard`, force-push ou descarte de trabalho alheio para “atualizar” branch.

Detalhe: `.claude/rules/git-workflow.md`.

---

## Definition of Done

Antes de declarar uma tarefa concluída, aplique os itens relevantes ao raio de dano:

1. `pnpm typecheck` zerado.
2. `pnpm lint` zerado.
3. Testes unitários/relevantes existem e passam.
4. RLS/isolamento provado se tocou tabela/policy tenant-aware.
5. Audit emitido se há mutação relevante.
6. Rate limit aplicado quando a superfície pública exigir.
7. Zod valida input externo novo/alterado.
8. Sem `console.log`, segredo ou PII indevido.
9. Env var nova refletida em `.env.example` + `lib/env.ts`/contrato apropriado quando aplicável.
10. Documentação atualizada quando contrato/comportamento/arquitetura mudou.
11. Schema: migration + baseline + MANIFEST juntos; tipos regenerados quando aplicável.
12. UI/fluxo de usuário: provado pela tela como um usuário faria, com jornada/evidência apropriada; `curl` não prova UX.
13. Living System Checklist de `docs/doctrine/sistema-vivo.md` considerado quando a feature adiciona nova peça/comportamento sistêmico.
14. Tela nova possui caminho de navegação/porta conforme `lib/navigation/registry.ts`/invariante canônico, ou exceção justificada.
15. `pnpm harness:check` passa quando a mudança toca o harness/instruções.
16. Diff final e estado do Git foram inspecionados; o relatório diz o que foi medido e o que não foi.

**Evidência antes de afirmação.** Verde parcial não autoriza declarar toda a superfície verde.
