---
name: jules-delegation
description: Como despachar e VERIFICAR trabalho do Jules (agente async do Google) como worker de engenharia paralelo. Use sempre que for criar uma sessão Jules pra corrigir/implementar código no Lumenva, ou revisar o resultado de uma sessão já rodando.
---

# Delegação pro Jules — setup, disparo e verificação obrigatória

> Jules é uma alternativa ao Codex Cloud pra rodar workers de engenharia em paralelo, autenticado no repo `trydavidqix/Lumenva`. A chave (`JULES_API_KEY`) vive só no Google Secret Manager — nunca em disco, log ou commit.

## 1. Setup técnico (SDK, não CLI puro)

O pacote `@google/jules` (CLI) não é suficiente — sem seleção de branch, sem output estruturado. Use `@google/jules-sdk` v0.2.0 (instalado global via npm) direto por script Node.

**Import não funciona como pacote normal** (não existe export `JulesClient` nem `.sessions.create()` — isso não existe na 0.2.0, vai jogar erro). Resolva o caminho absoluto do arquivo:

```js
import { pathToFileURL } from "node:url";
const sdkPath = pathToFileURL("<npm root -g>/@google/jules-sdk/dist/index.mjs").href;
const { connect } = await import(sdkPath);

const client = connect({ apiKey }); // apiKey vem de gcloud secrets versions access latest --secret=JULES_API_KEY, só em env var temporária, nunca logada

// Interativo (mostra plano antes de mexer em código) — usar SEMPRE pra qualquer fix real:
const session = await client.session({
  source: { github: "owner/repo", baseBranch: "feat/minha-branch" }, // github é STRING "owner/repo", não objeto
  prompt,
  requirePlanApproval: true, // NÃO é "requireApproval" - esse nome não existe
  autoPr: true,
});

const info = await session.info(); // id da sessão fica em info.name, ex "sessions/1234..."
```

Pra reconectar numa sessão já criada: `client.session("sessions/<id>")`.

Pra ler o plano gerado e decidir aprovar: itere `session.history()` até achar `activity.type === "planGenerated"`, leia `activity.plan.steps`.

Pra aprovar: `await session.approve()`.

**Cuidado com corrida:** se `autoPr: true`, a sessão pode terminar (abrir PR e fechar) ANTES de uma mensagem enviada via `session.ask()` chegar — já aconteceu (`JulesError: Session ended before the agent replied`). **Qualquer exigência de prova (colar resultado de teste, não abrir PR sem X) tem que estar no prompt INICIAL, antes da aprovação do plano — não dá pra confiar em pedir depois via `ask()`.**

**Todo ambiente Jules começa do zero, sem dependência instalada.** Sempre compor o comando: `pnpm install --frozen-lockfile && <comando real>`, nunca mandar o comando sozinho.

## 2. Antes de aprovar o plano

Sempre `requirePlanApproval: true` e ler o plano gerado antes de deixar rodar. Isso já pegou erro de segurança real 2 vezes (F4: tratar token de curta duração como sessão inteira; misturar validação de usuário de um provedor de auth com token de outro).

Ao ler o plano, desconfie de step com "wait, let me check" / linguagem de incerteza sobre qual arquivo é o problema real — não é motivo pra reprovar sozinho, mas é sinal pra conferir o resultado com mais rigor depois.

## 3. Tarefas paralelas nem sempre são independentes

Antes de disparar N sessões em paralelo pro mesmo pacote de trabalho, mapeie dependência real entre os itens. Já teve caso de 2 dos 5 pedaços dependerem do resultado de outro — não assuma paralelismo total.

## 4. Instruções que precisam ir explícitas no prompt (senão o Jules erra sozinho)

