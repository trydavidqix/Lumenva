# Plano consolidado — blocos perigosos PT/UE e rename Lumenva

**Data:** 2026-09-05  
**Base:** `docs/audits/legal-pt-ue-audit-2026-09-05.md` e `docs/audits/rename-lumenva-vs-upstream-2026-09-05.md`  
**Estado:** plano apenas; nenhuma implementação autorizada por este documento.

Este plano separa obrigações jurídicas de contratos técnicos de rename. Cada item só avança após decisão do dono, revisão do impacto e gates locais. Nenhuma etapa presume acesso à produção.

## 1. Regras transversais

- Branches de implementação devem nascer de `main`, nunca da branch PT/UE ou desta branch de plano.
- Migration é sempre additive-first: adicionar destino e compatibilidade, testar, fazer backfill idempotente, operar em dual-read/dual-write, observar, deprecar e só então remover.
- Backfill deve ser reversível por lote, com contagem antes/depois, checksum ou amostra auditável, sem apagar dados existentes.
- Rollback de aplicação deve ser possível sem rollback destrutivo de dados; migrations de remoção só após janela de retenção e backup/restore ensaiado.
- Testes: unit/integration e `pnpm typecheck`, `pnpm lint`, `pnpm test:db` (quando schema/RLS), testes E2E/harness quando boundary ou UI mudar. VPS é último passo, com janela e autorização separadas.
- PII, segredos e dados reais não entram em fixtures, logs ou documentação.

## 2. Itens jurídicos PT/UE

### J1 — Máquina de estados RGPD (titular, extensão e recusa)

**Mudança exata.** Em `lib/lgpd/sla.ts`, `lib/lgpd/repository.ts`, os três webhooks `customer-data-request`, `customer-redact` e `store-redact`, specs/stories do EPIC-08 e tabelas de pedidos/auditoria, consolidar estados `received`, `in_review`, `extension_notified`, `responded`, `refused`. O prazo legal é um mês corrido via `computeDueAtGdpr`; extensão só quando justificada, até dois meses adicionais, com motivo e `notified_at`. Recusa exige fundamento RGPD e comunicação. Alarmes internos permanecem separados.

**Migração segura e rollback.** Adicionar enum/colunas de estado e campos de extensão nullable; dual-read aceitando estado legado; dual-write para novo estado e espelho legado; backfill por pedido; feature flag `RGPD_STATE_MACHINE_V1`; bloquear remoção do estado antigo até todos os consumidores migrarem. Rollback: desligar flag e ler o estado legado, preservando novos eventos.

**Testes/downtime.** Local + `test:db`, casos de extensão, recusa, idempotência e cálculo de mês. Sem downtime: alterações aditivas e deploy compatível.

**Dependências.** Bloqueia J6 e documentação de direitos; deve preceder qualquer rename de rotas/headers que toque webhooks.

### J2 — EPD/DPO por tenant

**Mudança exata.** Expandir `organizations`/settings além de `dpo_email` com avaliação documentada (`dpo_required`, critérios, `assessed_at`, responsável), contacto público, responsabilidades e ligação ao fluxo CNPD. Não assumir EPD obrigatório para todo tenant.

**Migração segura e rollback.** Adicionar colunas/tabela de avaliações e histórico; manter `dpo_email` em dual-read; backfill como `unknown`, nunca inferir `required`; dual-write durante compatibilidade; flag `DPO_ASSESSMENT_V1`; remoção do campo antigo somente depois de consumidores migrados. Rollback para leitura de `dpo_email` não perde a avaliação nova.

**Testes/downtime.** Fixtures de tenants nos três cenários RGPD; `test:db` cross-tenant/RLS; testes de publicação e CNPD. Sem downtime.

**Dependências.** J1 fornece auditoria/comunicação; J3 pode reutilizar responsáveis e audit trail.

### J3 — Violação de dados, 72 horas e CNPD

**Mudança exata.** Nova tabela/aggregate de incidentes com `known_at`, risco, `deadline_at = known_at + 72h`, decisão de notificar, `notified_at`, evidência/link CNPD, comunicação art. 34.º e escalonamento. Rotas/jobs e permissões server-side; documentação operacional.

**Migração segura e rollback.** Adicionar estrutura e job desligado por `BREACH_WORKFLOW_V1`; não importar incidentes sem fonte; dual-write apenas para novos eventos; backfill de incidentes históricos como `legacy_unknown` se exigido; retry idempotente. Rollback: pausar job, manter registos e procedimento manual, sem apagar evidência.

