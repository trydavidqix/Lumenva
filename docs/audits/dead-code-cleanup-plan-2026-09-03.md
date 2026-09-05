# Plano de limpeza de código morto e lixo — Fase 2

Data: 2026-09-03  
Base auditada: `main` em `03c29e7012acd842543d295a74b04ad732c15404`  
Fonte: `docs/audits/dead-code-audit-2026-09-03.md`

## Limites e regra de decisão

Este documento é somente plano. Nenhum arquivo será removido ou alterado nesta
fase. O worktree já contém alterações e artefatos locais; qualquer execução deve
preservá-los e começar por uma revisão do diff.

Classificação abaixo é por bloco de decisão, não por linha. Um bloco só avança
quando a verificação específica confirmar que o item não é usado, não é contrato
público e não é evidência histórica exigida.

## Estado dos blocos 1/2 (atualizado em 2026-09-04)

- **Bloco 1 — executado:** `skills-legacy.ts` removido em `1c5b964f`; gates verdes conforme o relatório de pendência.
- **Bloco 2 — executado:** `@tanstack/react-virtual` removido em `a69cbee4`; `@langchain/core`, `import-in-the-middle` e `require-in-the-middle` preservados após confirmação de necessidade peer/transitiva. Gates verdes conforme o relatório de pendência.

Os demais blocos deste plano continuam sujeitos à decisão humana e não foram
executados por esta sincronização documental.

## Categorias de risco

### SEGURO

**Blocos 1 e 2 foram executados e encerrados; os itens restantes continuam sem
classificação SEGURO.** A classificação abaixo preserva o plano original de
03/09; para o estado efetivo, prevalece a seção de execução acima.

O arquivo byte-a-byte duplicado `lib/agent-engine/agent/skills-legacy.ts` tinha
alta evidência de não uso e começou em PRECISA VERIFICAR; a confirmação posterior
e a remoção estão registradas acima (`1c5b964f`).

### PRECISA VERIFICAR

1. **Módulo legado duplicado (1 bloco; esforço baixo, risco baixo após confirmação).**
   Confirmar histórico (`git log --follow`), referências por caminho/string e
   convenções de carregamento antes de remover `skills-legacy.ts`. Comparar a
   árvore final e garantir que todos os consumidores continuam em `skills.ts`.

2. **Dependências sem import textual (4 candidatos; esforço médio, risco médio).**
   `@langchain/core`, `@tanstack/react-virtual`, `import-in-the-middle` e
   `require-in-the-middle`. Rodar `pnpm why <pacote>`, inspecionar manifests,
   configuração de bundler/instrumentação e lockfile; só remover se não forem
   dependências transitivas necessárias, peer dependencies ou carregadas
   dinamicamente.

3. **Documentação duplicada ou versão supersedida (3 blocos; esforço médio,
   risco médio).** Comparar conteúdo e SHA dos dois relatórios de Gateway, dos
   dois planos de Agent OS e das duas versões de upstream-branches. Atualizar
   referências (inclusive o handoff) antes de retirar uma cópia; preservar a
   fonte histórica canônica.

4. **Snapshots `last30days` (1 bloco contendo 10 snapshots; esforço médio,
   risco médio).** Confirmar política de retenção, reprodutibilidade e se algum
   snapshot é citado por handoff, relatório ou pipeline. Deduplicar somente após
   registrar qual execução permanece e por quê.

5. **Scripts manuais/one-shot sem chamada automática (1 bloco contendo 24
   scripts; esforço alto, risco médio).** Para cada script, procurar uso por
   `pnpm`, documentação, cron, CI inerte, operações manuais e referências por
   caminho. Não remover scripts de QA/spike enquanto a evidência operacional não
   tiver sido substituída ou arquivada.

6. **Metadados rastreados que coincidem com `.gitignore` (1 bloco contendo 9
   arquivos; esforço médio, risco médio).** Revisar individualmente os arquivos
   `.claude/*`, `.superpowers/sdd/*` e `website/.env.example`; `identity.json` é o
   primeiro candidato a revisão. Manter a ponte versionada
   `.claude/skills/DeskcommCRM/SKILL.md` e o template de ambiente até decisão
   explícita sobre a inconsistência entre os `.gitignore`.

### ARRISCADO

1. **Exports e tipos sinalizados pelo Knip no `website/` (2 blocos; esforço
   médio, risco alto).** Os ícones têm uso no mapa local, o schema é usado
   internamente e os tipos podem ser parte de contrato externo. Exigir inspeção
   de consumidores, build e decisão humana antes de remover qualquer export.

2. **Documentação explicitamente histórica (1 bloco; esforço baixo, risco alto).**
   `docs/archive/vendaval-fusion-plan.md` e
   `docs/archive/vendaval-vps-deploy-comandos.md` permanecem preservados; só
   alterar mediante política de retenção aprovada.

