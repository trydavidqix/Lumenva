# Fase 2 — Mem0: estado de implementação

Data: 2026-08-13
Branch: `ai-platform-foundation`
Estado: **FECHADA. Gate da Tarefa 10 passou (`phase-2-mem0-gate.md`) e `SHADOW` foi ativado e verificado ponta a ponta — ver "Verificação SHADOW" abaixo.**

## Decisão operacional atual

`SHADOW` está ligado para **uma única organização de teste descartável**
(`ai-platform-mem0-shadow-test`), local nesta estação, não em produção. O
default global (`organization_id is null`) continua `OFF` — nenhum tenant
real foi afetado. PostgreSQL/Supabase continua a fonte de verdade; Mem0 é
projeção reconstruível.

Três bugs reais de infraestrutura/cliente foram encontrados e corrigidos
durante o boot (commit `f8fbb92c`): a rede `ai-memory-internal` sozinha
(`internal: true`) bloqueava egress do sidecar pro provider de embedding;
`Mem0Client.deleteContact()` mandava o identificador no body de um DELETE
que o servidor Mem0 só lê como query param; e `scripts/lib/env-de-teste.ts`
quebrava silenciosamente em `.env.local` com CRLF (Windows), então todo
script de seed falhava ao ler credenciais locais.

## Verificação SHADOW (2026-08-13)

Mensagem inbound simulada, ponta a ponta, contra infraestrutura real:

1. Servidor Mem0 real (build local, Gemini como embedder, tabela
   `memories` recriada em 768 dimensões) — `Mem0Client.upsert/search/
   deleteContact` provados contra ele diretamente.
2. Migration `20260810151119_0116_ai_platform_foundation.sql` aplicada no
   projeto Supabase remoto compartilhado (histórico de migration do CLI
   estava desincronizado de ~100 entradas; aplicada via SQL direto no
   dashboard para não arriscar `migration repair` errado).
3. Org de teste criada, `ai_platform_feature_flags` com `feature='mem0',
   mode='shadow'` escopado só a ela.
4. Mensagem/conversa/contato reais inseridos; o consumer real
   (`processMemoryProjection`, o mesmo que o worker chama para um evento
   `message.received` genuíno) resolveu a flag do banco como `shadow`,
   gerou `ai_projection_ledger.status='applied'`, e a memória apareceu de
   fato numa busca real no Mem0.
5. Único trecho substituído por dublê: a chamada de extração LLM (a chave
   Anthropic real usada mais cedo na sessão nunca foi persistida em disco,
   por disciplina de segurança). O pipeline extract → sanitize → ledger →
   upsert completo já tinha sido provado com a chave real no Golden Dataset
   (Tarefa 10); o que esta verificação prova de novo é a fiação do
   consumer (resolução de flag real + carga de mensagem real + Mem0 real).

## Entregue

| Tarefa | Entrega | Commits principais |
|---|---|---|
| 1 | `MemoryPort`, tipos e adapter nulo | `a91e47fb` |
| 2 | Sanitização determinística contra segredos e dados sensíveis | `c326ba98`, `ecb86180` |
| 3 | Extração tipada, com autoridade protegida e fail-closed | `6ff940e5`, `dc2f5401`, `76401511`, `fdc67286` |
| 4 | Adapter REST Mem0 OSS, escopado por organização/contacto | `0a0213fd` |
| 5 | Sidecar Compose opcional, profile `ai-memory` e runbook | `f4261f01`, `c24aef84` |
| 6 | Projeção assíncrona e idempotente de eventos oficiais | `b5bc8bf5`, `a1f42e13` |
| 7 | Provider de contexto e comparação em shadow | `d5bd0b6b`, `5d2d5cb2` |
| 8 | Fusão de contexto no prompt só sob rollout explícito e fail-closed | `6f6be4d7`, `7ce49214` |
| 9 | Lifecycle LGPD (delete automático) + script de reconstrução | `9d280a2f` |
| 10 | Gate de release completo: regressão, Golden Dataset (rodado de verdade, chave real), failure injection, prova de lifecycle/replay, verificação completa, achado de supersession corrigido no mesmo dia — ver `phase-2-mem0-gate.md` | `33d5de3f`, `a8f15b8e`, `a0e8c1e0`, fix de supersession |

## Pendências obrigatórias

Tarefa 10 está **fechada, gate passou** — ver
[`phase-2-mem0-gate.md`](phase-2-mem0-gate.md) para o detalhe completo.

~~Substituição de preferência (supersession) não existia~~ — corrigido no
mesmo dia em que foi achado. `extractMemoryCandidates` agora recebe as
memórias já conhecidas do contato e pode marcar quais uma frase nova
substitui; a antiga é aposentada (`validUntil = now`), não apagada.
Resultado real (6 rodadas com o modelo de verdade): 5/6 corretas (83%),
contra 0/2 antes do conserto. Não é 100% determinístico — é julgamento de
IA, igual o resto da extração — mas já é suficiente pra destravar `SHADOW`
(que é só medição, não aparece pro cliente).

Nenhuma pendência bloqueante restante. Promoção pra `SHADOW`/`CANARY`/`ON`
segue exigindo decisão explícita de produto (não é automática só porque o
gate técnico passou), e Fase 3 continua não iniciada até essa decisão.

~~Validação no Windows~~ — feita em 2026-08-13. `docker compose config`
válido nos dois arquivos; healthcheck do profile `ai-memory` responde
`HEALTHY` e `/auth/setup-status` responde `{"needsSetup":true}` num boot
limpo, sem intervenção manual. Achado no caminho: a imagem pinada
`mem0/mem0-api-server:0.1.117` não existe mais no Docker Hub e `latest` é
ARM64-only — sem build amd64 publicado. Caminho adotado: build local a
partir do source oficial (commit `96d45b78`), com 3 correções sobre o
`server/Dockerfile` deles (dependência `psycopg[binary]` ausente, pasta
`/app/history` nunca criada, migração `alembic` nunca executada) — receita
completa em `docs/runbooks/mem0.md`. Ainda não validado: confirmação de que
o Mem0 OSS em execução respeita `Idempotency-Key` (requer bootstrap com
chave de provider real, fora do escopo desta validação de infraestrutura).

`SHADOW` foi ativado apenas para a org de teste descartável acima, como
verificação técnica — não é promoção de produto para tenants reais. Sem
decisão explícita de produto, não promover nenhum tenant real para
`SHADOW`, `CANARY` ou `ON`, e não iniciar a Fase 3 por conta própria.

## Referências operacionais

- Plano: [`../../superpowers/plans/2026-08-10-ai-platform-phase-2-mem0.md`](../../superpowers/plans/2026-08-10-ai-platform-phase-2-mem0.md)
- Runbook do sidecar: [`../../runbooks/mem0.md`](../../runbooks/mem0.md)
- Entrada da iniciativa: [`../../../CODEX-AI-PLATFORM.md`](../../../CODEX-AI-PLATFORM.md)
