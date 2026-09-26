# Pesquisa de fundamentos - OPERACOES

Escopo: agentes Manager/Gestor, Notification Router e Ops Watcher para um grupo IA-first da Lumenva Business OS. Esta pesquisa informa a fábrica de agentes (Wave 2); não é especificação de implementação.

## Como a evidência foi recolhida

- **FACT:** Foram consultadas fontes primárias de SRE/incident management da Google e documentação AWS sobre retries e dead-letter queues.
- **FACT:** Foi usado `agent-reach doctor --json`; YouTube, V2EX, RSS e Jina Reader estavam disponíveis; Reddit/X/Exa tinham cobertura parcial ou sem backend ativo. O `last30days` foi executado para o tema operacional, mas sem backend de pesquisa web/plan explícito; os resultados não produziram um conjunto recente suficientemente confiável. Portanto, qualquer conclusão de “tendência dos últimos 30 dias” abaixo é **NOT_PROVEN**.
- **FACT:** A busca recente encontrou discussões de alert fatigue/on-call em Reddit e artigos de 2026; são sinais de comunidade, não validação causal. Exemplos: [r/Observability - quatro abordagens para alert fatigue](https://www.reddit.com/r/Observability/comments/1smhs04/we_tested_4_different_approaches_to_fix_our_alert/), [r/sre - práticas aprendidas em cinco anos de on-call](https://www.reddit.com/r/sre/comments/1suggw7/what_5_years_of_oncall_taught_me_about_the/), [r/ITIL - validação after-hours e Sev 2](https://www.reddit.com/r/ITIL/comments/1u6ofen/how_do_you_handle_afterhours_incident/).
- **COMMUNITY SIGNAL (últimos 30 dias, não validado):** Resultados recentes repetem três queixas: correlação insuficiente entre alertas, supressão sem contexto e perda de confiança no pager. Ver [Alert Fatigue Is Breaking NOC Workflows (2026)](https://serviceradar.cloud/articles/alert-fatigue-noc-workflows-2026) e [Reducing alert fatigue for on-call and SOC teams](https://painhunt.dev/blog/idea-alert-fatigue-correlation-oncall-soc). As métricas desses artigos não foram tratadas como FACT porque não são fontes primárias independentes.

## 1. Manager/Gestor de operações

### Práticas e frameworks

- **FACT - Incident Command System / IMAG:** A Google estrutura incidentes em três funções separadas: Incident Commander (coordena e decide), Communications Lead (atualiza interessados) e Operations Lead (mitiga). As funções são atribuídas conforme conhecimento e contexto do incidente, não pela hierarquia normal; a separação reduz conflito de prioridades e permite delegação explícita. Fonte: [Google SRE Incident Management Guide](https://sre.google/resources/practices-and-processes/incident-management-guide/).
- **FACT - três Cs:** Coordenação, comunicação e controle são o núcleo do modelo de resposta da Google. O gestor deve manter estado global, priorizar impacto no utilizador, remover bloqueios e impedir que investigação de causa raiz atrase mitigação. Fonte: [Google SRE - Managing Incidents](https://sre.google/sre-book/managing-incidents/).
- **FACT - preparação como trabalho operacional:** Antes do incidente são necessários on-call definido, playbooks atualizados, treino e exercícios como “Wheel of Misfortune”. A automação deve libertar humanos para decisões e resolução, não esconder o estado do incidente. Fonte: [Google SRE Incident Management Guide](https://sre.google/resources/practices-and-processes/incident-management-guide/).
- **FACT - handoff verificável:** O handoff de comando deve nomear explicitamente o novo comandante, obter confirmação firme e comunicar a mudança ao restante grupo. Fonte: [Google SRE - Managing Incidents](https://sre.google/sre-book/managing-incidents/).
- **INFERENCE - RACI/OODA como camada de gestão:** RACI (Responsible, Accountable, Consulted, Informed) ajuda a pré-definir donos e escaladas; OODA (Observe, Orient, Decide, Act) é uma forma útil de evitar paralisia. São complementos de design, não evidência de que um agente deva decidir sem autorização.

### Erros comuns documentados

- **FACT:** Não separar comando, comunicação e execução faz com que a mesma pessoa tente coordenar, investigar e operar; isso aumenta carga cognitiva e atrasa mitigação. Fonte: [Google SRE Incident Management Guide](https://sre.google/resources/practices-and-processes/incident-management-guide/).
- **FACT:** Deixar o incidente sem documento vivo, sem papéis claros ou sem plano de handoff perde estado e duplica trabalho. Fonte: [Google SRE - Managing Incidents](https://sre.google/sre-book/managing-incidents/).
- **FACT:** Comunicar apenas depois de resolver tecnicamente falha o objetivo operacional: utilizadores e stakeholders precisam saber impacto, workaround, mitigação e ETA durante o evento. Fonte: [Google SRE Incident Management Guide](https://sre.google/resources/practices-and-processes/incident-management-guide/).
- **INFERENCE:** Um Manager IA que otimiza “resolver rápido” sem registar decisão, autoridade, confiança e impacto cria risco de ação irreversível e não auditável.

### Traços comportamentais e emocionais

- **FACT:** O modelo blameless da Google trata participantes como pessoas de boa-fé e procura melhorar sistemas, procedimentos e treino, não punir indivíduos. Fonte: [Google SRE Postmortem Culture](https://sre.google/sre-book/postmortem-culture/).
- **INFERENCE:** Traços desejáveis: calma sob pressão, comunicação curta e frequente, humildade epistémica (“sei / não sei / preciso confirmar”), firmeza para atribuir dono, empatia com utilizadores e operadores cansados, e capacidade de dizer “não executar ainda”.
- **INFERENCE:** O agente deve detectar sinais de sobrecarga (tarefas sem dono, atualizações atrasadas, escaladas repetidas), reduzir trabalho paralelo e pedir reforço; não deve interpretar silêncio como consentimento.

## 2. Notification Router

### Práticas e frameworks

- **FACT - alertas por sintomas e ação:** A Google recomenda alertar sobre sintomas end-to-end e impacto no utilizador, não sobre causas internas frágeis; cada alerta humano deve ser acionável. Fonte: [Google SRE Incident Management Guide](https://sre.google/resources/practices-and-processes/incident-management-guide/).
- **FACT - pages são recurso caro:** Paging interrompe trabalho, descanso e sono; volume alto faz pessoas ignorarem ou filtrarem alertas, inclusive os reais. Fonte: [Google SRE - Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/).
- **FACT - retries com backoff e jitter:** Amazon SNS define fases de retry e aplica jitter; políticas devem respeitar capacidade do endpoint. Quando esgotadas, a mensagem é descartada salvo se houver DLQ. Fonte: [AWS SNS message delivery retries](https://docs.aws.amazon.com/sns/latest/dg/sns-message-delivery-retries.html).
- **FACT - DLQ e redrive:** Amazon SQS usa dead-letter queues para isolar mensagens que falharam, investigar exceções e fazer redrive controlado. O `maxReceiveCount` deve permitir retries suficientes; retenção da DLQ deve ser maior que a da fila de origem. Fonte: [AWS SQS dead-letter queues](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html).
- **INFERENCE - contrato mínimo de roteamento:** Cada evento precisa de identidade estável, severidade, destino/owner, política de retry, TTL, deduplicação/idempotência, trilho de auditoria e estado terminal (`delivered`, `acknowledged`, `failed`, `dead-lettered`, `suppressed`).

### Erros comuns documentados

- **FACT:** Causa-based alerts frágeis e não acionáveis geram ruído; a orientação da Google é manter o caminho até o pager simples, robusto e compreensível. Fonte: [Google SRE - Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/).
- **FACT:** Retry sem limite e sem backoff pode amplificar uma falha; retry mal configurado pode descartar mensagens após esgotar a política. Fonte: [AWS SNS message delivery retries](https://docs.aws.amazon.com/sns/latest/dg/sns-message-delivery-retries.html).
- **FACT:** DLQ configurada sem monitorização, investigação e redrive deixa eventos presos e cria falsa sensação de entrega. Fonte: [AWS SQS dead-letter queues](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html).
- **INFERENCE:** Routing baseado apenas em canal (“manda tudo para Slack/email”) ignora horário, severidade, capacidade e contexto do destinatário; isso degrada confiança e aumenta alert fatigue.
- **FACT/COMMUNITY SIGNAL:** Em discussões recentes de on-call, aparece repetidamente que deduplicar sem contexto não resolve a triagem e que alertas devem indicar a ação esperada; ver [r/Observability](https://www.reddit.com/r/Observability/comments/1smhs04/we_tested_4_different_approaches_to_fix_our_alert/) e [r/sre](https://www.reddit.com/r/sre/comments/1suggw7/what_5_years_of_oncall_taught_me_about_the/). A generalização para Lumenva é **INFERENCE**, não FACT sobre todas as equipas.

### Traços comportamentais e emocionais

- **INFERENCE:** O router precisa de disciplina e conservadorismo: não inventar destinatários, não elevar severidade por ansiedade, não suprimir por conveniência e expor incerteza quando owner ou canal não estão confirmados.
- **INFERENCE:** Deve ser sensível à carga humana: agrupar eventos correlatos, respeitar quiet hours apenas dentro de política, escalar quando não há acknowledgement e evitar repetir a mesma mensagem sem informação nova.
- **INFERENCE:** Transparência é traço central: cada decisão de roteamento deve ser explicável (“por que este destino, esta severidade, este retry?”), reversível quando possível e segura contra loops.

## 3. Ops Watcher

### Práticas e frameworks

- **FACT - monitorização em quatro sinais:** A Google recomenda dashboards que respondam a perguntas básicas e incluam sinais como latência, tráfego, erros e saturação; alertar um humano só quando há problema real ou risco iminente. Fonte: [Google SRE - Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/).
- **FACT - black-box para paging, white-box para diagnóstico:** Monitorização externa representa sintoma do utilizador e é apropriada para paging; telemetria interna é essencial para investigação, mas não deve automaticamente acordar pessoas. Fonte: [Google SRE - Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/).
- **FACT - ciclo detectar, responder, remediar, aprender:** A Google liga incident response a postmortems blameless e itens de ação com prazo/SLO no backlog. Fonte: [Google SRE Incident Management Guide](https://sre.google/resources/practices-and-processes/incident-management-guide/).
- **INFERENCE - loop de watcher:** observar sinais, correlacionar, classificar severidade, encaminhar para owner, verificar acknowledgement/mitigação, fechar ou escalar, e alimentar revisão de alertas.

### Erros comuns documentados

- **FACT:** “Stare at a screen” não é estratégia; sistemas complexos exigem sinal de alta qualidade e baixo ruído, e páginas frequentes levam a skim/ignorância. Fonte: [Google SRE - Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/).
- **FACT:** Alertar por qualquer anomalia vaga, em vez de impacto claro, cria falsos positivos e prolonga outages. Fonte: [Google SRE - Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/).
- **FACT/COMMUNITY SIGNAL:** Discussões de 2026 associam volume de alertas, ausência de correlação e fadiga a perda de confiança no pager; ver [r/Observability](https://www.reddit.com/r/Observability/comments/1smhs04/we_tested_4_different_approaches_to_fix_our_alert/) e [r/ITIL](https://www.reddit.com/r/ITIL/comments/1u6ofen/how_do_you_handle_afterhours_incident/). Estes relatos são sinais, não medição independente da Lumenva.
- **INFERENCE:** Suprimir alertas sem janela, causa, owner e condição de reativação é perigoso: pode esconder o incidente real. Toda supressão deve ser temporária, auditada e testada.

### Traços comportamentais e emocionais

- **INFERENCE:** Watcher eficaz é atento sem ser alarmista, tolera ambiguidade, procura confirmação antes de escalar e mantém persistência sem martelar o operador.
- **INFERENCE:** Deve reconhecer que fadiga e sono alteram resposta humana; variar canal/escala conforme severidade e fornecer contexto reduz carga cognitiva.
- **INFERENCE:** Deve ser “blameless por padrão”, mas não passivo: regista falhas de processo, pede correção e fecha o loop com métricas de qualidade (ação, acknowledgement, tempo, falsos positivos).

## Erros de desenho comuns ao combinar os três agentes

- **FACT:** Confundir notificação com incidente: uma page só é sinal; o Manager precisa declarar/organizar incidente quando o impacto exige coordenação. Fonte: [Google SRE Incident Management Guide](https://sre.google/resources/practices-and-processes/incident-management-guide/).
- **INFERENCE:** Criar autonomia sem matriz de autoridade. O agente deve distinguir recomendar, preparar, executar sob aprovação e executar automaticamente dentro de limites pré-autorizados.
- **INFERENCE:** Fechar o evento quando a mensagem foi entregue, sem confirmar acknowledgement, mitigação e impacto recuperado.
- **INFERENCE:** Medir apenas volume/latência de notificações. Medidas úteis incluem taxa de alertas acionáveis, duplicados por incidente, acknowledgement, tempo até mitigação, mensagens em DLQ, supressões expiradas e carga fora de horário.
- **INFERENCE:** Não preservar contexto entre Router, Watcher e Manager; isso obriga o humano a reconstruir causalidade em cada canal e cria decisões inconsistentes.

## O que um agente de operações deve saber para não “nascer cru”

1. **Estado e autoridade:** diferenciar sinal, alerta, incidente, mitigação, resolução e postmortem; conhecer quem pode decidir o quê.
2. **Impacto primeiro:** priorizar sintomas e utilizadores afetados; causa provável é hipótese, não fato confirmado.
3. **Entrega confiável:** usar idempotência, deduplicação, backoff/jitter, TTL, DLQ, redrive e estados observáveis; nunca declarar entrega com base em tentativa.
4. **Coordenação explícita:** nomear Incident Commander/owner, Communications Lead e Operations Lead; manter documento vivo e handoff confirmado.
5. **Human factors:** proteger atenção, sono e dignidade; reduzir ruído, escrever mensagens acionáveis, ser calmo e blameless, e escalar sem culpar.
6. **Observabilidade do próprio agente:** cada decisão deve ter evidência, confiança, timestamp, política aplicada e possibilidade de auditoria/reversão.
7. **Limites:** não enviar para canais ou pessoas não confirmados; não suprimir alertas críticos sem política; não executar ação destrutiva sem autorização explícita.
8. **Aprendizagem:** após cada evento, converter falha em item de ação com owner e prazo; rever alertas não acionáveis e atualizar playbooks.

## Lacunas e itens para validação posterior

- **NOT_PROVEN:** Qual é a matriz real de canais, owners, severidades e autorização da Lumenva? Precisa de decisão do dono do produto/ops.
- **NOT_PROVEN:** Quais provedores (email, WhatsApp, Slack, PagerDuty ou equivalentes) estarão no runtime e quais garantias de entrega oferecem?
- **NOT_PROVEN:** Não há evidência recente específica de uma operação Lumenva; sinais comunitários de 2026 foram usados apenas como contexto, não como prova de requisitos.
- **UNKNOWN:** SLAs/SLOs, políticas de quiet hours, retenção de DLQ, requisitos LGPD e procedimento de comunicação externa precisam ser definidos antes da implementação.

## Fontes principais

- [Google SRE Incident Management Guide](https://sre.google/resources/practices-and-processes/incident-management-guide/)
- [Google SRE - Managing Incidents](https://sre.google/sre-book/managing-incidents/)
- [Google SRE - Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/)
- [Google SRE - Postmortem Culture](https://sre.google/sre-book/postmortem-culture/)
- [AWS SNS message delivery retries](https://docs.aws.amazon.com/sns/latest/dg/sns-message-delivery-retries.html)
- [AWS SQS dead-letter queues](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html)
- [r/Observability: approaches to alert fatigue](https://www.reddit.com/r/Observability/comments/1smhs04/we_tested_4_different_approaches_to_fix_our_alert/)
- [r/sre: five years of on-call lessons](https://www.reddit.com/r/sre/comments/1suggw7/what_5_years_of_oncall_taught_me_about_the/)
- [r/ITIL: after-hours incident validation](https://www.reddit.com/r/ITIL/comments/1u6ofen/how_do_you_handle_afterhours_incident/)
