# Testing & Verification — DeskcommCRM

> Regra modular compartilhada. Em caso de conflito, `CLAUDE.md` da raiz vence.

## Evidência antes de conclusão

Não declare `pronto`, `corrigido`, `seguro`, `publicado` ou `verde` sem evidência recente que prove exatamente a afirmação.

## Comandos canônicos

```bash
pnpm typecheck
pnpm lint
pnpm lint:channels
pnpm test:unit
pnpm test:db
pnpm test:e2e
pnpm build
```

Use os checks relevantes ao raio de dano, mas não substitua um tipo de prova por outro.

## O que cada gate prova

- `typecheck`: consistência de tipos; não prova comportamento.
- `lint`: regras estáticas; não prova build ou runtime.
- `lint:channels`: invariante de restrição de provider/canal.
- `test:unit`: comportamento unitário; exclui invariantes de banco e E2E.
- `test:db`: baseline install/update + invariantes de banco/RLS em Postgres real descartável.
- `test:e2e`: jornada pelo produto; precisa do ambiente correspondente.
- `build`: capacidade de produzir build; não substitui testes.

`pnpm gov:verify` é um gate rápido e não inclui `test:db` nem `test:e2e`.

## Schema/RLS

Rode `pnpm test:db` e prove isolamento entre organizações quando aplicável. Para mudança de schema, o teste relevante precisa exercitar o `baseline.sql` que o self-hoster realmente aplica, tanto fresh install quanto update/idempotência conforme o script canônico.

## QA visual com recurso real

O produto é self-host: a experiência de quem instala numa VPS é parte do produto. Feature/fix visível precisa ser provado como um usuário real a usa, não só por chamada de API.

- Dirija o frontend com Playwright/browser e conta de teste real.
- `curl`/API serve para diagnóstico de backend, **não prova UX**.
- Meça layout por ferramenta (`getBoundingClientRect`, `getComputedStyle` ou equivalente), não “a olho”.
- Registre screenshot/trace/evidência no local canônico quando a doutrina da jornada exigir.
- Atualize `docs/testing/user-journey-map.md` quando adicionar cobertura ou descobrir um achado que pertence ao mapa vivo.

## Ambiente fresco estilo VPS

Quando a aceitação exige reproduzir primeira instalação:

- banco começa limpo e recebe **`supabase/baseline.sql`**, não depende da cadeia local de migrations já aplicada;
- use Postgres compatível com o baseline atual (o harness documenta pg17 para as invariantes que usam privilégios modernos);
- bootstrap/owner segue o mesmo caminho do instalador, não dados pessoais da estação do dev;
- frontend de prova usa build/runtime de produção (`next build` + `next start`) quando o objetivo é reproduzir self-host;
- teste também com envs opcionais ausentes quando esse é o estado legítimo de primeiro deploy;
- não use symlink de `node_modules` num worktree quando a toolchain/Turbopack rejeita caminhos fora do filesystem root;
- evite workspace descartável em `/tmp` para sessões/evidências longas quando o sistema pode limpá-lo no meio do trabalho.

Esses detalhes são receita operacional do harness; se a toolchain mudar, atualize a fonte canônica e esta rule junto.

## Primeira impressão

Onboarding e primeiras ações — criar conta/owner, conectar canal, primeiro lead, convite inicial e caminhos equivalentes — têm prioridade alta porque falha ali impede o usuário de chegar ao restante do produto.

## Bugs

Reproduza o sintoma original, aplique a correção e reproduza novamente. Quando possível, o teste de regressão deve falhar sem a correção e passar com ela. Para comportamento crítico, sabotar temporariamente a correção é uma forma válida de provar que o teste realmente vigia o caminho.

## Integrações e side effects

Exercite o caminho real ou um receiver real controlado quando o contrato exigir. Mock não substitui prova de egress/anti-SSRF/assinatura quando o risco está nessa borda.

Exemplos: webhook outbound, envio de mensagem e callback externo devem provar o que realmente chegou (ou que foi bloqueado) quando isso for o critério de aceite.

## Revisão final

Antes de concluir:

1. inspecione o diff;
2. inspecione o estado do Git;
3. liste comandos executados e resultados observados;
4. diga explicitamente o que não foi possível medir;
5. registre riscos restantes sem transformá-los em afirmação de sucesso.
