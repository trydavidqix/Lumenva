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

Use somente os checks relevantes ao raio de dano, mas não substitua um tipo de prova por outro.

## O que cada gate prova

- `typecheck`: consistência de tipos; não prova comportamento.
- `lint`: regras estáticas; não prova build ou runtime.
- `lint:channels`: invariante de restrição de provider/canal.
- `test:unit`: comportamento unitário; exclui invariantes de banco e E2E.
- `test:db`: baseline install/update + invariantes de banco/RLS em Postgres real descartável.
- `test:e2e`: jornada pelo produto; precisa do ambiente correspondente.
- `build`: capacidade de produzir build; não substitui testes.

`pnpm gov:verify` é um gate rápido e não inclui `test:db` nem `test:e2e`.

## Mudanças por domínio

### Schema/RLS

Rode `pnpm test:db` e prove isolamento entre organizações quando aplicável.

### UI/fluxo de usuário

Prove pela tela com Playwright e evidência visual quando a doutrina exigir. `curl`/API pode diagnosticar backend, mas não prova experiência de usuário.

### Bug

Reproduza o sintoma original, aplique a correção e reproduza novamente. Quando possível, o teste de regressão deve falhar sem a correção e passar com ela.

### Integrações/side effects

Exercite o caminho real ou um receiver real controlado quando o contrato exigir. Mock não substitui prova de egress/anti-SSRF/assinatura quando o risco está nessa borda.

## Revisão final

Antes de concluir:

1. inspecione o diff;
2. inspecione o estado do Git;
3. liste comandos executados e resultados observados;
4. diga explicitamente o que não foi possível medir;
5. registre riscos restantes sem transformá-los em afirmação de sucesso.