**Testes/downtime.** Relógio fake, atraso/retry, ausência de risco, risco elevado, cross-tenant e auditoria; `test:db`; ensaio local com formulário CNPD simulado. Sem downtime, mas requer plantão operacional para ativação.

**Dependências.** J2 para contacto EPD; J4 para base legal e minimização; bloqueia declaração de prontidão jurídica.

### J4 — Base legal por finalidade e consentimento

**Mudança exata.** Substituir o `consent` genérico de `lib/schemas/contacts.ts`/baseline por finalidade, base (`consent`, `contract`, `legal_obligation`, `legitimate_interests`, `vital_interests`, `public_task`), versão, timestamp, prova, canal e revogação. Marketing fica separado de execução contratual.

**Migração segura e rollback.** Adicionar tabela/evento de base legal; dual-read do campo antigo como `legacy_unclassified`; dual-write para novas finalidades; backfill apenas quando houver evidência, nunca inventar consentimento; flag `LEGAL_BASIS_V1`; deprecar depois de auditoria de cobertura. Rollback mantém o log novo e permite leitura do legado.

**Testes/downtime.** Unit de retirada/STOP, granularidade, caixas não pré-marcadas; `test:db` de RLS e imutabilidade da prova. Sem downtime.

**Dependências.** J6 e J3 dependem de retenção/base legal; J7 tax_id não deve reutilizar este vocabulário.

### J5 — Inventário de transferências internacionais, SCC e TIA

**Mudança exata.** Nova configuração/tabela por provider: país, subcontratante, finalidade, localização, adequação, SCC/BCR, versão, TIA, medidas suplementares, cifragem e data de revisão. Gate antes de ativar providers fora do EEE.

**Migração segura e rollback.** Adicionar inventário com estado `unknown`; catalogar providers existentes sem bloquear imediatamente; dual-read de configuração atual; flag `TRANSFER_GATE_V1` em modo observação, depois bloqueio; remoção de provider só após substituto aprovado. Rollback desliga o gate, não envia dados novos sem alerta.

**Testes/downtime.** Testes com providers mock EEE/não EEE, ausência de SCC, expiração e bloqueio; `test:db`; revisão documental. Sem downtime para catálogo; ativação do bloqueio pode interromper integrações não conformes.

**Dependências.** J5 precede J8 e qualquer reativação Nuvemshop/integração UE.

### J6 — Apagamento versus anonimização

**Mudança exata.** Em `lib/lgpd/redact-cascade.ts`, rotas de contacto e auditoria, explicitar resultado `erasure` ou `irreversible_anonymisation`, exceção legal, campos retidos e prova de irreversibilidade. Respostas não podem chamar “apagado” a uma pseudonimização.

**Migração segura e rollback.** Adicionar tipo/metadata de resultado e tabela de decisões; dual-read de eventos antigos; dual-write novo + evento legado; backfill só de metadados; flag `ERASURE_DECISION_V1`. Rollback volta à resposta antiga, sem restaurar PII anonimizados.

**Testes/downtime.** Testes de reidentificação, export, cascade, obrigações legais e retenção de auditoria; `test:db`. Sem downtime; anonimização é irreversível, portanto backup não deve conter PII além da política aprovada.

**Dependências.** J1 define comunicação; J4 define retenção; J6 bloqueia textos jurídicos de “apagamento concluído”.

### J7 — Consumidor, DL 24/2014 e 14 dias

**Mudança exata.** Só se o produto vender a consumidores: contratos, data de entrega, início/fim dos 14 dias, exceções, formulário, reembolso e informação duradoura; separar B2B. Tabelas/rotas de encomendas e templates de e-mail devem usar “livre resolução”, não CDC/NF-e.

**Migração segura e rollback.** Adicionar modelo de contrato e estados sem alterar pedidos antigos; dual-read de pedidos legados; dual-write em novas vendas; flag `CONSUMER_RIGHTS_V1`; backfill somente com datas comprovadas. Rollback desativa novas vendas B2C, preserva contratos.

**Testes/downtime.** Testes de 14 dias, exceções, reembolso e timezone PT; `test:db`; E2E local. Sem downtime para schema; pode exigir pausa comercial para ativação.

**Dependências.** Decisão de produto sobre venda B2C; J8 e J5 para provider/e-commerce.

### J8 — e-Fatura/SAF-T PT (futuro)

**Mudança exata.** Não implementar agora. Reservar integração futura com software certificado/AT, fatura/fatura-recibo, séries, ATCUD/QR, comunicação e SAF-T; marcar explicitamente fora do escopo e não chamar NF-e de fatura PT.

