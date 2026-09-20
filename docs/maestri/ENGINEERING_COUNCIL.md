# Lumenva Engineering Council

## Composição padrão

```text
Owner
  ↓
Maestri
  ↓
Claude Code — MAESTRO
  ├── Codex — BUILDER
  ├── Gemini — GOOGLE EXECUTOR
  ├── Reviewer — modelo diferente do Builder quando possível
  └── QA Shell — verifier determinístico
```

## Regra de recrutamento

O Maestro não mantém uma frota fixa. Para cada task:

1. lê a nota da task e as fontes canônicas do repo;
2. congela objetivo, escopo, acceptance e riscos;
3. cria Floor/worktree isolado;
4. escolhe **um executor principal**;
5. conecta a mesma nota ao executor e ao reviewer;
6. exige verifier determinístico antes do review;
7. limita retries a no máximo 3 attempts;
8. se continuar falhando, bloqueia e escala ao Owner;
9. nunca interpreta PASS técnico como autorização de merge/deploy.

## Seleção de executor

### Codex

Use como default para:
- implementação TypeScript/Next.js;
- refactors;
- testes;
- integrações;
- correções;
- trabalho geral no monorepo.

### Gemini

Use quando a task for materialmente:
- Firebase;
- Google Cloud;
- Cloud SQL;
- Cloud Run;
- Cloud Build;
- Pub/Sub;
- Cloud Tasks;
- Cloud Scheduler;
- Secret Manager;
- Vertex AI;
- BigQuery;
- Google Workspace.

Gemini continua sendo executor. A decisão final de arquitetura e sequência pertence ao Claude Maestro dentro das regras do repo.

## Reviewer

- sessão limpa;
- read-only por padrão;
- não corrige o próprio achado;
- emite PASS/FAIL com evidência;
- quando houver FAIL, devolve uma lista mínima de correções ao Maestro;
- se Builder foi Codex, preferir Gemini Reviewer quando a superfície permitir;
- se Builder foi Gemini, preferir Codex Reviewer.

## Verifier

O verifier não raciocina sobre intenção. Executa comandos reais e retorna exit code/evidence.

Perfis típicos:
- docs/harness: `pnpm harness:check`;
- código TS: `pnpm typecheck && pnpm lint && pnpm test:unit`;
- schema/RLS: `pnpm test:db`;
- UI: `pnpm test:e2e` + evidência visual quando exigida;
- build: `pnpm build`.

O perfil deve seguir `CLAUDE.md` e `.claude/rules/testing-verification.md`.