# Handoff — Harness Instruction Convergence

**Branch:** `gpt-harness-convergence`  
**Base:** `main` @ `4fa4ca9a7042b88d6de35e411e4375213fb26d93`  
**Status:** implementação remota concluída; merge/PR não autorizado e não executado.

## O que foi feito

- `.claude/rules/` criado e versionável com oito rules por domínio.
- `CLAUDE.md` modularizado e mantido como autoridade.
- `AGENTS.md` convertido em contrato portátil sem snapshot de contagens como doutrina.
- Skill Claude e skill Codex alinhadas à mesma fonte canônica.
- Instincts antigos neutralizados e convertidos em ponte de compatibilidade.
- Metadata ECC atualizada para o repositório atual e descrições de adapter/bridge.
- `.codex/AGENTS.md` alinhado; `.codex/agents/*.toml` preservados.
- `.claude/settings.json` continua local/ignorado.
- Novo gate `scripts/check-harness-consistency.mjs`.
- Novo teste `scripts/check-harness-consistency.test.mjs`.
- Novos scripts `pnpm harness:check` e `pnpm test:harness`.
- `pnpm gov:verify` passa a executar `harness:check` antes dos gates existentes.
- CI `verify` passa a rodar `pnpm test:harness && pnpm harness:check`.
- Runbook humano criado em `docs/runbooks/agent-harness.md`.
- Spec e plano da convergência registrados em `docs/superpowers/`.

## O que foi deliberadamente preservado

- `loop/` / gov-loop;
- `gov-implementer` e `gov-verifier`;
- `triagem-*` e `triagem/TRIAGEM.md`;
- `.codex/agents/explorer.toml`, `reviewer.toml`, `docs-researcher.toml`;
- Supabase/schema/migrations;
- app/lib/components/workers;
- infraestrutura, produção, credenciais e dados reais;
- branch `gpt-ai-platform`.

## Verificação executada

### TDD do novo gate

Ciclo RED/GREEN executado em ambiente Node 22 isolado:

1. teste inicial falhou porque o checker não existia;
2. implementação mínima adicionada;
3. 6 testes passaram;
4. cobertura ampliada para links de rules e contrato portátil — RED em 2 novos casos;
5. implementação ampliada — 8/8 passaram;
6. adicionado caso contra falso positivo para menção negativa de comandos obsoletos — RED;
7. matcher corrigido — **9/9 testes passaram, 0 falhas**.

### Revisão de Git

`main...gpt-harness-convergence` foi comparado após a implementação. O diff ficou restrito a arquivos de harness, documentação, `package.json`, script/teste do gate e `ci.yml`. Não existem mudanças em `app/`, `lib/`, `components/`, `workers/` ou `supabase/`.

A branch estava `ahead` da `main` e `behind_by: 0` na revisão.

## O que não foi possível provar remotamente

- carregamento real das `.claude/rules/` por uma instalação específica do Claude Code;
- conteúdo do `.claude/settings.json` local de Windows/macOS;
- hooks locais armados naquela estação;
- execução da suíte completa do repositório em uma estação com dependências/Docker.

Essas provas exigem checkout/local ou CI acionado por PR/push apropriado. Nenhuma delas justifica alterar produção ou mergear a branch.

## Próxima ação humana

Quando o dono decidir validar localmente, executar na branch:

```bash
pnpm test:harness
pnpm harness:check
pnpm gov:verify
```

Depois validar carregamento do Claude Code pela ferramenta instalada na máquina. Só então decidir se abre PR/merge; **não existe autorização implícita para `main`**.
