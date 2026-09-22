# Auditoria seletiva: migrations upstream 0347–0380

Data: 2026-09-22
Upstream auditado: `melgarafael/DeskcommCRM`, commit `3538380b`
Base local: `trydavidqix/Lumenva`, `main` em `a2b44a1c`

## Resultado executivo

Nenhuma migration deste intervalo foi portada. Não há candidato simultaneamente
seguro, útil e isolável no schema atual do Lumenva.

O intervalo upstream introduz quatro cadeias de produto que não existem aqui
(financeiro/comanda, prospecção, banco externo e hierarquia de anúncios), além
de uma implementação de voz que sobrepõe o Social Brain/Voice já existente no
Lumenva. As migrations de agenda/Meet são correções comportamentais acopladas a
funções que não existem localmente.

O candidato pontual mais promissor, 0364, não é aplicável: o Lumenva não tem
`calendar_oauth_nonces`, a migration 0190 nem
`fn_expurgar_nonces_de_oauth`. Portar apenas o rename dos parâmetros deixaria
referências a objetos inexistentes e quebraria a instalação.

Como não existe contrato local equivalente, não foi criado teste TDD nem SQL
“compatível” artificialmente. O próximo passo correto para qualquer item
rejeitado é uma feature/módulo próprio, com contrato e testes, não um cherry-pick
de migration.

## Evidência do lado local

O baseline e as migrations locais já possuem o módulo de voz em vocabulário
próprio:

- `supabase/baseline.sql:10258+`: `voice_calls` e `voice_call_events`;
- `supabase/baseline.sql:10379+`: `voice_phone_numbers`;
- `supabase/baseline.sql:10448+`: `voice_sip_connections`;
- `supabase/migrations/20260830190000_0133_voice_calls_provider_asterisk.sql`:
  forward-fix do provider Asterisk;
- `apps/crm/lib/voice/**` e rotas internas usam essas tabelas diretamente.

Não foram encontrados no repo local `financial_accounts`, `payment_methods`,
`account_plans`, `sales`, `recurring_entries`, `calendar_oauth_nonces`,
`fn_expurgar_nonces_de_oauth`, `fn_meet_action`, `channel_integrations`,
`prospecting_candidates`, `external_database_connections` ou
`ad_hierarchy_cache`.

## Matriz migration a migration

| Upstream | Conteúdo | Equivalente/conflito local | Risco | Decisão |
|---|---|---|---|---|
| 0347 | Módulo VoIP: `phone_numbers`, resolver e `ai_agents.channel` | Sobrepõe `voice_phone_numbers`, resolvers e Voice local; nomes/schema diferentes | Alto | Não portar |
| 0348 | SIP em `voice_calls`, constraints/nullability e LGPD | Altera as mesmas `voice_calls` locais e constraints já corrigidas por 0126–0133 | Alto | Não portar |
| 0349 | `voip_trunk_settings`, view segura e RLS | Tabela nova com credenciais SIP; sem consumidor local | Alto | Não portar |
| 0350 | Catálogo financeiro: três tabelas | Objetos ausentes | Alto | Não portar isolado |
| 0351 | Comanda, vendas e lançamentos financeiros | Depende de 0350; módulo ausente | Alto | Não portar |
| 0352 | Deduplicação de vendas e índice por agendamento | Depende de `sales`; altera dados e cria constraint | Alto | Não portar |
| 0353 | Relatório financeiro | Depende de 0350/0351 e contratos de app ausentes | Alto | Não portar |
| 0354 | Comissão inativa | `commission_rules`/financeiro upstream não estão no módulo local equivalente | Alto | Não portar |
| 0355 | Saldo de fidelidade | Depende de `sales` e regras financeiras upstream | Alto | Não portar |
| 0356 | Relatório por serviço/cliente | Evolução da função financeira upstream | Alto | Não portar |
| 0357 | Lançamentos recorrentes e índices financeiros | Depende do financeiro ausente; muda `financial_entries` | Alto | Não portar |
| 0358 | `calendar_event_types.default_price_cents` | Campo faria parte do módulo financeiro; sem consumidor local validado | Médio-alto | Não portar isolado |
| 0359 | LGPD alcança `sales` | `sales` não existe localmente; função referenciaria tabela ausente | Alto | Não aplicável |
| 0360–0362 | Nenhum arquivo no clone upstream auditado | Não há patch para avaliar | — | Sem ação |
| 0363 | Recusa permanente da agenda em `fn_meet_action` | Função/cadeia Meet upstream não existe localmente | Alto | Não portar |
| 0364 | Renomeia parâmetros da poda de nonces para o contrato do cron | Lumenva não tem 0190, `calendar_oauth_nonces` ou a função alvo | Alto | Não aplicável |
| 0365 | Ação explícita de reenviar link Meet | Depende de 0363 e da cadeia de entrega Meet | Alto | Não portar |
| 0366 | Compromisso sem Meet e mudanças no enfileirador | Altera semântica de agenda/entrega; funções locais não equivalentes | Alto | Não portar |
| 0367 | `organizations.interface_settings` | Requer resolver/UI; há configurações locais de outra granularidade | Médio-alto | Não portar isolado |
| 0368 | Redes sociais nativas e constraints de canais | Sobreposição direta com Social Brain e F1/F2 | Alto | Não portar |
| 0369 | Prospecção nativa | Cadeia de tabelas/rotas ausente | Alto | Não portar |
| 0370 | Anonimização de candidatos de prospecção | Depende de 0369 e adiciona LGPD específica | Alto | Não portar |
| 0371 | Conversa salva para prospecção | Depende de 0369/0370 e contratos de app ausentes | Alto | Não portar |
| 0372 | Banco externo do agente, crypto, view e RLS | Secrets, arquitetura e acesso a banco externo; decisão de segurança necessária | Alto | Não portar |
| 0373 | Limites configuráveis do banco externo | Depende de 0372; mesma superfície de secrets/arquitetura | Alto | Não portar |
| 0374 | Remarcação corrige envio ao cliente | Depende da cadeia 0365/0366 e triggers Meet | Alto | Não portar |
| 0375–0379 | Nenhum arquivo no clone upstream auditado | Não há patch para avaliar | — | Sem ação |
| 0380 | Cache hierárquico de anúncios, server-only + RLS | Tabela ausente; nova superfície de ads e política server-only | Alto | Não portar |

## Decisão de execução

- Nenhum commit de schema foi criado.
- Não houve RED/GREEN: sem um equivalente local, um teste de portabilidade
  testaria uma feature inventada, não um bug real do Lumenva.
- O item 3b fica auditado e encerrado como “nenhum port seguro identificado”.
- Financeiro, prospecção, VoIP upstream, Meet, banco externo e ads devem ser
  tratados como projetos próprios, cada um com desenho, contrato de aplicação,
  migration tripla e matriz de regressão antes de qualquer port.
