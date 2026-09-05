# Auditoria jurídica BR → Portugal/UE — 2026-09-05

Escopo: auditoria documental e estática do checkout em `fff3611f0f38e325d1df29908f5f9ea7631469b0`, sem alterar código. A análise confirma a migração parcial registada em `docs/handoffs/HANDOFF-lgpd.md` e separa o que já está corrigido do que ainda mantém premissas brasileiras.

## Veredito executivo

O repositório já contém uma camada RGPD parcial: `computeDueAtGdpr` calcula um mês de calendário, `createLgpdRequest` usa essa função e a anonimização irreversível/cascade foi corrigida. Porém, a superfície ainda não é juridicamente PT/UE: os webhooks continuam documentados como LGPD e com comentários de 7/15 dias úteis brasileiros; o baseline e os schemas assumem CNPJ, BRL, `America/Sao_Paulo` e `pt-BR`; a validação de contacto aceita exclusivamente CPF de 11 dígitos; e não há mecanismo comprovado para EPD/DPO, registo e notificação de violações à CNPD, transferências internacionais ou livre resolução do consumidor.

### Estado confirmado como já feito

- `docs/handoffs/HANDOFF-lgpd.md` registra que os bugs de criação, listagem, aprovação, worker e cascade foram corrigidos (`090c59e`, `f33119b`).
- `lib/lgpd/sla.ts:82-113` tem `computeDueAtGdpr`, com um mês corrido e extensão parametrizável; `lib/lgpd/repository.ts:38-49` usa-a.
- A anonimização prefere preservar histórico e limpar PII. Isto é compatível com minimização e prestação de contas, desde que o titular receba resposta RGPD e a anonimização seja efetivamente irreversível.
- O código já usa `pt-PT` em `lib/lgpd/sla-alarm.ts:110`, mas isso não é um locale global coerente.

## Achados priorizados

### P0 — RGPD/SLA, EPD e violações

