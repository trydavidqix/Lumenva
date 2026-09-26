# Pesquisa de fundamentos — PRODUTO/ESTÚDIO

**Escopo:** Arquiteto de Estúdio, Design, Copy, Frontend Builder, Backend Builder e Studio QA.

**Data da pesquisa:** 2026-09-12. **Método:** Agent Reach (doctor + Exa), `last30days` v3.19.0 (janela 2026-08-13–2026-09-12), documentação oficial e referências profissionais. O `last30days` teve 3 threads Reddit e 3 histórias Hacker News; Reddit ficou parcial por HTTP 429 e grounding web indisponível. As fontes recentes são sinais de comunidade, não prova universal.

## 1. Arquiteto de Estúdio

### Práticas e frameworks

- **FACT — Discovery antes de construção.** O Service Manual do GOV.UK exige compreender necessidades, contexto, restrições e métricas antes de comprometer construção; discovery não deve começar construindo ([GOV.UK — discovery](https://www.gov.uk/service-manual/agile-delivery/how-the-discovery-phase-works)).
- **FACT — Testar as hipóteses mais arriscadas.** Em alpha, protótipos devem explorar alternativas e validar riscos técnicos, legais e de integração; o código pode ser descartável ([GOV.UK — alpha](https://www.gov.uk/service-manual/agile-delivery/how-the-alpha-phase-works)).
- **FACT — Entrega iterativa e foco no utilizador.** Princípios oficiais: necessidades do utilizador, iteração, melhoria da equipa, falhar cedo/aprender rápido e planeamento contínuo ([GOV.UK — princípios agile](https://www.gov.uk/service-manual/agile-delivery/core-principles-agile)).
- **FACT — Fluxo adaptado ao estágio.** Scrum, Kanban e Lean têm usos distintos: Scrum para trabalho de sprint, Kanban para fluxo/bottlenecks, Lean para aprendizagem rápida ([GOV.UK — métodos agile](https://www.gov.uk/service-manual/agile-delivery/agile-methodologies)).
- **INFERENCE — Para um estúdio AI-first, o artefacto central é um “contrato executável”:** problema, utilizadores, hipóteses, decisões de arquitetura, critérios de aceitação, riscos, observabilidade e gates humanos, versionados e consultáveis pelos agentes.

### Erros comuns documentados

- Começar a implementar uma solução pré-escolhida sem reformular o problema; isso cristaliza premissas erradas.
- Otimizar apenas o “inner loop” (gerar código) e ignorar decisão, revisão, lançamento e aprendizagem (“outer loop”). Um relato de praticante sobre Cortex/TRM descreve excesso de PRs, shaping insuficiente e perda de throughput ([Refactoring — case study AI product development](https://refactoring.fm/p/a-case-study-in-ai-product-development)).
- Dar autonomia a agentes sem arquitetura de alto nível, contexto de domínio e perguntas de clarificação. O relato de produção da Atlassian documenta dependências cíclicas, E2E quebrado e comportamento de produto descoberto tarde ([Atlassian — prototype to production](https://www.atlassian.com/blog/jira/ai-built-prototype-to-production)).

### Traços comportamentais/emocionais

- Tolerância a incerteza sem confundir velocidade com progresso.
- Curiosidade socrática: perguntar “que evidência mudaria esta decisão?” antes de aceitar um PRD.
- Humildade epistémica e capacidade de parar; explicitar UNKNOWN e pedir decisão do dono.
- Empatia sistémica: equilibrar utilizador, negócio, operação, segurança, acessibilidade e custo.
- Comunicação sem culpa em post-mortems; conflitos devem ser escalados com opções e impacto.

## 2. Design (produto, interação e visual)

### Práticas e frameworks

- **FACT — Heurísticas de Nielsen.** As dez heurísticas continuam referência para inspeção: visibilidade do estado, linguagem do mundo real, controlo e reversibilidade, consistência, prevenção de erros, reconhecimento, flexibilidade, minimalismo, recuperação de erros e ajuda ([NN/g](https://www.nngroup.com/articles/ten-usability-heuristics/)).
- **FACT — Acessibilidade como requisito testável.** WCAG 2.2 é Recomendação W3C (12-12-2024), com critérios verificáveis e cobertura de limitações visuais, auditivas, motoras, cognitivas e de aprendizagem ([W3C WCAG 2.2](https://www.w3.org/TR/wcag/)).
- **INFERENCE — Design de AI exige confiança calibrada:** mostrar incerteza, origem/explicação adequada, estados de falha e override; não mascarar saída probabilística como facto. Um relatório de estúdio (fonte practitioner, não norma) descreve trust design, failure-state mapping e override desde a descoberta ([AAMAX](https://aamax.co/blog/we-run-a-digital-product-studio-here-s-why-we-rebuilt-our-ai-process-from-scratch)).

### Erros comuns documentados

- Avaliar apenas o “happy path”; omitir loading, vazio, erro, recuperação, permissões, mobile, teclado, leitor de ecrã e baixa largura de banda.
- Copiar componentes ou estética sem validar a tarefa e o vocabulário dos utilizadores.
- Tratar acessibilidade como auditoria no fim, quando WCAG deve informar desenho e critérios desde o início.
- Não desenhar o que acontece quando o modelo está incerto, errado, fora de distribuição ou corrigido pelo utilizador.

### Traços comportamentais/emocionais

- Observação sem ego: evidência de utilizador vence preferência estética.
- Sensibilidade a vergonha, ansiedade e carga cognitiva; mensagens de erro devem preservar dignidade e agência.
- Disciplina para explorar várias soluções e convergir por critérios explícitos.
- Atenção a detalhes e consistência, mas sem perfeccionismo que atrase aprendizagem.

## 3. Copy (conteúdo e voz)

### Práticas e frameworks

- **FACT — Conteúdo orientado à tarefa.** A heurística de “ajuda e documentação” recomenda informação pesquisável, focada na tarefa e em passos concretos ([NN/g](https://www.nngroup.com/articles/ten-usability-heuristics/)).
- **INFERENCE — Copy deve ser parte do design de estados.** Cada fluxo precisa de texto para sucesso, vazio, progresso, falha recuperável, falha irreversível, consentimento, permissões e saída AI; o copy é uma camada de segurança e confiança, não apenas marketing.
- **ASSUMPTION (a validar no produto):** glossário de domínio, exemplos reais e regras de tom devem viver em ficheiro versionado para reduzir deriva entre agentes.

### Erros comuns documentados

- Prometer certeza ou capacidade que o produto/modelo não tem.
- Usar jargão interno, mensagens vagas (“algo deu errado”) ou culpa ao utilizador.
- Escrever textos longos onde uma instrução curta e uma ação reversível bastariam.
- Alterar labels sem atualizar testes, analytics, documentação e suporte.

### Traços comportamentais/emocionais

- Clareza, concisão e respeito por diferentes níveis de literacia.
- Honestidade sobre limites; evitar persuasão manipulativa.
- Escuta ativa de suporte e pesquisa qualitativa; detectar palavras que geram medo ou abandono.

## 4. Frontend Builder

### Práticas e frameworks

- **FACT — Integração contínua com build auto-testável.** Cada integração deve ser verificada por build automatizado; manter mainline, build rápido, corrigir builds quebrados imediatamente e testar em clone próximo de produção ([Martin Fowler — CI](https://martinfowler.com/articles/continuousIntegration.html)).
- **FACT — Testes em camadas.** A pirâmide prática usa mais testes unitários rápidos, menos integração e ainda menos end-to-end caros, ajustando a distribuição ao risco ([Martin Fowler — practical test pyramid](https://martinfowler.com/articles/practical-test-pyramid.html)).
- **FACT — Acessibilidade no código.** Critérios WCAG 2.2 são agnósticos à tecnologia e testáveis; componentes devem expor foco, nome acessível, teclado, contraste e estados ([W3C](https://www.w3.org/TR/wcag/)).
- **INFERENCE — Contrato de componente:** estados e critérios (loading/error/empty/success, responsividade, teclado, analytics) devem ser definidos antes da implementação e verificados em cada PR.

### Erros comuns documentados

- Gerar componentes sem entender arquitetura, design system ou contrato de API; resolver sintomas com CSS ad hoc.
- Testar snapshots como substituto de comportamento real e acessibilidade.
- Ignorar estados assíncronos, concorrência, retries, timezones, locale e permissões.
- Aceitar PR grande demais para revisão humana; a Atlassian relata dificuldade de manter mapa mental quando PRs crescem ([Atlassian](https://www.atlassian.com/blog/jira/ai-built-prototype-to-production)).

### Traços comportamentais/emocionais

- Paciência para ler código existente e respeitar convenções.
- Pragmatismo: preferir mudança pequena, reversível e observável.
- Responsabilidade pelo utilizador final, não apenas pelo “build verde”.

## 5. Backend Builder

### Práticas e frameworks

- **FACT — Contratos e integração incremental.** CI reduz risco de integração ao integrar frequentemente, automatizar build/teste e manter feedback rápido ([Fowler](https://martinfowler.com/articles/continuousIntegration.html)).
- **FACT — Qualidade inclui segurança, performance e capacidade.** QA oficial recomenda testes funcionais, exploratórios, de acessibilidade, vulnerabilidade/penetração, performance e capacidade ([GOV.UK — QA](https://www.gov.uk/service-manual/technology/quality-assurance-testing-your-service-regularly)).
- **INFERENCE — Para AI, override e proveniência são requisitos backend:** guardar versão do modelo/prompt, input relevante, output, confiança quando disponível, correção humana, auditoria e política de retenção; separar autorização por papel e tenant.
- **UNKNOWN —** Nenhuma fonte desta passada prova uma arquitetura específica (REST, GraphQL, event-driven, banco ou cloud); isso depende do contexto do produto.

### Erros comuns documentados

- Integrar APIs externas sem timeouts, idempotência, retries limitados, circuit breaker, rate-limit e telemetria.
- Fazer fallback silencioso que altera semântica ou segurança.
- Misturar dados de tenants/roles; o debate recente em r/AI_Agents questiona explicitamente autorização quando uma base/MCP centraliza dados ([Reddit thread](https://www.reddit.com/r/AI_Agents/comments/1w97rah/how_we_structure_company_data_for_ai_agents/)).
- Adiar migrações, observabilidade e rollback até “depois do MVP”.

### Traços comportamentais/emocionais

- Conservadorismo saudável com dados, autorização e efeitos irreversíveis.
- Gosto por contratos explícitos, invariantes e failure modes.
- Capacidade de dizer “não provado” quando só existe mock ou teste local.

## 6. Studio QA

### Práticas e frameworks

- **FACT — QA desde discovery.** Qualidade deve ser pensada desde discovery; automatizar no CI acelera feedback e evita regressões ([GOV.UK](https://www.gov.uk/service-manual/technology/quality-assurance-testing-your-service-regularly)).
- **FACT — Misturar testes automatizados e exploratórios.** Automação cobre regressão; exploração encontra comportamentos inesperados, incluindo segurança, performance e acessibilidade ([GOV.UK](https://www.gov.uk/service-manual/technology/quality-assurance-testing-your-service-regularly)).
- **SINAL RECENTE —** Um projeto em r/SideProject descreve “utilizadores sintéticos” percorrendo signup, onboarding, permissões, pagamentos e recuperação porque código e testes gerados por agentes aceleraram, mas QA não acompanhou ([Reddit](https://www.reddit.com/r/SideProject/comments/1wattd4/i_built_an_ai_qa_workflow_for_a_client_started/)). É relato individual, não validação estatística.
- **INFERENCE — Gate por risco:** cada entrega precisa de matriz de risco, evidência reproduzível, severidade, owner e decisão explícita para known issues; silêncio/timeout não é PASS.

### Erros comuns documentados

- Confiar em testes gerados pelo mesmo agente que escreveu o código, sem teste independente.
- Cobrir endpoints e não jornadas reais (permissões, pagamentos, recuperação, dados vazios, interrupção de rede).
- Não testar regressão visual, breakpoints, teclado, leitor de ecrã, locale e comportamento após refresh/back.
- Reportar “funciona localmente” como prova de produção, fornecedor, RLS ou observabilidade.

### Traços comportamentais/emocionais

- Ceticismo construtivo: procurar como quebrar sem transformar revisão em punição.
- Atenção sustentada a casos-limite e capacidade de reproduzir exatamente.
- Independência de julgamento e coragem para bloquear release com evidência clara.
- Empatia pelo executor: bugs devem conter passos, ambiente, esperado/observado e impacto.

## Síntese: o que um agente AI nesta área precisa saber antes de “nascer”

1. **Pensar em ciclo completo:** sinal → problema → hipótese → protótipo → contrato → implementação → QA → lançamento → observabilidade → aprendizagem. Velocidade de geração sem decisão e feedback apenas acelera desperdício.
2. **Tratar artefactos como memória operacional:** PRD, mapa de jornada, ADR, design tokens, glossário, contratos de API, critérios de aceitação, matriz de risco, resultados de testes e decisões devem ser versionados e consultáveis.
3. **Separar papéis e gates:** o agente pode explorar e propor; decisões de produto, arquitetura, segurança, dados pessoais e ações irreversíveis exigem dono humano explícito.
4. **Projetar falhas como primeira classe:** estados de erro, incerteza AI, retries, cancelamento, permissões, recuperação e override precisam de design, copy, backend e testes coordenados.
5. **Medir evidência, não intenção:** distinguir FACT, ASSUMPTION, INFERENCE, UNKNOWN, NOT_PROVEN; anexar comando, ambiente, versão e resultado. Não inferir produção a partir de mocks.
6. **Comportamento desejado:** curioso, humilde, legível, reversível por padrão, atento a acessibilidade e dignidade, disposto a pedir clarificação e bloquear quando o risco excede a evidência.

## Limites da evidência

- A pesquisa `last30days` encontrou 6 itens (3 HN, 3 Reddit), com cobertura Reddit parcial por HTTP 429 e sem grounding web; não há base para generalizar prevalência.
- AAMAX, Atlassian e Refactoring são relatos de prática/case study; use como hipóteses operacionais, não como norma independente.
- Frameworks e links foram consultados em 2026-09-12; revalidar versões e requisitos antes de uma decisão de release.
