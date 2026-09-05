# AI Context — Lumenva

> Camada de contexto rápido para agentes de engenharia. Não substitui a doutrina nem as specs; reduz o tempo de descoberta antes de uma auditoria, planejamento ou implementação.

**Snapshot inicial:** 2026-09-03  
**Base:** `main @ 589872303ed11108c0e74db77aa356cfca921b6f`  
**Repo:** `trydavidqix/CRM`

## Ordem de leitura recomendada

1. `CLAUDE.md` — autoridade final de doutrina.
2. `AGENTS.md` — contrato portátil para agentes.
3. `docs/ai/PROJECT_CONTEXT.md` — visão condensada do produto, stack, estrutura, integrações e comandos.
4. `docs/ai/ARCHITECTURE.md` — mapa operacional das camadas e fluxos.
5. `docs/ai/AI_PROJECT_STATE.md` — snapshot rápido do estado conhecido na data indicada.
6. `docs/ai/KNOWN_ISSUES.md` — riscos, dívidas e trabalhos pendentes conhecidos.
7. `docs/ai/AUDIT_RULES.md` — protocolo para auditorias profundas e planos de implementação.
8. `docs/index.md` — índice completo e precedência documental.
9. Specs/PRDs/business-rules do domínio que será alterado.

## Precedência

Quando houver conflito, siga a precedência canônica do repositório:

`CLAUDE.md` > `.claude/rules/` e contrato aplicável > `docs/specs/` > `docs/prd/` / business rules > documentos de estado/handoff > esta camada de AI Context > README/snapshots históricos.

Esta pasta **não é uma segunda fonte de verdade**. Ela é uma visão condensada. Se o código ou uma fonte de maior precedência mudou, atualize esta camada depois de confirmar a realidade.

## Regra de frescor

Antes de confiar em qualquer número, SHA, contagem de testes, lista de branches, status de deploy ou pendência:

1. confira o `audited_against`/data do documento;
2. confira `main`/branch atual;
3. valide a afirmação em código, Git ou fonte canônica;
4. trate snapshot antigo como histórico, não como realidade atual.

## Como usar em uma sessão de auditoria

Leia esta pasta primeiro para construir o mapa mental. Depois valide o mapa no repositório real. Não comece a editar código porque um documento diz que algo está quebrado. Primeiro reproduza, localize evidência e classifique o achado.

Fluxo recomendado:

`contexto -> mapa do repo -> verificações -> auditoria read-only -> causas raiz -> plano -> aprovação -> implementação -> testes -> revisão independente -> atualização de estado`

## O que esta camada tenta economizar

- redescoberta de stack e comandos;
- varredura cega de milhares de arquivos;
- leitura de handoffs históricos fora de contexto;
- confusão entre app CRM, website institucional e runtimes/workers;
- reabertura de decisões arquiteturais já documentadas;
- uso de um snapshot velho como fonte atual;
- gasto de tokens carregando histórico bruto quando um mapa pequeno é suficiente.

## O que nunca deve entrar aqui

- valores de `.env`;
- API keys, tokens, cookies ou secrets;
- PII de clientes/usuários;
- dumps de produção;
- números privados usados em testes reais;
- credenciais ou URLs contendo segredo;
- afirmação de que algo foi testado quando apenas foi lido.

Liste apenas **nomes** de variáveis de ambiente e referências a runbooks seguros.
