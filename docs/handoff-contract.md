---
type: handoff-contract
version: 1
projects: [CRM, RouteLex, Helixforge, Lumenva Social]
---

# Contrato de handoff

## Entrega

- **Task/idempotency_key:** <id / chave>
- **Owner → destinatário:** <agente → CTO/QA>
- **Resultado:** <o que mudou e porquê>
- **Escopo:** <ficheiros/serviços>; worktree isolada; SHA <...>.

## Verificação

- DoD satisfeito: <sim/não por critério>.
- Comandos executados + exit codes: <lista>.
- Testes rápidos (<2 min) e gates completos relevantes: <resultado>.
- Review: <auditorias e veredito>; riscos/regressões: <lista>.
- Prova externa (provider/deploy/produção): `CONFIRMADO`, `NAO PROVADO` ou `NAO EXECUTADO`; documentação não substitui prova.

## Estado e próximo passo

- Estado versionado: `VERIFIED | DONE | NAO PROVADO | BLOCKED`.
- Limites/ciclos/custo usados: <tokens, euros, ciclos>.
- Lacunas e rollback: <lista/comando>.
- `PRECISA DONO`: <decisão/autorização concreta ou `não`>.

Não declarar aceitação por timeout, HTTP 200, processo iniciado ou teste parcial. O destinatário confirma receção e decisão separadamente.
