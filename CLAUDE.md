# CLAUDE.md — DeskcommCRM

> Entrada canônica para sessões Claude neste repositório. Leia antes de planejar, executar comandos ou editar código.

**Este arquivo é a autoridade final de doutrina do repositório.** Regras modulares em `.claude/rules/` detalham domínios específicos sem substituir esta fonte.

Ordem de apoio:

1. [`AGENTS.md`](AGENTS.md) — contrato portátil para Codex/Cursor/Copilot e outros agentes.
2. [`.claude/rules/`](.claude/rules/) — regras modulares compartilhadas por domínio.
3. [`docs/index.md`](docs/index.md) — índice e precedência documental.
4. [`docs/current-state.md`](docs/current-state.md) — snapshot de estado; confira `audited_against` antes de tratá-lo como atual.
5. [`docs/harness-audit.md`](docs/harness-audit.md) — lacunas conhecidas do harness.
6. [`docs/threat-model.md`](docs/threat-model.md) — superfície de ataque documentada.

Quando uma regra modular, skill, agent ou artefato gerado conflitar com este arquivo, **este arquivo vence**.

---

## Visão

DeskcommCRM é um sistema operacional de vendas open source com agentes de IA nativos, multi-nicho, WhatsApp como canal primário via WAHA, CRM multi-tenant com RLS desde o início e LGPD by-design. A monetização é self-host em VPS, não assinatura. Uma instalação fresca que quebra é bug de produto.

Posicionamento: [`VISION.md`](VISION.md).

---

## Stack canônica

- **Frontend:** Next.js 16 App Router + React 19 + TypeScript 6 estrito + Tailwind + shadcn/ui.
- **Backend:** Next.js Route Handlers no mesmo repo; workers via `event_log` + scheduler/cron.
- **DB/Auth/Realtime/Storage:** Supabase/Postgres + `@supabase/ssr`.
- **WhatsApp:** WAHA Plus, engine NOWEB.
- **Fila/eventos:** `event_log` + workers.
- **Rate limit:** Upstash Redis.
- **AI:** Vercel AI Gateway; Anthropic/OpenAI/Google conforme configuração canônica.
- **Validação:** Zod em input externo.
- **Observabilidade:** Sentry + logger estruturado.
- **Runtime:** Node >=22.
- **Gerenciador:** pnpm 9.15.9 (`packageManager`).

---

## Regras modulares obrigatórias

Carregue a rule correspondente ao domínio antes de alterar aquela superfície:

| Domínio | Rule |
|---|---|
| Git, branches, worktrees | [`.claude/rules/git-workflow.md`](.claude/rules/git-workflow.md) |
| Segurança, secrets, auth | [`.claude/rules/security.md`](.claude/rules/security.md) |
| Multi-tenancy, RLS, service role | [`.claude/rules/multi-tenancy.md`](.claude/rules/multi-tenancy.md) |
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

Detalhe: `.claude/rules/multi-tenancy.md`.

### 2. Auth e RBAC

- Backend usa `getUser()`, nunca `getSession()` como prova de identidade.
- Roles: `viewer < agent < manager < admin`.
- Enforcement é server-side; esconder botão não é autorização.
- API key/token nunca em query string.

### 3. Schema sai em tripla

Toda mudança de schema inclui:

1. migration nova em `supabase/migrations/`;
2. apêndice idempotente correspondente em `supabase/baseline.sql`;
3. linha em `supabase/migrations/MANIFEST.md`.

Se o contrato mudou, regenere `lib/database.types.ts`; não edite manualmente o arquivo gerado.

Nunca edite migration já aplicada. Corrija com forward-fix.

Detalhe: `.claude/rules/database-migrations.md`.

### 4. Trigger Postgres nunca faz HTTP

Trigger registra evento/estado local. Side effect de rede pertence a worker/consumer fora da transação.

### 5. Idempotência

Mensagens/eventos externos usam chave externa tenant-aware e tratam `23505` quando o padrão da superfície exigir. Side effects reexecutáveis precisam de proteção contra duplicação.