1. **SLA dos pedidos de titular está semanticamente misturado.**

   - **Arquivos/trechos:** `app/api/v1/webhooks/nuvemshop/customer-data-request/route.ts:13,233-247`; `app/api/v1/webhooks/nuvemshop/customer-redact/route.ts:13,220-226`; `app/api/v1/webhooks/nuvemshop/store-redact/route.ts:4-18,225-227`; `lib/lgpd/sla.ts:1-9,45-79`; `docs/stories/epics/EPIC-08-lgpd.md` (S-08.01 e DoD).
   - **Erro jurídico:** comentários, stories e calculadora ainda dizem “7/15 BR business days”, “Art. 19 LGPD” e “feriados BR”. O RGPD, art. 12.º, n.º 3, exige resposta sem demora injustificada e, em regra, **um mês de calendário**; só permite mais dois meses quando a complexidade/número de pedidos o justificar, com informação ao titular dentro do primeiro mês. Não são 7/15 dias úteis nem há dois SLAs jurídicos distintos para acesso/apagamento.
   - **Deve ser:** um único relógio RGPD de um mês corrido para direitos dos artigos 15.º–22.º, com estado explícito `extension_notified`, motivo da extensão e data de notificação; políticas internas podem ter alarme antecipado, mas não podem substituir o prazo legal. `computeDueAtGdpr` deve ser a única função usada pelos três endpoints.
   - **Prioridade/tipo:** bloqueante; código + texto/documentação + teste.
   - **Fonte:** [RGPD, art. 12.º, n.º 3, EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj); [CNPD — direitos dos titulares](https://www.cnpd.pt/cidadaos/direitos/).

2. **EPD/DPO não é “obrigatório para todos”, mas o produto não implementa a avaliação/declaração exigida.**

   - **Arquivos/trechos:** `supabase/baseline.sql:1757-1758` apenas tem `dpo_email`; `lib/schemas/settings.ts:66-72` aceita e-mail opcional; não foi encontrado fluxo de avaliação, publicação ao titular ou comunicação à CNPD.
   - **Erro jurídico:** apresentar `dpo_email` opcional como cumprimento é insuficiente. O RGPD, arts. 37.º–39.º, exige EPD quando o tratamento preencher os critérios (autoridade pública; monitorização regular e sistemática em larga escala; categorias especiais/dados criminais em larga escala). A CNPD confirma que empresas só estão obrigadas nesses casos e que os contactos devem ser publicados e comunicados nos termos dos arts. 13.º/14.º.
   - **Deve ser:** campo e estado `dpo_required` baseado em avaliação documentada, contacto público no aviso de privacidade, responsabilidades/acesso do EPD e integração com o formulário de notificação da CNPD quando aplicável; não assumir que todo tenant precisa de DPO nem que um e-mail opcional resolve.
   - **Prioridade/tipo:** bloqueante; código + schema/dados + documentação.
   - **Fonte:** [RGPD, arts. 37.º–39.º, EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj); [CNPD — Encarregado de proteção de dados](https://www.cnpd.pt/organizacoes/outras-obrigacoes/encarregado-de-protecao-de-dados/); [formulário CNPD de notificação de EPD](https://www.cnpd.pt/DPO/DPOiniciar.aspx).

3. **Não existe processo de violação com janela de 72 horas para a CNPD.**

   - **Arquivos/trechos:** `CLAUDE.md` reconhece que a notificação é “processo manual, sem automação no código”; `docs/handoffs/HANDOFF-lgpd.md` não mostra incidente workflow; não há rota, tabela ou job de breach/CNPD.
   - **Erro jurídico:** RGPD art. 33.º exige notificar a autoridade competente sem demora injustificada e, sempre que possível, até 72 horas após conhecimento, salvo ausência de risco; mesmo quando não notificável, a violação deve ser documentada. Risco elevado também aciona comunicação ao titular (art. 34.º). “Manual” sem relógio, evidência e responsável não prova cumprimento.
   - **Deve ser:** incidente com `known_at`, avaliação de risco, prazo UTC de 72h, escalonamento, formulário/link CNPD, registo da decisão e comunicação ao titular quando aplicável; subcontratantes devem alertar o responsável sem demora.
   - **Prioridade/tipo:** bloqueante; código + schema/dados + operação/documentação.
   - **Fonte:** [RGPD, arts. 33.º–34.º, EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj); [CNPD — violação de dados](https://www.cnpd.pt/organizacoes/outras-obrigacoes/violacao-de-dados-ou-data-breach/).

4. **Base legal/consentimento não está modelada como obrigação RGPD.**

   - **Arquivos/trechos:** `lib/schemas/contacts.ts:48-50` aceita `consent` como `z.record`; `supabase/baseline.sql` mantém configurações históricas de consentimento sem vocabulário de base legal; `docs/specs/06-spec-nuvemshop-lgpd.md` fala em “consent” e CPF sem matriz RGPD.
   - **Erro jurídico:** consentimento não é sinónimo de base legal. RGPD art. 6.º exige uma base legal por finalidade; art. 7.º exige demonstração, retirada tão fácil quanto dar, granularidade e proíbe silêncio/caixas pré-marcadas (considerando 32). Contrato, obrigação legal e interesse legítimo não devem ser falsamente registados como consentimento.
   - **Deve ser:** finalidade, base (`consent`, `contract`, `legal_obligation`, `legitimate_interests`, `vital_interests`, `public_task`), versão do texto, timestamp, prova, canal e retirada; marketing deve ser separado de execução contratual e STOP/opt-out deve revogar a finalidade correspondente.
   - **Prioridade/tipo:** bloqueante; schema/dados + código + texto.
   - **Fonte:** [RGPD, arts. 5.º–7.º, EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj).

5. **Transferências internacionais não têm contrato/gate.**

   - **Arquivos/trechos:** `CLAUDE.md` e `docs/specs/06-spec-nuvemshop-lgpd.md` preveem providers externos e tokens, mas não há inventário de países, decisão de adequação, SCC, TIA ou medidas suplementares.
   - **Erro jurídico:** enviar dados para fornecedores fora do EEE exige capítulo V do RGPD: decisão de adequação (art. 45.º), garantias adequadas como SCC/BCR (art. 46.º) ou exceção restrita (art. 49.º), mantendo nível de proteção equivalente.
   - **Deve ser:** registo por integração/provider, localização, subcontratante, base de transferência, SCC versão, TIA, cifragem e bloqueio de provider sem gate de privacidade.
   - **Prioridade/tipo:** bloqueante antes de dados reais; código + documentação + dados de configuração.
   - **Fonte:** [RGPD, arts. 44.º–49.º, EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj); [EDPB — transferências](https://www.edpb.europa.eu/sme-data-protection-guide/secure-personal-data_en).

6. **Apagamento/anonymização: decisão de produto é válida, mas não pode virar recusa do direito.**

   - **Arquivos/trechos:** `lib/schemas/contacts.ts:68-71` chama a operação `lgpdAnonymizeSchema`; `app/api/v1/contacts/[id]` equivalente e `lib/lgpd/redact-cascade.ts`; `docs/handoffs/HANDOFF-lgpd.md:28-42` confirma cascade irreversível.
   - **Erro jurídico:** RGPD art. 17.º garante apagamento quando aplicável, sujeito a exceções (obrigação legal, defesa de direitos, liberdade de expressão, interesse público). Anonimização irreversível pode ser a forma técnica de deixar de tratar dados pessoais, mas preservar `orders`, `evidence` ou auditoria exige minimização, separação e prova de que não é reidentificável. Não se pode responder “apagado” quando apenas se pseudonimizou.
   - **Deve ser:** decisão por campo/propósito, `erasure` versus `irreversible_anonymisation`, exceção legal documentada, resposta exportável ao titular e teste de reidentificação; manter trilha de auditoria sem PII.
   - **Prioridade/tipo:** importante; código + documentação + testes.
   - **Fonte:** [RGPD, arts. 17.º e 18.º, EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj); [CNPD — direitos](https://www.cnpd.pt/cidadaos/direitos/).

### P0/P1 — Identificadores fiscais, dinheiro e fatura

7. **CPF é hard-coded; falta NIF/NIPC e IVA intracomunitário.**

   - **Arquivos/trechos:** `lib/schemas/contacts.ts:13,19-31,42`; `lib/contacts/cpf.ts:4-7,12-20`; `components/contacts/NewContactDialog.tsx:98-99`; `lib/ai/anonymize/index.ts:25,46`; `supabase/baseline.sql:1351-1371`; `lib/schemas/settings.ts:57-62`; `supabase/baseline.sql:1749`.
   - **Erro jurídico/locale:** pessoa singular portuguesa usa NIF de 9 dígitos; pessoa coletiva usa NIPC (normalmente 9 dígitos). CPF brasileiro de 11 dígitos e algoritmo da Receita não valida NIF. Para clientes UE, é necessário distinguir NIF local, NIPC e VAT intracomunitário (prefixo país + número) e validar por país/VIES quando a regra fiscal o exigir.
   - **Deve ser:** substituir `cpf`/`cnpj` por vocabulário neutro (`tax_id`, `tax_id_type`, `tax_country`, `vat_number`), preservar migração de dados BR como legado, adicionar `NIF`/`NIPC` com país e máscaras PT, e não tratar VAT como dado de pessoa singular sem necessidade.
   - **Prioridade/tipo:** bloqueante para onboarding/faturação PT; schema/dados + código + texto.
   - **Fonte:** [AT — NIF de pessoa singular, 9 dígitos](https://info.portaldasfinancas.gov.pt/pt/apoio_ao_contribuinte/Cidadaos/Dados_pessoais_familia/Dados_pessoais/NIF/Paginas/default.aspx); [AT — SAF-T identifica NIF/NIPC](https://info.portaldasfinancas.gov.pt/pt/apoio_contribuinte/modelos_formularios/decl_anual_inf_contabilistica_fiscal/Documents/Submissao_SAF_T_PT_2019_e_seguintes.pdf).

8. **BRL/R$ é o default do CRM e do e-commerce.**

   - **Arquivos/trechos:** `lib/schemas/leads.ts:69`; `supabase/baseline.sql:1472,1724`; `components/kanban/NewLeadDialog.tsx:95`; múltiplos formatadores `pt-BR`/`BRL` (`components/kanban/StageColumn.tsx:30-36`, `components/kanban/LeadDossier.tsx:22-28`, `lib/money.ts:59-60`, `components/ai/UsageChart.tsx:18-22`).
   - **Erro jurídico/locale:** EUR é a moeda de referência PT; `pt-BR` exibe `R$` e convenções brasileiras. O sistema permite moeda de 3 letras, mas o default e vários formatadores ignoram o campo.
   - **Deve ser:** `EUR` como default de instalação PT/UE, formatar com `Intl.NumberFormat('pt-PT',{style:'currency',currency:'EUR'})` e mostrar `1 234,56 €` conforme locale; manter BRL apenas em tenants explicitamente configurados.
   - **Prioridade/tipo:** importante; código + schema/dados + texto.
   - **Fonte:** [Banco Central Europeu — euro](https://www.ecb.europa.eu/euro/html/index.en.html); [CLDR/MDN Intl.NumberFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat).

9. **“Nota fiscal/NF-e” e Nuvemshop não equivalem a faturação portuguesa.**

   - **Arquivos/trechos:** `docs/specs/06-spec-nuvemshop-lgpd.md`, `docs/prd/06-prd-nuvemshop-lgpd.md`, `lib/ecommerce/types.ts` (provider Nuvemshop e `currency: 'BRL'`), `docs/handoffs/HANDOFF-lgpd.md:3-4` (Nuvemshop desligada).
   - **Erro jurídico:** em Portugal, documento fiscal é fatura/fatura-recibo; emitentes sujeitos a IVA comunicam elementos à AT pelo e-Fatura e/ou SAF-T (PT). Não há evidência de número de fatura, séries, ATCUD/QR, comunicação ou SAF-T no CRM.
   - **Deve ser:** marcar faturação fiscal PT como fora de escopo explícito agora; quando implementada, integrar software certificado/AT, modelo de fatura e comunicação até ao dia 5 do mês seguinte (regra atual indicada pela AT), não reutilizar “NF-e”.
   - **Prioridade/tipo:** importante; texto/documentação agora, código/schema quando faturação entrar.
   - **Fonte:** [AT — comunicação de elementos de faturas/e-Fatura](https://info.portaldasfinancas.gov.pt/pt/apoio_contribuinte/questoes_frequentes/Pages/faqs-00978.aspx); [AT — manual e-Fatura/SAF-T](https://info.portaldasfinancas.gov.pt/pt/apoio_ao_contribuinte/Outras_entidades/Suporte_tecnologico/Webservice/e_Fatura/Documents/Comunicacao_dos_elementos_dos_documentos_de_faturacao.pdf).

### P1 — Consumidor, locale, tempo e telefonia

10. **Não há regra de livre resolução de 14 dias nem informação pré-contratual PT/UE.**

   - **Arquivos/trechos:** `docs/specs/06-spec-nuvemshop-lgpd.md`, `docs/prd/06-prd-nuvemshop-lgpd.md` e `docs/stories/epics/EPIC-08-lgpd.md` tratam e-commerce apenas como Nuvemshop/webhook; não foi encontrada regra de contratos à distância, resolução, reembolso ou informação pré-contratual.
   - **Erro jurídico:** CDC brasileiro não é a fonte aplicável. Em PT, DL 24/2014 transpõe a Diretiva 2011/83/UE; em regra o consumidor tem 14 dias para livre resolução, com exceções do art. 16 da Diretiva. A Diretiva 2019/2161 (Omnibus) moderniza informação, reviews, preços e sanções.
   - **Deve ser:** se o produto vender a consumidores, modelar estado do contrato, data de entrega, prazo de 14 dias, exceções, formulário, reembolso e informação duradoura; separar consumidor de cliente profissional B2B.
   - **Prioridade/tipo:** importante; código + texto + documentação.
   - **Fonte:** [DL 24/2014, Diário da República](https://files.dre.pt/gratuitos/1s/2014/02/03200.pdf); [Diretiva 2011/83/UE, art. 9.º, EUR-Lex](https://eur-lex.europa.eu/legal-content/PT/TXT/?uri=CELEX:32011L0083); [Diretiva Omnibus 2019/2161](https://eur-lex.europa.eu/eli/dir/2019/2161/oj).

11. **Fuso/locale padrão continuam brasileiros.**

   - **Arquivos/trechos:** `lib/schemas/onboarding.ts:7-10`; `app/onboarding/welcome/_form.tsx:18-38`; `supabase/baseline.sql:1751-1752`; `lib/schemas/settings.ts:13-14`; `lib/routing/eligibility.ts:66`; numerosos formatadores `pt-BR`.
   - **Erro jurídico/operacional:** `America/Sao_Paulo`, `pt-BR` e horários BR alteram data de receção, SLA, mensagens, moeda e termos (“usuário”, “CPF”, “nota fiscal”). Portugal usa `Europe/Lisbon`, com mudança sazonal; vocabulário deve ser `utilizador`, “fatura”, “NIF”, “livre resolução”, “encarregado”.
   - **Deve ser:** defaults PT (`Europe/Lisbon`, `pt-PT`, `EUR`), locale por organização/contacto com fallback PT; manter BR somente como escolha explícita de migração. Não fazer substituição cega de conteúdo histórico.
   - **Prioridade/tipo:** importante; código + schema/dados + texto.
   - **Fonte:** [IANA time zone Europe/Lisbon](https://www.iana.org/time-zones); [Código do Trabalho, feriados e regime PT](https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2009-34546475-46746675).

12. **Calendário de SLA usa feriados brasileiros, não nacionais portugueses.**

   - **Arquivos/trechos:** `lib/lgpd/holidays-br.ts:1-7,14-23,31-60`; `lib/lgpd/sla.ts:1-9,52-79`; `docs/stories/epics/EPIC-08-lgpd.md` menciona “dias úteis BR” e `holidays-br.ts`.
   - **Erro jurídico/operacional:** para alarmes internos de atendimento ou qualquer prazo contratual PT, o calendário está errado. Feriados nacionais obrigatórios PT (Código do Trabalho, art. 234.º): 1/1; Sexta-Feira Santa; Domingo de Páscoa; 25/4; 1/5; Corpo de Deus; 10/6; 15/8; 5/10; 1/11; 1/12; 8/12; 25/12. Em 2026: Sexta-Feira Santa 3/4, Páscoa 5/4, Corpo de Deus 4/6; Carnaval e feriado municipal são facultativos, não nacionais.
   - **Deve ser:** `holidays-pt.ts` parametrizado por ano, país/região/feriado municipal e timezone `Europe/Lisbon`; para direitos RGPD usar dias corridos e não este calendário. Não contar tolerâncias de ponto como feriados legais automaticamente.
   - **Prioridade/tipo:** importante; código + testes + documentação.
   - **Fonte:** [Código do Trabalho, art. 234.º–235.º](https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2009-34546475-46746675); [calendário 2026 do IVV](https://www.ivv.gov.pt/np4/352/%7B%24clientServletPath%7D/?fileName=1._QUAR_2026_IVV.pdf&newsId=1143).

13. **Horário comercial PT não está definido; não inventar um horário legal.**

   - **Arquivos/trechos:** `lib/routing/eligibility.ts:66` aceita timezone, mas não há regra PT de horário comercial nos artefactos auditados.
   - **Estado jurídico:** NÃO CONFIRMADO como regra legal única. Horário de funcionamento depende de atividade/estabelecimento; para SLA do CRM deve ser política contratual configurável, não “lei PT”.
   - **Deve ser:** configurar janelas por organização em `Europe/Lisbon`, feriados e município; documentar que é regra operacional e não prazo RGPD.
   - **Prioridade/tipo:** importante; código + documentação.

14. **Telefone está genericamente em E.164, mas exemplos e onboarding assumem Brasil.**

   - **Arquivos/trechos:** `lib/schemas/contacts.ts:12,38-41` mensagem `+5511999998888`; `components/contacts/NewContactDialog.tsx:90-94`; `app/api/v1/webhooks/in/[token]/route.ts:244` grava `BRL`; regras WAHA não mostram validação PT específica.
   - **Erro jurídico/operacional:** para PT, números nacionais usam indicativo +351 e o Plano Nacional de Numeração é gerido pela ANACOM; ANATEL não é autoridade competente. O regex E.164 permite +351, mas UX/testes e números exemplo induzem BR.
   - **Deve ser:** exemplo/placeholder +351, normalização/libphonenumber por país, validação de WhatsApp e regras de opt-out; documentar ANACOM/Lei das Comunicações Eletrónicas, mantendo E.164 para clientes UE.
   - **Prioridade/tipo:** importante; código + texto.
   - **Fonte:** [ANACOM — Plano Nacional de Numeração](https://anacom.pt/render.jsp?categoryId=423086); [ANACOM — portabilidade/regulamento](https://anacom.pt/render.jsp?contentId=1801193).

15. **Nuvemshop é integração brasileira desligada e não pode continuar como premissa jurídica PT.**

   - **Arquivos/trechos:** `docs/handoffs/HANDOFF-lgpd.md:3-4`; `docs/specs/06-spec-nuvemshop-lgpd.md` §1–§3; `lib/ecommerce/types.ts` enumera `nuvemshop` e moeda BRL; rotas `app/api/v1/webhooks/nuvemshop/*` continuam ativas.
   - **Erro de produto/compliance:** Nuvemshop não é autoridade fiscal nem equivalente jurídico europeu; os webhooks `customer/redact`, `data_request`, `store/redact` são contrato específico do provedor. A integração desligada não deve definir o caminho RGPD base.
   - **Deve ser:** manter adapter apenas como legado opcional, isolado por feature flag; criar contrato de privacidade e dados para providers UE (ou Shopify/VirtueMart/VTEX conforme decisão de produto), sem afirmar equivalência antes de due diligence de subcontratante, localização e transferências.
   - **Prioridade/tipo:** importante; arquitetura + documentação + configuração.
   - **Fonte:** [RGPD, relação responsável/subcontratante e transferências, arts. 28.º e 44.º–49.º](https://eur-lex.europa.eu/eli/reg/2016/679/oj). A escolha do substituto comercial permanece **NÃO CONFIRMADA**.

## Lista pronta para o implementador

1. Remover de runtime/specs todas as decisões `D+7/D+15`, `LGPD Art. 19`, feriados BR e “dias úteis” dos direitos de titular; confirmar um mês corrido RGPD e extensão documentada.
2. Criar máquina de estados de pedido RGPD (recebido, em análise, extensão notificada, respondido, recusado com fundamento), com audit e comunicação ao titular.
3. Implementar registo de violação (72h), avaliação de risco, escalonamento, evidência de notificação CNPD e comunicação do art. 34.º.
4. Modelar base legal/consentimento por finalidade e retirar o consentimento sem apagar a prova histórica necessária.
5. Criar inventário de subcontratantes/transferências, SCC/TIA e gate de provider.
6. Migrar identificadores para `tax_id`/NIF/NIPC/VAT com `tax_country`; preservar BR como legado explicitamente marcado.
7. Trocar defaults para `pt-PT`, `Europe/Lisbon`, `EUR` e exemplos +351; tornar locale/moeda/timezone configuráveis por organização.
8. Substituir calendário BR por calendário PT para SLAs operacionais e testar Sexta-Feira Santa, Páscoa, Corpo de Deus, 25/4, 10/6 e 1/12 de 2026; não usar calendário em prazos RGPD.
9. Adicionar camada de consumidor (DL 24/2014/Dir. 2011/83/UE/Omnibus) apenas se houver venda a consumidores; incluir 14 dias, exceções, reembolso e informação duradoura.
10. Marcar faturação PT/e-Fatura/SAF-T como integração futura, sem chamar fatura PT de NF-e; decidir provider e-commerce UE antes de reativar Nuvemshop.
11. Publicar decisão de EPD/DPO por tenant e os contactos quando aplicável; adicionar ligação ao fluxo CNPD.
12. Reauditar textos em `pt-BR` e termos legais antes de declarar prontidão PT/UE.

## Pesquisa recente e limites de evidência

Foi executado `agent-reach doctor --json` (web/Jina disponível; X/Reddit autenticados não estavam totalmente disponíveis) e `last30days` v3.19.0 para 2026-08-06–2026-09-05. O resultado teve 39 itens em 5 fontes; Reddit ficou parcial por HTTP 429, Instagram falhou 404, X não foi pesquisado e não houve resultado jurídico confiável. Esses sinais não são fonte normativa e não alteram as conclusões acima; serviram apenas para confirmar que não apareceu mudança recente que substituísse os diplomas oficiais. A auditoria jurídica usa fontes primárias abaixo.

## Fontes oficiais consultadas

1. [Regulamento (UE) 2016/679 — RGPD, EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj)
2. [Lei n.º 58/2019, Diário da República](https://files.dre.pt/1s/2019/08/15100/0000300040.pdf)
3. [CNPD — violação de dados](https://www.cnpd.pt/organizacoes/outras-obrigacoes/violacao-de-dados-ou-data-breach/)
4. [CNPD — EPD/DPO](https://www.cnpd.pt/organizacoes/outras-obrigacoes/encarregado-de-protecao-de-dados/)
5. [CNPD — formulário de notificação de EPD](https://www.cnpd.pt/DPO/DPOiniciar.aspx)
6. [DL 24/2014, Diário da República](https://files.dre.pt/gratuitos/1s/2014/02/03200.pdf)
7. [Diretiva 2011/83/UE, EUR-Lex](https://eur-lex.europa.eu/legal-content/PT/TXT/?uri=CELEX:32011L0083)
8. [Diretiva (UE) 2019/2161 — Omnibus, EUR-Lex](https://eur-lex.europa.eu/eli/dir/2019/2161/oj)
9. [AT — NIF](https://info.portaldasfinancas.gov.pt/pt/apoio_ao_contribuinte/Cidadaos/Dados_pessoais_familia/Dados_pessoais/NIF/Paginas/default.aspx)
10. [AT — comunicação de faturas/e-Fatura/SAF-T](https://info.portaldasfinancas.gov.pt/pt/apoio_contribuinte/questoes_frequentes/Pages/faqs-00978.aspx)
11. [AT — manual de integração e-Fatura](https://info.portaldasfinancas.gov.pt/pt/apoio_ao_contribuinte/Outras_entidades/Suporte_tecnologico/Webservice/e_Fatura/Documents/Comunicacao_dos_elementos_dos_documentos_de_faturacao.pdf)
12. [Código do Trabalho PT, art. 234.º–235.º](https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2009-34546475-46746675)
13. [Calendário de 2026 do IVV](https://www.ivv.gov.pt/np4/352/%7B%24clientServletPath%7D/?fileName=1._QUAR_2026_IVV.pdf&newsId=1143)
14. [ANACOM — Plano Nacional de Numeração](https://anacom.pt/render.jsp?categoryId=423086)
15. [ANACOM — Regulamento de portabilidade](https://anacom.pt/render.jsp?contentId=1801193)
16. [EDPB — transferências internacionais](https://www.edpb.europa.eu/sme-data-protection-guide/secure-personal-data_en)

**Conclusão:** a base técnica do RGPD foi parcialmente corrigida, mas a instalação PT/UE não deve ser declarada pronta enquanto os P0 acima não forem executados e verificados.
