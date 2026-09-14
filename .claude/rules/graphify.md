# Graphify — Lumenva

> Regra modular compartilhada. Em caso de conflito, `CLAUDE.md` da raiz vence.

## Quando usar

Quando `graphify-out/graph.json` existir e a tarefa exigir entender relações na base de código, prefira consultas focadas ao grafo antes de varrer o repositório inteiro.

Comandos esperados, quando a instalação local suportar:

```bash
graphify query "<pergunta>"
graphify path "<A>" "<B>"
graphify explain "<conceito>"
```

Use `graphify-out/wiki/index.md` para navegação geral quando existir. Leia `graphify-out/GRAPH_REPORT.md` para revisão arquitetural ampla ou quando consultas focadas não forem suficientes.

## Limites de confiança

`graphify-out/` é gerado localmente e ignorado pelo Git. Antes de confiar em detalhe fino:

- confirme que o grafo existe;
- verifique se foi gerado contra uma árvore recente;
- valide afirmações críticas no código-fonte.

Um relatório antigo não supera `CLAUDE.md`, código atual, specs ou Git.

## Depois de mudança de código

Quando Graphify estiver disponível localmente, regenere/atualize o grafo pelo comando suportado pela instalação, sem transformar o artefato gerado em conteúdo versionado.

## Ausência do grafo

Se `graphify-out/` não existir na estação, continue com leitura dirigida de arquivos, busca e docs canônicos. A falta do grafo não autoriza inventar relações entre módulos.