### 6. Audit

Mutação relevante bem-sucedida gera `api_audit_log` conforme o contrato da superfície. Audit não pode vazar segredo/PII.

### 7. Input e erros

- Input externo é validado com Zod.
- API `/api/v1/` usa helpers `ok()`/`fail()` e códigos canônicos de `lib/api/errors.ts`.
- Não deixe erro engolido nem `console.log` em código merged.

### 8. Segurança e dados

Nunca exponha secrets, tokens, cookies, conteúdo de `.env*` ou PII em mensagem, log, teste, screenshot, commit ou documentação.

Detalhe: `.claude/rules/security.md`.

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
- Auth: cookie validado ou `Authorization: Bearer ...`, conforme a superfície.
- Bearer plaintext não deve ser persistido onde o contrato exige hash.
- `X-Request-Id`/audit/rate limit seguem os helpers e specs canônicos.

---

## WhatsApp / WAHA

Detalhe técnico e regras de canal vivem em:

- `docs/prd/03-prd-whatsapp-waha.md`;
- `docs/specs/03-spec-whatsapp-waha.md`;
- `docs/runbooks/waha-hostgator.md`;
- código canônico em `lib/channels/`/superfícies existentes.

Invariantes globais: webhooks autenticados; STOP/opt-out respeitado; grupos não viram binding CRM indevido; outbound evita duplicação; mídia e logs não vazam dados/secrets.

Não replique manual de WAHA inteiro neste arquivo.

---

## Modelagem

Antes de adicionar campo, aplique DIRC:

- **D**uplicar — vive realmente aqui?
- **I**ntegrar — deveria vir de outra tabela/FK?
- **R**eferenciar — basta um ponteiro?
- **C**alcular — pode ser derivado on-demand?

Evite:

- string onde deveria existir FK;
- duplicação sem source of truth declarado;
- evento sem consumer;
- FK ausente substituída por inferência por nome;
- sincronização por cron quando há boundary/evento melhor;
- `jsonb` sem schema central para contrato de UI;
- cascade que destrói histórico necessário;
- polimorfismo sem vocabulário consistente.

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

Na topologia documentada com proxy reverso externo, esquecer o compose/labels de roteamento pode deixar o contêiner saudável e o domínio em 404. O caminho normal é imagem publicada pelo CI/registry e deploy conforme runbook; build ad-hoc na VPS é exceção operacional, não padrão.

Qualquer ação em produção, credencial ou dado real exige autorização explícita.

---

## Comandos canônicos

```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm lint:channels
pnpm typecheck
pnpm test:unit
pnpm test:db
pnpm test:e2e
pnpm gov:verify
pnpm harness:check
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

## Disciplina de escopo

- Entenda o comportamento atual antes de mudar.
- Faça a menor alteração correta.
- Não use a tarefa para refatorar área não relacionada.
- Não invente regra de negócio, SLA, número ou comportamento ausente de PRD/spec/business-rule.
- Se encontrar problema fora do escopo, registre e reporte; não corrija automaticamente.
- Ações destrutivas, produção, credenciais, custo e expansão material de escopo exigem autorização.

Git/worktree: `.claude/rules/git-workflow.md`.

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
9. Env var nova refletida no contrato/configuração apropriado.
10. Documentação atualizada quando contrato/comportamento/arquitetura mudou.
11. Schema: migration + baseline + MANIFEST juntos; tipos regenerados quando aplicável.
12. UI/fluxo de usuário: prova pela tela com jornada/evidência apropriada; `curl` não prova UX.
13. Living System Checklist de `docs/doctrine/sistema-vivo.md` considerado quando a feature adiciona nova peça/comportamento sistêmico.
14. Tela nova possui caminho de navegação/porta conforme o registry/invariante canônico, ou exceção justificada.
15. `pnpm harness:check` passa quando a mudança toca o harness/instruções.
16. Diff final e estado do Git foram inspecionados; o relatório diz o que foi medido e o que não foi.

**Evidência antes de afirmação.** Verde parcial não autoriza declarar toda a superfície verde.
