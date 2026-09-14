# Revisão consolidada — Actor Registry (Wave 4) e Memory Gateway (Wave 13)

Data: 2026-09-13  
Método: revisão read-only no worker; sem merge, deploy ou efeitos externos.

## Commits auditados

- Fornalha / Wave 4: `ef1ccff43b35906fb33d005265c7f11c9079f9ff` — `fix(wave4): authorize actions through actor registry`, worktree `wave4-browsermesh-wake-2026-09-12`.
- Cartógrafa / Wave 13: `95a4bbf1f4a6d09a44a6bfc9ac93b3538fc59706` — `feat(memory): add single gateway router`, presente no worktree `business-os-phase-0-audit-2026-09-11`.

## Actor Registry / Action Bus

**PASS — fail-closed para actor e capability.** `action-bus.ts:3-12,15-27` usa chave composta `organization_id:actor_id`; actor inexistente ou desabilitado gera `action_actor_not_authorized`, e capability ausente gera `action_actor_capability_denied`. O worker e a allowlist continuam sendo verificados depois, antes do adapter. O `ActionBus` default cria registry vazio, portanto não autoriza silenciosamente quando nenhum registry é fornecido.

Os testes do commit cobrem actor forjado no envelope, actor sem capability e mismatch de tenant. Não há fallback que execute a ação quando o registry falha ou não contém o actor.

## Memory Gateway

**PASS — roteamento sem fail-open perigoso no escopo auditado.** `memory-gateway.ts:1-31` aceita somente os três backends obrigatórios no tipo/construtor; `kind` explícito roteia exclusivamente para o backend correspondente, e a classificação desconhecida cai deterministicamente em `semantic`, sem executar múltiplos backends nem inventar resultado. Os testes verificam roteamento semântico/episódico/procedural e que `kind: episodic` não chama os demais.

Um `kind` inválido injetado em runtime (fora do tipo TypeScript) resulta em `TypeError` ao acessar backend inexistente, não em execução permissiva. O gateway é uma seam de roteamento; autenticação/tenant devem ser impostos pelos backends/camada chamadora e não estão representados em `MemoryQuery`.

## Secrets e logging

Não foram encontrados secrets hardcoded, chaves, passwords ou logging de dados sensíveis nos arquivos dos dois commits.

## Veredito final

**PASS (com limite de escopo).** Os dois commits fecham os caminhos de fail-open analisados e não introduzem secret hardcoded. Resta como responsabilidade arquitetural externa a autenticação do actor e o isolamento de tenant nos backends de memória; isso não é demonstrado por estes dois commits.

SELF-CHECK: PASS — SHAs, trechos, testes e limites documentados; revisão somente leitura.
