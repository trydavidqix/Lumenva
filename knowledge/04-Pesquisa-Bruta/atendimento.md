# Pesquisa de fundamentos - grupo ATENDIMENTO

**Escopo:** Vendas, suporte, agendamento, cobrança e escalação.
**Data da pesquisa:** 2026-09-12. **Janela social:** 2026-08-13 a 2026-09-12.

## Limites e classificação da evidência

- **FACT:** prática explicitamente descrita na fonte citada.
- **INFERENCE:** implicação operacional para um agente, derivada de um ou mais FACT.
- **ASSUMPTION:** adaptação proposta para a Lumenva, ainda não validada no negócio.
- **UNKNOWN / NOT_PROVEN:** não há prova suficiente nesta pesquisa.
- A pesquisa `last30days` retornou 43 itens em oito fontes. Reddit teve um único tópico; Instagram ficou parcial por erro HTTP 404; Web/grounding ficou indisponível; X/Twitter não foi coberto. Portanto, tendências sociais abaixo são sinais, não estatística representativa.

## 1. Vendas

### Práticas e frameworks

- **FACT - MEDDIC/MEDDPICC:** a estrutura cobre Metrics, Economic Buyer, Decision Criteria, Decision Process, Identify Pain, Champion; MEDDPICC acrescenta Paper Process e Competition. O objetivo é qualificar a realidade do negócio, mapear quem decide e descobrir o que acontece entre o “sim” e a assinatura. Fontes: [Salesforce - MEDDIC](https://www.salesforce.com/blog/sales/meddic-sales/), [MEDDICC - metodologia](https://meddicc.com/meddpicc-sales-methodology-and-process), [HubSpot - MEDDPICC](https://blog.hubspot.com/sales/meddpicc-methodology).
- **FACT - SPICED:** Situation, Pain, Impact, Critical Event e Decision dão uma entrada consultiva, começando pelo contexto e impacto do cliente. A comparação recente da MEDDICC observa que SPICED não explicita Champion, Competition nem Paper Process com a mesma profundidade. Fonte: [MEDDICC - SPICED vs MEDDPICC](https://meddicc.com/resources/spiced-sales-methodology-vs-meddpicc-meddicc).
- **INFERENCE:** o agente deve escolher a profundidade pela complexidade do negócio: filtro leve para inbound de alto volume; MEDDIC para oportunidade real; MEDDPICC quando há comitê, jurídico, segurança, procurement ou ciclo longo. Não deve preencher letras por aparência: cada campo precisa de evidência na conversa, CRM ou documento.
- **FACT:** Salesforce recomenda identificar o comprador econômico, critérios de decisão, processo e dor; uma relação com apenas um contacto pode falhar se ele não tiver autoridade financeira. Fonte: [Salesforce - MEDDIC](https://www.salesforce.com/blog/sales/meddic-sales/).
- **INFERENCE:** descoberta deve produzir artefactos verificáveis: problema em palavras do cliente, impacto quantificado, decisor nomeado, critérios, concorrentes/status quo, próximos passos e data acordada.

### Erros comuns documentados

- Confundir interesse ou “gostei da demo” com dor financiável, autoridade e processo de decisão (**FACT**, Salesforce/HubSpot).
- Ignorar o Paper Process: segurança, jurídico, procurement e onboarding podem atrasar ou matar uma venda depois do “sim” (**FACT**, HubSpot/MEDDPICC).
- Tratar “não temos concorrente” como ausência de competição; fazer nada ou manter o fornecedor atual também compete (**FACT**, MEDDICC).
- Adotar uma metodologia sem adaptá-la ao ciclo e depois transformá-la em campos administrativos sem uso em coaching (**FACT**, [Closing Foundry](https://www.closingfoundry.com/insights/meddic-vs-meddpicc)).
- **INFERENCE:** um agente que inventa budget, champion ou prazo para avançar o estágio criará forecast falso e dívida de confiança.

### Traços comportamentais e emocionais

- Curiosidade disciplinada: perguntar “como sabe?” e “quem confirma?” sem interrogatório hostil (**INFERENCE**).
- Escuta ativa e tolerância à ambiguidade; resumir a dor antes de apresentar solução (**INFERENCE**, alinhado ao SPICED).
- Assertividade sem pressão: desqualificar cedo quando não há fit é melhor que perseguir esperança (**INFERENCE**).
- Humildade epistémica: separar facto dito, hipótese e lacuna; pedir autorização para envolver o decisor (**ASSUMPTION** para o agente).

## 2. Suporte

### Práticas e frameworks

- **FACT - ITIL Service Operation:** resolver no primeiro contacto quando possível; se o service desk não resolve ou excede o tempo-alvo, escalar imediatamente por função ou hierarquia. A propriedade do incidente permanece no service desk, que acompanha, informa o utilizador e fecha o caso. Fonte: [ITIL Service Operation guide](https://dokumen.pub/download/key-element-guide-itil-service-operation-2nbsped-0113313632-9780113313631.html).
- **FACT - COPC CX Standard:** gere pessoas, tecnologia, canais humanos, bots e self-service sob uma disciplina de jornada ponta a ponta, métricas, qualidade, eficiência, governança de IA e ação corretiva. Fonte: [COPC CX Standard](https://www.copc.com/copc-standards/cx-standard/).
- **INFERENCE:** o agente deve manter um caso único com identificação, contexto, consentimento, diagnóstico, ações, SLA, dono e estado; nunca obrigar o cliente a repetir a história numa transferência.
- **FACT:** a pesquisa recente mostra procura por suporte omnicanal (telefone, email e chat) e por ferramentas como Shopify, Zendesk e Gorgias; uma vaga mencionou capacidade de 200 tickets/dia, mas isso é anúncio, não benchmark de qualidade. Fonte: Threads, [post de janmikhaela](https://www.threads.com/@janmikhaela/post/DdJ1XEXE-5l), [post de rehjpamular](https://www.threads.com/@rehjpamular/post/DdLeWRxjS1f).

### Erros comuns documentados

- Bots e gravações que bloqueiam o acesso a uma pessoa quando o caso não cabe no fluxo. Utilizadores relataram “virtual assistants ... of no help” e problemas de reserva que não podiam ser resolvidos no app, online ou pelo bot (**FACT**, Threads: [FedEx](https://www.threads.com/@daniyellidaniyelli/post/DdKKj9uiYGq), [Hertz](https://www.threads.com/@poole.laura/post/DdKjB3ljqkh)).
- Transferência fria sem resumo, dono ou prazo; o cliente reinicia o caso (**INFERENCE**, ITIL exige ownership contínuo).
- Otimizar volume/AHT e sacrificar resolução, satisfação ou qualidade (**INFERENCE**, COPC exige olhar jornada e resultados, não uma métrica isolada).
- Responder com política genérica sem reconhecer impacto emocional (**INFERENCE**).

### Traços comportamentais e emocionais

- Empatia operacional: reconhecer frustração e explicar o próximo passo concreto (**INFERENCE**).
- Calma sob agressividade; não retaliar nem prometer o que o sistema não pode cumprir (**ASSUMPTION**).
- Senso de propriedade: quem recebe o caso continua responsável até handoff confirmado e encerramento (**FACT/INFERENCE**, ITIL).
- Transparência: dizer “ainda não sei; vou verificar até X” e cumprir o horário (**INFERENCE**).

## 3. Agendamento

### Práticas e frameworks

- **FACT:** Google Calendar permite disponibilidade, fuso horário, janela mínima/máxima de antecedência, buffer, limite diário, verificação de conflitos, formulário e até cinco lembretes. Fonte: [Google Calendar - appointment schedules](https://support.google.com/calendar/answer/10729749).
- **FACT:** Calendly recomenda automações acionadas por booking, proximidade, cancelamento, reagendamento e no-show; inclui reconfirmação, lembretes, follow-up e link de reagendamento. Fonte: [Calendly Workflows](https://calendly.com/help/automations-overview).
- **FACT:** guia da Calendly recomenda combinar email 24 horas antes e SMS 30 minutos antes, facilitar cancelar/reagendar, enviar agenda/pré-leitura e automatizar recuperação de no-show. Fonte: [Calendly - reminders](https://calendly.com/blog/guide-calendly-reminders).
- **INFERENCE:** o agente deve validar fuso, duração, elegibilidade, buffers, conflito e consentimento de contacto antes de confirmar; confirmação deve conter objetivo, localização, duração, política de cancelamento e caminho de remarcação.

### Erros comuns documentados

- Confirmar horário sem fuso ou sem verificar o calendário de todos os participantes (**FACT**, Google Calendar descreve verificações de disponibilidade; **INFERENCE**).
- Enviar lembrete sem opção de cancelar/reagendar, convertendo conflito previsível em no-show (**FACT**, Calendly).
- Não distinguir reunião marcada, confirmada, reagendada, cancelada e no-show no CRM (**INFERENCE**).
- Overbooking por falta de buffer ou limite diário (**FACT**, Google Calendar).

### Traços comportamentais e emocionais

- Precisão e antecipação: prevenir conflito vale mais que corrigir depois (**INFERENCE**).
- Tom acolhedor e baixa fricção; pedir apenas os dados necessários (**ASSUMPTION**).
- Flexibilidade sem perder regras: oferecer alternativas válidas, não horários impossíveis (**INFERENCE**).

## 4. Cobrança

### Práticas e frameworks

- **FACT:** Stripe Smart Retries usa sinais dinâmicos para escolher tentativas; a recomendação padrão documentada é oito tentativas em duas semanas, configuráveis por segmento. Falhas geram eventos `invoice.payment_failed`, e hard declines exigem novo método de pagamento. Fonte: [Stripe - Smart Retries](https://docs.stripe.com/billing/revenue-recovery/smart-retries.md).
- **FACT:** Stripe Billing Automations dispara comunicações quando a fatura está prestes a vencer, vencida ou a subscrição é cancelada, podendo notificar equipa de cobranças e segmentar por condição. Fonte: [Stripe - Billing automations](https://docs.stripe.com/billing/automations).
- **FACT:** uma comunicação de dunning deve declarar fatura, valor, vencimento, consequência, CTA de pagamento e alternativas; linguagem factual e não acusatória, com escalada definida para inadimplência persistente. Fonte: [Stripe - dunning emails](https://stripe.com/resources/more/dunning-emails-101-what-theyre-for-and-how-to-write-them).
- **INFERENCE:** o agente deve separar falha técnica, atraso voluntário, disputa, fraude e hardship; cada causa exige mensagem e autoridade diferentes. Nunca expor dados completos de cartão ou decidir exceção financeira sem autorização.

### Erros comuns documentados

- Repetir cobranças cegamente em hard decline, sem pedir novo método (**FACT**, Stripe).
- Mensagem vaga ou acusatória, sem valor, data e ação possível (**FACT**, Stripe dunning).
- Suspender serviço sem aviso, estado auditável e regra aprovada (**INFERENCE**).
- Não notificar finanças sobre contas de alto valor nem medir resolução por segmento (**FACT**, Stripe Automations; **INFERENCE**).

### Traços comportamentais e emocionais

- Firmeza respeitosa: cobrar o compromisso sem envergonhar o cliente (**INFERENCE**).
- Confidencialidade e autocontrolo; não revelar saldo em canal errado (**ASSUMPTION**).
- Justiça consistente: aplicar política igual, mas encaminhar hardship/disputa para revisão humana (**INFERENCE**).

## 5. Escalação

### Práticas e frameworks

- **FACT - ITIL:** escalação funcional envia ao grupo com maior competência; hierárquica envolve gestão. O service desk mantém ownership, informação ao utilizador e encerramento ([ITIL guide](https://dokumen.pub/download/key-element-guide-itil-service-operation-2nbsped-0113313632-9780113313631.html)).
- **FACT - Cisco:** um Resolution Leader mobiliza recursos, define donos e prazos, coordena comunicação, acompanha risco e conduz análise de causa raiz após a resolução. Escalação é mecanismo de foco, não transferência de culpa. Fonte: [Cisco - escalation management](https://www.cisco.com/c/dam/en/us/support/web/communications/cisco-escalation-best-practices.pdf).
- **FACT:** uma matriz útil explicita categorias, contactos por nível, prioridade, SLA e exceções; pode combinar escalação funcional, hierárquica, automática e por prioridade. Fonte: [SupportLogic - escalation matrix](https://www.supportlogic.com/resources/blog/the-escalation-matrix-best-practices-and-going-beyond/).
- **INFERENCE:** cada escalação precisa de gatilho, severidade, impacto, owner atual, owner seguinte, prazo de atualização, plano de comunicação e critério de encerramento.

### Erros comuns documentados

- “Passar” o ticket e abandonar ownership (**FACT**, ITIL/Cisco).
- Escalar tarde apesar de SLA vencido ou impacto crescente (**FACT**, ITIL; **INFERENCE**).
- Fazer reunião sem agenda, donos, prazos e notas; Cisco identifica isso como falha operacional (**FACT**, Cisco).
- Escalar por status social em vez de impacto, risco, urgência e autoridade necessária (**INFERENCE**).
- A pesquisa social mostra a tensão: num vídeo de BPO, comentários relatam que chamadas para supervisor podem ser evitadas e que o agente é culpado quando o cliente escala (**FACT**, TikTok: [uncxanuck](https://www.tiktok.com/@uncxanuck/video/7682733012378963220)).

### Traços comportamentais e emocionais

- Urgência proporcional, sem pânico (**INFERENCE**).
- Coordenação cross-functional e capacidade de dizer factos incompletos com clareza (**FACT**, Cisco).
- Empatia com o cliente e firmeza com os donos internos (**FACT**, Cisco).
- Aprendizagem pós-incidente: procurar padrão e causa raiz, não culpado (**FACT**, Cisco).

## Erros sistémicos que atravessam todo o grupo

- **NOT_PROVEN:** não há nesta pesquisa prova de que qualquer agente Lumenva consiga aceder em produção a CRM, agenda, gateway de pagamento, identidade, RLS, SLA ou canais externos.
- Misturar dados de vendas, suporte e cobrança sem autorização, finalidade e trilha de auditoria (**INFERENCE**, risco operacional e de privacidade).
- Automatizar decisões irreversíveis - cancelamento, reembolso, suspensão, envio de cobrança ou escalada executiva - sem limiar e aprovação humana (**ASSUMPTION/RECOMENDAÇÃO**).
- Medir apenas velocidade, volume ou receita e ignorar resolução, satisfação, retenção, reincidência e justiça (**INFERENCE**, COPC).
- Não oferecer handoff humano quando automação falha (**FACT**, queixas Threads; **INFERENCE**).

## Síntese: o que um agente ATENDIMENTO deve saber para não “nascer cru”

1. **Estado antes de ação:** identificar cliente, intenção, autorização, urgência, impacto, canal, fuso e último evento; declarar lacunas em vez de completar por suposição.
2. **Uma linha de ownership:** criar ou localizar um caso único; registrar resumo, evidência, promessa, SLA, próximo passo e dono. Em qualquer transferência, fazer handoff quente e manter acompanhamento.
3. **Vendas baseadas em prova:** qualificar dor, impacto, decisor, critérios, processo, concorrência/status quo e Paper Process; nunca avançar estágio só porque há entusiasmo.
4. **Suporte humano quando necessário:** resolver no primeiro contacto quando seguro; escalar por competência ou hierarquia antes de o SLA/impacto piorar; informar o cliente em cadência combinada.
5. **Agendamento sem surpresas:** verificar disponibilidade e fuso, aplicar buffer, confirmar detalhes, reconfirmar, facilitar remarcação e distinguir cancelamento de no-show.
6. **Cobrança factual e segura:** explicar valor/data/consequência/CTA, usar retries e automações idempotentes, tratar hard decline/disputa separadamente e escalar exceções financeiras para humano.
7. **Escalação como comando de incidente:** gatilhos e prioridades pré-definidos, Resolution Leader, donos e prazos explícitos, comunicação frequente e post-mortem com causa raiz.
8. **PsycheOS - perfil comportamental desejado:** curioso, empático, calmo, firme, transparente, humilde sobre incerteza, orientado a follow-through e capaz de aprender sem culpar.
9. **Guardrails:** sem prometer preço, reembolso, crédito, disponibilidade, resolução técnica ou prazo não confirmado; sem expor segredos; sem enviar ou cancelar nada externo sem autorização explícita.

## Sinais recentes da comunidade - uso cauteloso

O recorte de 30 dias mostra procura por profissionais que lidem com telefone, email e chat e volume alto, mas também forte rejeição a bots que impedem contacto humano. Um comentário de u/Shlok-D-91 no Reddit relatou cobrança indevida de 13 mil apesar de reparação gratuita da Samsung; outro, u/unpredictable_ace, resumiu que destruir o próprio telefone não é solução. São vozes individuais, não métricas de prevalência, mas reforçam dois requisitos: explicar cobrança com evidência e desescalar emoção sem validar comportamento destrutivo. Fonte: [tópico em r/IndiaTech](https://www.reddit.com/r/IndiaTech/comments/1vwfm0l/customer_destroys_phone_inside_service_center/).

## Fontes consultadas

- [COPC CX Standard](https://www.copc.com/copc-standards/cx-standard/)
- [Cisco Escalation Management Best Practices](https://www.cisco.com/c/dam/en/us/support/web/communications/cisco-escalation-best-practices.pdf)
- [ITIL Service Operation guide](https://dokumen.pub/download/key-element-guide-itil-service-operation-2nbsped-0113313632-9780113313631.html)
- [Salesforce MEDDIC](https://www.salesforce.com/blog/sales/meddic-sales/)
- [HubSpot MEDDPICC](https://blog.hubspot.com/sales/meddpicc-methodology)
- [Google Calendar appointment schedules](https://support.google.com/calendar/answer/10729749)
- [Calendly Workflows](https://calendly.com/help/automations-overview)
- [Stripe Smart Retries](https://docs.stripe.com/billing/revenue-recovery/smart-retries.md)
- [Stripe Billing automations](https://docs.stripe.com/billing/automations)
- [Stripe dunning emails](https://stripe.com/resources/more/dunning-emails-101-what-theyre-for-and-how-to-write-them)
- [Last30Days raw research](https://www.reddit.com/r/IndiaTech/comments/1vwfm0l/customer_destroys_phone_inside_service_center/) - recorte de comunidade; resultados brutos locais em `/private/tmp/last30days-atendimento/`.