3. **Helpers de autorização interna duplicados (1 bloco; esforço alto, risco
   alto).** `timingSafeEq`/`authorize` têm diferença funcional de Bearer em
   `agents/run`; não deduplicar sem testes de contrato para cada rota e revisão
   de segurança.

4. **Helpers de intervalo UTC duplicados (1 bloco; esforço médio, risco alto).**
   `startOfUtcDay`, `endOfUtcDay`, `parseDayUtc` e `resolveRange` podem alterar
   janelas de dados; primeiro congelar testes de limites, timezone e data inválida.

5. **Formatação de data, moeda e HTML (3 blocos; esforço médio/alto, risco alto).**
   As implementações divergem em ano de dois/quatro dígitos, fallback de moeda e
   escaping. Uma extração precipitada pode mudar UX ou segurança; requer testes
   unitários e revisão visual quando aplicável.

6. **`asObject`/`base64url` duplicados (1 bloco; esforço médio, risco alto).**
   Verificar diferenças de tipos, padding, Unicode e cookies antes de unificar.

7. **Formatação de datas dos gráficos (1 bloco; esforço médio, risco alto).**
   A divergência UTC versus timezone local pode deslocar o dia exibido; exigir
   teste com fronteira de meia-noite e prova visual.

## Ordem de execução da Fase 2

### 0. Preflight e isolamento

Executar no checkout correto, sem limpar o worktree:

```bash
cd /Users/david/Desktop/Projetos/CRM/DeskcommCRM
git status --short
git diff --stat
git branch --show-current
git rev-parse HEAD
```

Registrar o estado inicial. Não fazer `reset`, `checkout`, `clean`, commit ou
push. Cada remoção deve ser uma mudança isolada e revisada antes do próximo bloco.

### 1. Candidatos de menor raio, após confirmação

Tratar primeiro os itens PRECISA VERIFICAR na ordem: módulo legado, dependências,
documentação duplicada, snapshots, scripts e metadados. Em cada bloco:

1. confirmar referências e intenção;
2. remover ou reconciliar somente os caminhos aprovados;
3. inspecionar `git diff --check` e `git diff -- <paths>`;
4. executar os gates abaixo;
5. parar e aplicar rollback do bloco se qualquer gate falhar.

Gates padrão após remoção de código, dependência ou script:

```bash
pnpm typecheck && pnpm lint && pnpm test:unit
```

Para alterações de documentação/metadados, no mínimo:

```bash
git diff --check
pnpm harness:check
```

Se o bloco tocar instruções, skills ou harness, acrescentar `pnpm test:harness`.
Se tocar schema/RLS (não previsto nos candidatos atuais), acrescentar
`pnpm test:db`. Não gerar Preview intermediário; a regra do repositório exige
Preview somente ao fim da tarefa inteira, se houver autorização para essa prova.

### 2. Itens ARRISCADOS, somente após decisão humana

Não iniciar refatoração dos helpers nem remoção de exports/tipos antes de haver
decisão explícita sobre compatibilidade pública, comportamento de timezone,
segurança de autorização e política de retenção. Para cada bloco aprovado,
adicionar testes de regressão antes da alteração e executar:

```bash
pnpm typecheck && pnpm lint && pnpm test:unit
```

Acrescentar `pnpm test:e2e` e prova visual para mudanças de UI/data exibida;
acrescentar `pnpm build` para confirmar empacotamento. Alterações em rotas de
autorização exigem também revisão de segurança e testes de cada método/cabeçalho,
sem considerar um teste focado como prova de cobertura total.

### 3. Fechamento

Depois de todos os blocos aprovados:

```bash
git diff --check
git diff --stat
git status --short
pnpm typecheck && pnpm lint && pnpm test:unit
```

Executar `pnpm build` e os gates de jornada somente se a alteração efetivamente
atingir o raio correspondente. Registrar explicitamente comandos, resultados,
itens não medidos e riscos restantes. Não declarar a limpeza segura apenas por
ausência de erro em um gate estático.

## Rollback

Se um gate falhar, se surgir consumidor oculto ou se o comportamento mudar,
interromper o bloco atual, preservar o log da falha e restaurar apenas os
caminhos daquele bloco com revisão humana (por exemplo, `git restore -- <paths>`
após confirmar que não contém trabalho preexistente). Reexecutar os gates após o
rollback. Não usar comandos destrutivos amplos nem restaurar o worktree inteiro.

## Estimativa consolidada

- **SEGURO:** 0 blocos; nenhum item tem prova suficiente para remoção imediata.
- **PRECISA VERIFICAR:** 6 blocos (1 módulo, 4 dependências, 3 grupos de docs,
  10 snapshots, 24 scripts e 9 metadados são subitens); esforço global médio/alto,
  risco baixo/médio condicionado à confirmação.
- **ARRISCADO:** 7 blocos; esforço global alto, risco alto por contratos,
  segurança, timezone, UX ou retenção histórica.

Contagens usam blocos de decisão para evitar que dezenas de arquivos derivados
pareçam decisões independentes. Os subitens estão explicitados acima.
