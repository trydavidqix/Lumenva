# Stripe Tax — requisitos para Portugal, UE, Brasil e EUA

**Versão:** 0.1 — 12-09-2026  
**Escopo:** checklist documental e de configuração; não altera Stripe nem produção.

## Estado atual

**FACT:** a auditoria disponível não encontrou provider Stripe/checkout no código do MVP; billing aparecia como “Em breve — Fase 2”.  
**NOT_PROVEN:** conta Stripe, localização fiscal, produtos/preços, integrações, webhooks, registos fiscais e pagamentos. Um `stripe listen` ou teste sandbox não foi executado nesta tarefa.

## Pré-requisitos comuns

1. **Dono/contabilista:** confirmar entidade vendedora, país de estabelecimento, morada da sede, moeda, natureza do CRM (SaaS/digital service), clientes B2B/B2C, países-alvo, limiares e obrigações de registo.
2. **Stripe Admin:** definir head office address; criar produtos/preços aprovados; atribuir `tax_code` correto (não escolher código por inferência); ativar Stripe Tax em modo test e live separadamente.
3. **Registos:** registar IVA/GST/sales tax antes de cobrar onde exista obrigação e adicionar cada registo à Stripe Tax. A Stripe confirma que registos locais devem ser identificados e adicionados no Dashboard ou Tax Registrations API ([Stripe — Register](https://docs.stripe.com/tax/registering?locale=en-GB), [Registrations API](https://docs.stripe.com/tax/registrations-api?tax-integration=direct)).
4. **Localização do cliente:** recolher endereço completo, país, estado quando necessário, VAT ID e validar VAT ID B2B; guardar evidência da localização usada no cálculo. A Stripe usa localização do vendedor, cliente, local da atividade, registos, tax code e estatuto fiscal ([Stripe — Calculate tax](https://docs.stripe.com/tax/calculating)).
5. **Integração segura:** Checkout/Payment Links ou API server-side; nunca aceitar preço/imposto enviado pelo browser; `automatic_tax` conforme desenho aprovado; invoices/credit notes e arredondamentos testados.
6. **Fulfilment/entitlement:** webhook assinado, corpo bruto, idempotência por `event.id`, retries, persistência e reconciliação. O pagamento não deve ativar acesso apenas pela página de sucesso; seguir o padrão já documentado em `STRIPE-WEBHOOK-BOAS-PRATICAS.md`.
7. **Operação:** owner de reconciliação, calendário de declarações, exportação de relatórios, gestão de refunds/disputes, logs sem segredos e separação test/live.

## Portugal e UE

- Confirmar número de IVA português, regime aplicável e se o SaaS é B2B, B2C ou ambos.
- Para B2B UE, recolher/validar VAT ID e avaliar reverse charge; emitir fatura com menções legalmente exigidas.
- Para B2C transfronteiriço, contabilista deve decidir balcão OSS e limiares/regras aplicáveis. Stripe calcula com base em registos, localização e produto; os relatórios podem apoiar declarações OSS ([Stripe — EU tax](https://docs.stripe.com/tax/supported-countries/european-union), [Tax reports](https://docs.stripe.com/tax/reports)).
- Confirmar regras de faturação eletrónica, arquivo e idioma/moeda em cada país.

## Brasil

- **[ATENÇÃO]** Stripe Tax não substitui análise brasileira de ISS, PIS/COFINS, retenções, município, importação de serviços, NFS-e e obrigações acessórias. Contabilista brasileiro deve confirmar entidade pagadora, local do tomador, classificação do serviço e necessidade de inscrição.
- Recolher CNPJ/CPF, endereço e dados fiscais apenas quando necessários; definir moeda, conversão e documentação de remessa. Confirmar se existe produto Stripe Tax suportado para o caso concreto antes de prometer cálculo automático.
- Validar tratamento de dados de cobrança sob LGPD e contrato com Stripe.

## Estados Unidos

- Mapear `nexus` por estado (presença, empregados, volume, clientes e regras de marketplace) e registar individualmente onde necessário. Stripe calcula taxas de estados/territórios, mas não decide a obrigação legal ([Stripe — United States](https://docs.stripe.com/tax/supported-countries/united-states?locale=en-GB)).
- Definir taxability do SaaS/digital service por estado, endereço de cobrança e, quando exigido, subdivisão/localidade.
- Monitorar limiares, sales-tax permits, filings, sales-tax holidays, isenções e certificados. Califórnia/CCPA é tema de privacidade, não substituto da análise de sales tax.

## Critérios de aceite antes de cobrar

- [ ] entidade, morada e owner fiscal aprovados;
- [ ] tax codes e preços aprovados por contabilista;
- [ ] registos Stripe Tax ativos e correspondentes aos registos legais;
- [ ] cenários Portugal doméstico, UE B2B/B2C, Brasil e pelo menos estados US-alvo calculam como esperado;
- [ ] VAT ID/isenção/reverse charge e fatura testados;
- [ ] webhook assinado/idempotente persiste evento e entitlement;
- [ ] reconciliação e relatórios exportados em test mode;
- [ ] autorização expressa do dono para ativar live mode.

## Limites

A Stripe é ferramenta de cálculo/infraestrutura, não consultor fiscal. Requisitos e taxas mudam por jurisdição; revisão atual por contabilista/advogado é obrigatória.