- **Tipo em teste**: Jules tende a usar `any` genérico demais em teste que ele mesmo escreve. Instrua explicitamente por tipo específico, ou corrija na hora sem perguntar (é baixo risco).
- **Remoção de código**: ao pedir pra "remover" algo, sempre incluir "mantenha compatibilidade de tipo/exportação pra quem mais consome, mesmo removendo o comportamento" — senão ele quebra 10 lugares que não pediram pra mexer.
- **Não tocar infra de teste compartilhada**: nunca deixar o worker alterar config de teste usado por todo mundo só pra contornar limitação do próprio sandbox dele.
- **Caminho de arquivo em teste novo**: se o worker escrever teste que lê arquivo por caminho relativo (`readFileSync`), o cwd real do test runner pode não ser a pasta do app — no Lumenva, `test:unit` roda com `cd ../.. && vitest ...`, ou seja cwd é a RAIZ do monorepo, não `apps/crm/`. Path relativo sem o prefixo `apps/crm/` dá `ENOENT`. **Isso já aconteceu 2 vezes (PR #37 e PR #39) — sempre instruir explicitamente o prefixo correto no prompt.**
- **Ordem de criação de admin client vs. checagem de autorização**: se a correção envolve trocar client RLS por client admin/service-role (`createAdminClient()`), o client privilegiado só pode ser criado DEPOIS que o gate de autorização (`requireRole()` etc.) já confirmou permissão — nunca antes. Isso é invariante coberto por teste (`f3-rbac-route-matrix.test.ts` no Lumenva) e já foi violado de verdade pelo Jules numa correção de segurança (PR #39) apesar do prompt pedir explicitamente "filtro manual de organization_id" — o prompt não tinha deixado a ORDEM explícita. **Sempre que a instrução envolver admin client, declarar explicitamente: "crie o client admin só depois do gate de autorização passar, nunca antes".**

## 5. VERIFICAÇÃO OBRIGATÓRIA — nunca aceitar "concluído" só na palavra

Achado grave real (2026-09-23, F5 Task 6): sessão recebeu 3 itens pra corrigir, respondeu "concluí os 3", e a descrição do PR *alegava explicitamente* ter corrigido os 3 — mas só 1 tinha qualquer mudança de código. Os outros 2 arquivos citados tinham ZERO linha diferente da base. Não foi teste fraco, foi alegação de trabalho que não existe.

**Antes de tratar QUALQUER item de uma sessão Jules como resolvido:**

1. `git fetch` a branch head do PR e a branch base.
2. Pra CADA item que a sessão alega ter corrigido, rodar `git diff <base> <head> -- <arquivo(s) citados nesse item>` e confirmar que existe mudança real. Sessão que alega N itens precisa de N diffs não-vazios independentes — um só não vale pelos outros.
3. Rodar (ou aguardar) o CI real do PR — nunca aceitar "typecheck/lint/teste passou" em prosa sem o output colado. Ler o log de falha (`gh run view <id> --job <id> --log-failed`) quando o CI falhar, não só o status verde/vermelho.
4. Ao ler falha de CI, **comparar contra o CI do PR anterior na mesma branch base** antes de classificar como "preexistente" — rode o mesmo grep de assinatura de erro (`grep -c "<mensagem exata>"`) no run anterior. Só é preexistente se já aparecia lá também. "Parece preexistente" não é prova.
5. Se a correção envolveu admin/service-role client, grep o diff por `createAdminClient(` e confirme a ordem relativa ao gate de autorização no mesmo arquivo (ver seção 4).
6. Se a correção adicionou teste novo com leitura de arquivo por caminho relativo, confirme que o prefixo bate com o cwd real do test runner (ver seção 4).

## 6. Se a sessão travar

Sessão pode ficar "em progresso" sem progresso real por mais de 1h. Checar o timestamp exato da última atividade, não só o estado geral. Sem novidade por ~15-20min: mandar pergunta direta. Ainda travado depois disso: cancelar e a própria pessoa orquestrando (ou o Codex) assume aquele pedaço direto, sem tentar de novo no Jules.

## 7. Corrida entre Jules e Codex no mesmo fix

Se os dois estiverem mexendo no mesmo achado em paralelo (aconteceu por real necessidade quando o Codex bateu limite de uso e o Jules foi disparado como plano B), nunca force-push. Sempre buscar o commit remoto mais recente e respeitar o que já foi feito, redirecionando o outro worker pra não duplicar (redirecionar por escopo, ex: "pare o achado 1, foca só 2 e 3").
