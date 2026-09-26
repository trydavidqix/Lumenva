# Política de Privacidade — Lumenva CRM (rascunho)

**Versão:** 0.1 — 12-09-2026  
**Estado:** RASCUNHO. Publicação depende de revisão jurídica e confirmação técnica do inventário.

## 1. Responsável e contacto

Responsável pelo tratamento: **[ATENÇÃO: inserir razão social, endereço, NIF e contacto de privacidade/DPO]**. Para pedidos: **[ATENÇÃO: inserir e-mail e formulário]**. Se aplicável, inserir representante UE, encarregado LGPD e agente para pedidos CCPA.

## 2. Dados tratados

Podemos tratar: dados de conta e organização (nome, e-mail, cargo, empresa, identificadores); dados de faturação e fiscais; leads e contactos (nome, telefone, e-mail, empresa, notas); conteúdo de mensagens/conversas e anexos; dados de integrações WhatsApp/WAHA, Meta, e-mail, voz e calendários; dados técnicos (IP, dispositivo, logs, auditoria, segurança); pedidos de suporte; prompts/saídas/metadados de IA quando ativados.

**FACT:** a documentação auditada descreve leads, contactos, conversas, inbox, mensagens, webhooks e isolamento por `organization_id`.  
**UNKNOWN:** categorias exatas em produção, cookies/analytics, dados especiais, gravações de voz, retenção por tabela e lista final de subcontratantes. Confirmar antes de publicar.

## 3. Finalidades e bases legais (UE)

| Finalidade | Base provável — confirmar | Dados |
|---|---|---|
| Criar conta, autenticar, prestar CRM e suporte | contrato; obrigação legal quando aplicável | conta, organização, uso |
| Faturar, prevenir fraude e cumprir contabilidade | contrato/obrigação legal/interesse legítimo | faturação, pagamento, logs |
| Segurança, auditoria, diagnóstico | interesse legítimo/obrigação legal | IP, eventos, auditoria |
| Mensagens e integrações a pedido do Cliente | contrato/instrução do controlador; consentimento quando exigido pelo canal | contactos, conteúdo, tokens |
| Marketing próprio | consentimento ou interesse legítimo conforme lei e oposição | contacto, preferências |
| IA e melhoria do Serviço | contrato/interesse legítimo ou consentimento conforme contexto | prompts, saídas, telemetria |

**[ATENÇÃO]** O responsável deve documentar teste de interesse legítimo, consentimento, minimização, decisões automatizadas e eventual tratamento de dados sensíveis. Não usar dados de contactos para marketing da Lumenva sem base legal e opt-out.

## 4. Papéis e partilha

Para dados que o Cliente coloca no CRM sobre os seus contactos, a Lumenva normalmente atuará como operador/processador sob instruções do Cliente; para conta, faturação, segurança e marketing próprio, pode atuar como controlador. Esta é uma **ASSUMPTION** dependente do fluxo e contrato. Subcontratantes podem incluir alojamento/base de dados, autenticação, e-mail, pagamentos/Stripe, WhatsApp/WAHA, Meta, fornecedores de IA, observabilidade e suporte — **UNKNOWN até inventário assinado**. Publicar lista, localização e finalidade de cada um.

## 5. Transferências internacionais

Provedores podem processar dados fora do Espaço Económico Europeu ou Brasil. **[ATENÇÃO]** Mapear países e mecanismo aplicável (decisão de adequação, cláusulas contratuais-tipo, transferência LGPD e avaliação suplementar). Não afirmar que existe transferência legalmente validada sem DPA e evidência do provedor.

## 6. Retenção e eliminação

Conservar dados apenas pelo período necessário às finalidades, contrato, segurança e obrigações legais. **UNKNOWN:** prazos por categoria, backups, logs, mensagens e exportação. O Cliente poderá solicitar exportação/eliminação conforme DPA; pedidos podem ser limitados por obrigação legal, defesa de direitos ou anonimização.

## 7. Direitos

Na UE, titulares podem exercer acesso, retificação, apagamento, limitação, oposição, portabilidade e retirar consentimento, além de não ficar sujeitos a decisões exclusivamente automatizadas quando aplicável. No Brasil, a ANPD descreve confirmação, acesso, correção, anonimização/bloqueio/eliminação e portabilidade ([ANPD](https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados-1/direito-dos-titulares)). Na Califórnia, direitos incluem saber, apagar, corrigir, limitar informação sensível, opt-out de venda/partilha e não discriminação ([California AG](https://oag.ca.gov/privacy/ccpa)). Responderemos pelo canal acima, verificando identidade e coordenando com o Cliente quando este for controlador.

## 8. Cookies e comunicações

**UNKNOWN:** cookies, SDKs e analytics usados. Antes de ativar não essenciais, publicar inventário, finalidades, duração, terceiros e mecanismo de consentimento/recusa conforme ePrivacy e lei local. Comunicações de marketing devem incluir opt-out e respeitar preferências.

## 9. Segurança e incidentes

Aplicar controlo de acesso, isolamento por organização, encriptação em trânsito, gestão de segredos, logs e backups proporcionais ao risco. **[ATENÇÃO]** Confirmar medidas realmente implementadas, responsáveis, RTO/RPO e prazos de notificação à autoridade/titulares. Não prometer certificação ou segurança absoluta.

## 10. Menores e dados sensíveis

O Serviço é B2B e não dirigido a menores. O Cliente não deve inserir dados sensíveis ou de menores salvo instrução documentada, necessidade, base legal e salvaguardas. **[ATENÇÃO]** Validar se o CRM processará saúde, biometria, religião, condenações ou gravações de voz.

## 11. Alterações e reclamações

Atualizaremos a data e comunicaremos alterações materiais. Titulares na UE podem reclamar à autoridade de proteção de dados competente; no Brasil, à ANPD; na Califórnia, ao California Privacy Protection Agency/Attorney General, conforme aplicável.

## Fontes

- [EUR-Lex — Regulamento (UE) 2016/679](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679).
- [ANPD — Direitos dos Titulares](https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados-1/direito-dos-titulares).
- [Planalto — LGPD compilada](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm).
- [California Attorney General — CCPA](https://oag.ca.gov/privacy/ccpa).

Não é aconselhamento jurídico. Campos `[ATENÇÃO]` e `UNKNOWN` são bloqueadores de publicação.
