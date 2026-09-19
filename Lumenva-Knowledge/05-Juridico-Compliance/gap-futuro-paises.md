# GAP futuro — expansão para mais países

**Versão:** 0.1 — 12-09-2026  
**Estado:** inventário para backlog jurídico/compliance; não é autorização de expansão.

## Gaps transversais

1. **Entidade e contratos:** matriz por país com entidade vendedora, lei/foro, consumidor vs B2B, idioma, moeda, renovação, cancelamento, garantia, responsabilidade e assinatura eletrónica. Owner: jurídico + financeiro. Evidência: parecer e template aprovado.
2. **Privacidade:** mapa de dados, controlador/operador, DPA, subcontratantes, transferências, representante local, DPO/encarregado, direitos, cookies, retenção e incidentes. Owner: privacy + engenharia. Evidência: RoPA, DPA, lista de subprocessadores e testes de pedidos.
3. **Impostos:** nexus/registos/limiares, VAT/GST/sales tax, retenções, faturação eletrónica, OSS/IOSS quando aplicável, relatórios e filings. Owner: contabilista de cada jurisdição. Evidência: registos e reconciliação Stripe.
4. **Pagamentos:** métodos locais, chargebacks, SCA/3DS, moeda, FX, refunds, sanctions/KYC e regras de marketplace. Owner: financeiro + Stripe. Evidência: matriz de meios e testes sandbox/live autorizados.
5. **Produto/canais:** regras de WhatsApp/Meta/e-mail/voz, consentimento de marketing, gravação, telecomunicações, templates e opt-out. Owner: produto + jurídico. Evidência: testes por canal e documentação de provedor.
6. **Segurança:** residência de dados, criptografia, subcontratantes, resposta a incidente, RTO/RPO, auditorias e requisitos setoriais. Owner: segurança/ops. Evidência: controlos medidos, não apenas política.
7. **IA:** inventário de modelos, finalidade, retenção, treino, decisões automatizadas, transparência, direitos de explicação/oposição e requisitos locais de IA. Owner: AI governance. Evidência: model cards, DPIA/AIA e configuração de opt-out.
8. **Acessibilidade e consumo:** acessibilidade digital, suporte, informação pré-contratual, VAT-inclusive pricing, direito de desistência quando aplicável e reclamações. Owner: jurídico + design. Evidência: revisão local e teste de jornada.

## Regiões a investigar antes de ativar

- **Reino Unido:** UK GDPR, Data Protection Act, transferências e VAT; confirmar representante e ICO.
- **Suíça:** FADP, transferências e IVA suíço.
- **Canadá:** PIPEDA e leis provinciais; GST/HST/QST e residência.
- **Austrália/Nova Zelândia:** Privacy Act/APPs, GST e consumer law.
- **Japão/Singapura:** APPI/PDPA, transferências e GST.
- **Índia:** DPDP Act, regras de localização/transferência e GST.
- **México/Argentina/Chile/Colômbia:** leis locais de dados, IVA e regras de faturação/consumo.
- **Países adicionais da UE:** mapa por país para VAT, consumidor, idioma, acessibilidade e autoridade local; não assumir que OSS resolve obrigações não fiscais.

Cada item é **UNKNOWN** até haver análise por país e aprovação do owner. Não copiar cláusulas de outro país por tradução automática.

## Gate de entrada de um novo país

1. classificar clientes, dados, canais e produto;
2. obter parecer jurídico/fiscal local e decidir entidade/representante;
3. atualizar Termos, Política, DPA, subcontratantes, consentimentos e cookies;
4. configurar Stripe Tax/registos e testar invoice, refund, VAT ID, localização e webhook;
5. executar DPIA/transfer impact assessment quando necessário;
6. confirmar suporte, incidentes, exportação/apagamento e documentação;
7. obter autorização escrita do dono e registar data, SHA/configuração e evidência.

**Regra:** ausência de parecer, registo fiscal, DPA ou teste não é PASS; classificar `NOT_PROVEN` ou `BLOCKED_EXTERNAL`.

## Fontes de referência

- [EUR-Lex — GDPR](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679).
- [ANPD — Direitos dos titulares](https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados-1/direito-dos-titulares).
- [California AG — CCPA](https://oag.ca.gov/privacy/ccpa).
- [Stripe — Registo fiscal](https://docs.stripe.com/tax/registering?locale=en-GB).