**Migração segura e rollback.** Quando aprovado, adicionar tabelas/documentos e adapter fiscal; dual-write para documento novo e legado; backfill apenas por reconciliação contabilística; flag `PT_FISCAL_V1`; rollback para emissão manual certificada. Não alterar linhas existentes nesta fase.

**Testes/downtime.** Sandbox/local da AT ou provider, validação de ficheiros e reconciliação; `test:db`; VPS apenas após certificação. Sem downtime para preparação, mas emissão pode exigir janela.

**Dependências.** J7 e J5; decisão de provider fiscal pendente. **FUTURO — NÃO EXECUTAR.**

### J9 — Substituto UE da Nuvemshop

**Mudança exata.** Não escolher nesta fase. Opções a avaliar: Shopify (forte cobertura UE, custo e lock-in), WooCommerce (self-host, maior operação), PrestaShop (ecossistema UE, manutenção), commercetools/Saleor (API-first, maior complexidade) e adapter genérico de pedidos/webhooks. Rotas Nuvemshop permanecem legacy atrás de feature flag.

**Migração segura e rollback.** Criar interface `EcommerceProvider` e contract tests; adapter novo em paralelo; dual-read apenas em sandbox, dual-write de eventos com idempotency key; backfill de pedidos por janela; flag por tenant; manter Nuvemshop até métricas de paridade e rollback.

**Testes/downtime.** Mocks/sandboxes locais, `test:db`, contract/E2E e teste de replay. Sem downtime para adapter; cutover por tenant pode exigir janela curta.

**Dependências.** J5, J7, J8 e J1. **DECISÃO DO DONO PENDENTE — não escolher sozinho.**

## 3. Itens perigosos do rename Lumenva

### R1 — Namespace de schema `crm_*` (895 tokens)

**Mudança exata.** Avaliar tabelas, constraints, índices, triggers, policies, funções, realtime, tipos gerados e referências em `supabase/**`, `lib/database.types.ts` e queries.

**Opções — DECISÃO DO DONO PENDENTE.**

1. **Manter `crm_*` como namespace funcional/técnico (recomendado para segurança):** zero migration de dados, menor conflito upstream e rollback simples; trade-off: nome antigo permanece no schema.
2. **Adicionar views/aliases `lumenva_*`, mantendo tabelas `crm_*`:** melhora descoberta sem mover dados; trade-off: duplicação de grants/tipos e superfície de manutenção.
3. **Renomear fisicamente:** marca técnica uniforme; trade-off extremo: migration coordenada, downtime/locks potenciais, RLS/realtime/tipos e consumidores externos quebrados.

**Estratégia segura.** Se opção 2, criar views additive-first, dual-read e contract tests. Se opção 3 for aprovada, criar objetos novos ou rename transacional por lotes quando suportado, backfill/verificação, dual-write, período de compatibilidade e remoção posterior. Rollback mantém `crm_*` até retenção expirar.

**Testes/downtime.** `test:db`, restore, RLS cross-tenant, tipos gerados, performance, realtime e replay de migrations. Opção 3 requer janela; opções 1/2 não.

**Dependências.** J7/tax_id e qualquer rename de pacote dependem desta decisão; não executar antes de inventário de consumidores.

### R2 — Prefixos `DESKCOMM_*` (69 tokens)

**Mudança exata.** Variáveis em `hostgator-setup-kit`, loop, docs, workers e runtime passam a aceitar `LUMENVA_*`; Infisical, `.env*` e manifests devem ser atualizados explicitamente. Não remover o prefixo antigo inicialmente.

**Estratégia segura e rollback.** Implementar leitura `LUMENVA_* ?? DESKCOMM_*`, rejeitar conflito de valores, emitir métrica sem segredo; dual-write apenas no sistema de gestão de secrets (não imprimir valores); ressincronizar Infisical + VPS; flag `LUMENVA_ENV_ALIAS`; após duas releases estáveis, deprecar e remover antigo. Rollback restaura somente a leitura DESKCOMM.

**Testes/downtime.** Fixtures sem segredos, `pnpm typecheck/lint`, harness, teste de instalação/update em VM/local; VPS só após resync confirmado. Sem downtime se ambos coexistirem; resync/restart pode exigir janela curta.

**Dependências.** R3 (imagem/compose) e R4 (domínios) devem estar prontos antes de remover aliases. **DECISÃO DO DONO PENDENTE:** nomes finais e prazo de depreciação.

### R3 — Docker, rede, volume e imagem GHCR

**Mudança exata.** `ghcr.io/melgarafael/deskcommcrm`, `deskcomm-*`, redes, volumes, labels/routers e diretórios HostGator. A stack está em execução; não trocar por substituição cega.

