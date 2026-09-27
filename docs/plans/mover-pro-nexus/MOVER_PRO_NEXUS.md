# Plano — Extração Lumenva → Nexus

**Objetivo:** retirar do Lumenva tudo que é infraestrutura e execução técnica e transferir essas responsabilidades para o Nexus, sem perder funcionalidades empresariais.

## Fase 1 — Inventário

Mapear no Lumenva tudo relacionado a:

- Maestri técnico
- Claude/Codex/Gemini/Jules técnicos
- BrowserMesh
- Computer Use
- terminal/filesystem/código
- Git/worktrees/branches/PRs
- Engineering Control Plane
- Project Factory de software
- Compute Fabric
- workforce técnico
- hooks técnicos
- sandbox técnico
- CI/CD inteligente

Classificar cada item como:

- código
- documentação
- configuração
- integração
- legado

## Fase 2 — Definir a fronteira

Regra definitiva:

```text
Lumenva → solicita capacidade técnica
Nexus → executa
Lumenva ← recebe resultado + evidence
```

Lumenva não conhece detalhes internos de:

- Codex
- Claude
- Gemini
- Jules
- máquina
- worktree
- BrowserMesh
- runtime técnico

## Fase 3 — Mover orquestração técnica

Transferir para Nexus:

- Maestri técnico
- roteamento Claude/Codex/Gemini/Jules
- sessões técnicas
- workforce de engenharia
- escolha de runtime/modelo técnico

O Maestri empresarial da Lumenva permanece separado.

## Fase 4 — Mover Execution Plane

Nexus passa a possuir:

- BrowserMesh
- navegador
- Computer Use
- terminal
- filesystem
- execução de código
- sandbox técnico
- downloads/uploads técnicos

Lumenva acessa isso somente por capability/API.

## Fase 5 — Mover Engineering Control Plane

Transferir:

- branches
- worktrees
- commits
- PRs
- reviews
- testes técnicos
- GitHub Actions orchestration
- merge/release automation
- hooks de engenharia

GitHub continua sendo usado pelo projeto Lumenva; apenas a inteligência que administra esse processo vai para Nexus.

## Fase 6 — Mover Project Factory

Tudo que significa:

```text
requisito
→ arquitetura
→ código
→ testes
→ PR
→ deploy
```

vai para Nexus.

Lumenva mantém somente criação de conteúdo e ativos comerciais.

## Fase 7 — Mover Compute Fabric

Decisões como:

```text
qual máquina?
qual VPS?
qual runtime?
qual capacidade?
qual agente técnico?
```

ficam no Nexus.

Lumenva vê somente uma capability disponível.

## Fase 8 — Criar integração Nexus ↔ Lumenva

Contrato mínimo:

```text
Task Request
→ permissions
→ execution
→ status
→ result
→ evidence
→ ActionReceipt
```

Requisitos:

- `organization_id` quando houver contexto empresarial
- permissões
- timeout
- idempotência
- auditoria
- erro normalizado
- evidence
- ActionReceipt

## Fase 9 — Limpeza do Lumenva

Depois que Nexus assumir cada função:

- remover implementações técnicas duplicadas
- remover documentos conflitantes
- retirar telas técnicas do Command Center
- retirar referências antigas ao BrowserMesh interno
- retirar Compute Fabric técnico
- retirar Project Factory de software
- retirar engenharia autônoma do blueprint Lumenva

Não apagar histórico útil; marcar como `superseded` ou arquivado quando necessário.

## Fase 10 — Validação final

Provar que:

- Lumenva funciona sem runtime técnico interno
- Nexus consegue executar uma tarefa solicitada pelo Lumenva
- BrowserMesh funciona via Nexus
- engenharia funciona via Nexus
- resultado/evidence retorna corretamente
- nenhuma capability empresarial foi perdida
- não existe sistema técnico duplicado nos dois projetos

## Critério de conclusão

```text
LUMENVA
= Business OS

NEXUS
= Engineering + Technical Execution OS

LUMENVA → Nexus
somente por contratos/capabilities
```

Nada empresarial sai da Lumenva; somente infraestrutura e execução técnica migram para o Nexus.