**Estratégia segura e rollback.** Publicar imagem Lumenva com digest verificável e manter tag antiga; `docker compose config` e stack paralela em ambiente descartável; alias de imagem e nomes antigos; backup/restore de volumes; só depois atualizar `APP_IMAGE`, labels e nomes. Rollback fixa digest antigo e reativa compose anterior. Nunca apagar volume/rede antiga durante a primeira release.

**Testes/downtime.** Local/CI, smoke de health, WAHA, worker, proxy, persistência e restart; VPS somente com backup verificado, janela, observação e plano de retorno. Sim, janela de manutenção é necessária para cutover/restart; pode ser zero-downtime apenas com stack paralela e proxy comprovados.

**Dependências.** R2 e R4; bloqueia update self-host e qualquer mudança de domínio.

### R4 — Domínios, CORS, OAuth e callbacks WAHA

**Mudança exata.** Domínios `deskcomm.*`, allowed hosts, CORS, cookies, OAuth callbacks, webhooks WAHA, TLS, Caddy/Traefik, e-mails e redirects para os domínios Lumenva.

**Estratégia segura e rollback.** Adicionar domínios/certificados e aceitar host antigo + novo; dual callbacks e CORS allowlist explícita; cookies com escopo compatível; DNS de baixa TTL; feature flag `LUMENVA_CANONICAL_HOST`; monitorar auth/webhook/e-mail; só depois redirecionar e remover antigo. Rollback reverte DNS/flag e mantém certificados/allowlist antiga.

**Testes/downtime.** Staging/local com hosts reais simulados, OAuth provider sandbox, assinatura WAHA, CORS, cookies, health e e-mail. VPS é último passo confirmado. Sim, janela coordenada pode ser necessária para DNS/TLS/callbacks; não declarar zero-downtime sem prova ponta a ponta.

**Dependências.** R2 e R3; R5 pacote/paths deve estar estabilizado antes de links finais. **DECISÃO DO DONO PENDENTE:** domínio canónico e política de redirects.

### R5 — Pacote, workspace e identificadores internos

**Mudança exata.** `package.json.name`, workspaces, imports, funções/classes/ficheiros, cookies e headers (`x-deskcomm-signature`, `deskcomm-impersonate`) — atualmente fora do bloco seguro.

**Estratégia segura e rollback.** Para pacote, publicar alias/compatibilidade e atualizar lockfile em release própria. Para headers/cookies, aceitar antigo + novo e emitir novo; dual-read/dual-write durante janela; migrar imports com codemod revisado. Rollback mantém aliases e versão anterior.

**Testes/downtime.** Typecheck, lint, unit, harness, E2E, replay de webhook e sessão. Sem downtime para aliases; headers/cookies exigem janela lógica de expiração.

**Dependências.** R1–R4; não misturar com migrations jurídicas. **DECISÃO DO DONO PENDENTE** para contratos externos e prazo de remoção.

## 4. Ordem recomendada (menor para maior risco)

1. Decisões do dono: R1 schema, J9 provider UE, J7 B2C, J8 fiscal, domínio canónico e aliases env.
2. J1, J2, J4 e J6 em modo aditivo, com testes de dados e auditoria.
3. J3 breach workflow em modo observação; J5 inventário de transferências e gate.
4. R2 aliases `LUMENVA_*`/`DESKCOMM_*` e R5 aliases de headers/cookies/pacote.
5. J7 consumidor, apenas se B2C aprovado; J9 adapter UE em sandbox; J8 permanece futuro.
6. R3 imagem/compose em ambiente descartável e depois VPS com janela.
7. R4 DNS/CORS/OAuth/WAHA em cutover coordenado.
8. Só após métricas, backfill verificado e retenção: deprecar/remover aliases e, se aprovado, R1 renomear fisicamente `crm_*`.

## 5. Maiores riscos e decisões pendentes

**Três maiores riscos:** (1) R3 Docker/imagem/volumes na stack viva; (2) R4 domínios, OAuth, CORS e callbacks WAHA; (3) R1 migration física de `crm_*` com RLS/realtime/dados existentes.

**Decisões do dono pendentes:** manter ou renomear fisicamente `crm_*`; substituto UE da Nuvemshop; ativar venda B2C e regra de 14 dias; provider fiscal e-Fatura/SAF-T; domínio Lumenva canónico/redirects; nomes finais e prazo de remoção de `DESKCOMM_*`; compatibilidade de headers/cookies/pacote.

**Critério de parada:** qualquer necessidade de migration destrutiva, alteração de linhas existentes, downtime não previsto, segredo/Infisical não ressincronizado, consumidor externo não inventariado ou decisão pendente bloqueia o item e exige nova aprovação do dono.
