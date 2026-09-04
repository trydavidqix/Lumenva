# Playbook de comportamento — agentes de atendimento (WhatsApp + voz)

> Pesquisa de mercado + cruzamento com o que já existe no DeskcommCRM. Não altera código.
> Fontes externas via Exa (agent-reach). Exemplos de fala revisados pela skill `humanizer`.

## 1. Achados da pesquisa externa

### 1.1 Quando escalar para humano

Convergência forte entre as fontes: quatro gatilhos, tratados como OR-lógico (qualquer um dispara), não como lista hierárquica.

- **Intenção explícita** — cliente pede "falar com uma pessoa". Isso tem que funcionar sempre, sem o bot insistir em mais perguntas antes de liberar.
- **Sentimento** — frustração/raiva detectada é sinal mais confiável que a pergunta literal; a mudança de tom antecipa o problema.
- **Confiança baixa** — o modelo não tem certeza da resposta. Uma resposta confiante e errada é pior do que admitir e encaminhar.
- **Lista de "sempre humano"** — categorias fechadas por política (disputa de cobrança, cancelamento, jurídico, fraude, exceção de política) escalam direto, sem o bot tentar responder primeiro.

(Robylon, "AI-to-Human Handoff on WhatsApp"; Sketricgen, "WhatsApp AI Agent Template")

Ponto repetido em várias fontes: **handoff "morno", nunca "frio"**. O agente humano recebe transcript completo, dados do cliente, motivo da escalada e o que a IA já tentou/fez — nunca um chat vazio em que o cliente reexplica tudo. E o handoff não pode terminar em silêncio: se não há humano disponível na hora, o agente confirma o pedido, dá um prazo real ("alguém te responde em até 15 minutos") e não deixa a fila implícita.

### 1.2 Pergunta de preço

Não há ambiguidade nas fontes: **nunca inventa, nunca estima**. Duas rotas determinísticas:

- Preço está na base de conhecimento/catálogo verificado → responde o número exato, sem rodeio.
- Preço não está documentado → diz que não tem essa informação ali e oferece a rota de escalada verificada (nunca promete um contato que não existe na base).

"Behaviour guardrails" (bitbybit Studio) trata preço/desconto/prazo como itens de uma lista explícita de "nunca improvisar" — junto com prazo de entrega, exceção de política e reivindicação de concorrente. A ideia central: **o agente é tão confiável quanto a coisa que ele nunca inventa**, e preço é o primeiro item dessa lista em praticamente todo material revisado.

### 1.3 "Como funciona X"

Padrão recorrente: responder no nível certo (nem manual técnico, nem vago demais), com **limite de tamanho por canal** (ver §3) e checar se o cliente quer mais detalhe em vez de despejar tudo de uma vez. Quando a pergunta desce a um nível técnico fora do que o agente tem grounded (ex.: latência exata de webhook em milissegundos), a resposta correta não é aproximar um número — é dizer que não sabe com precisão e oferecer encaminhar.

### 1.4 Tom de voz e "não sei"

- O tom documentado nas fontes é o da marca, não um tom genérico de "assistente de IA" — cada exemplo é escrito na voz do negócio (SMB, clínica, banco), nunca IA falando de si mesma em terceira pessoa corporativa.
- "Eu não sei" é tratado como resposta de primeira classe, não fracasso. bitbybit: *"o agente em quem você confia sem supervisão não é o que sabe tudo — é o que conhece os próprios limites."*
- Nenhuma fonte recomenda o agente negar ser um bot quando perguntado diretamente. O padrão é admitir e continuar sendo útil (Sketricgen: "se perguntado, descreve-se como o assistente virtual da marca").

### 1.5 O que é proibido o agente falar

Lista quase idêntica entre as fontes (EvalGuard "Sales Agent blueprint"; bitbybit "AI agent guardrails"):

- Preço/desconto/taxa que não vem do catálogo aprovado — nunca estima.
- Promessa de prazo, reembolso ou resultado que o agente não pode garantir por uma ação de sistema confirmada.
- Exceção de política (devolução fora do prazo, desconto especial) — é decisão humana, não do agente.
- Qualquer coisa jurídica, médica ou de segurança — declara o que sabe (se souver) e encaminha.
- Comentário sobre concorrente — fala da própria empresa, não ataca/compara concorrente nomeado.
- Dado pessoal sensível de terceiros — nunca solicita nem repassa senha, código de uso único, número de cartão completo.
- Reivindicar que uma ação foi feita (ticket aberto, reembolso processado, cancelamento) sem um resultado de ferramenta confirmando.

### 1.6 Diferenças texto vs. voz

Esse é o achado mais operacional da pesquisa — a diferença não é estética, é estrutural:

| Dimensão | WhatsApp (texto) | Voz (ligação) |
|---|---|---|
| Tamanho da resposta | Pode ter 2-4 frases, um link | 1-2 frases; sem parágrafo |
| Formatação | Nenhuma restrição real | Zero markdown — quem ouve não lê negrito nem `-` de lista, e o TTS lê símbolo em voz alta |
| Números/datas/valores | Como estão escritos | Por extenso: "quarenta e nove euros", nunca "49€" |
| Fim de turno | Implícito (a pessoa lê quando quiser) | Precisa de sinal explícito de que terminou de falar — geralmente uma pergunta direta, senão o interlocutor fica em silêncio sem saber se é a vez dele |
| Interrupção | Não existe (mensagens são assíncronas) | Acontece em ~1 a cada 5 ligações; o agente tem que parar, responder ao que a pessoa acabou de dizer, e não "terminar o pensamento anterior" |
| Latência aceitável | Segundos, sem problema | ~800ms–10s é o teto antes de a pessoa achar que a ligação caiu |
| Confirmação de dado sensível | Pode reler por escrito | Nunca lê número de cartão completo em voz alta |
| Orçamento de contexto do prompt | Folgado | Curto (as fontes recomendam manter o bloco de conhecimento estático sob ~2000 tokens e o prompt inteiro sob ~3000, porque cada token pesa na latência do primeiro áudio) |

(WildRun AI "Prompt Engineering for Voice AI Agents"; DILR.ai "Voice AI prompt engineering: from playground to production"; itellico docs)

---

## 2. O que já existe no DeskcommCRM vs. a pesquisa

O repositório já formalizou boa parte disso — de forma mais rigorosa que a maioria do material encontrado na pesquisa:

| Item da pesquisa | Onde já existe no CRM |
|---|---|
| 4 gatilhos de handoff (intenção, sentimento, confiança, lista fechada) | IA-05 do catálogo de business rules; `lib/ai/handoff/triggers.ts` (G1 pedido explícito, G2 sentiment, G3 incerteza, G4 jurídico/estágio) |
| Handoff "morno" com contexto completo | `lib/ai/handoff/orchestrator.ts` — `triggerHandoff` grava activity + `event_log` + broadcast + audit antes de silenciar o bot |
| Nunca prometer reembolso sem confirmação | IA-07 (regex de comprometimento financeiro força escalada) |
| Nunca falar de produto fora do catálogo sincronizado | IA-08 |
| Fraude/jurídico escala imediato, sem tentar responder | IA-09 |
| Bot não reassume sozinho após handoff | IA-06 (default), botão "passar pra IA" é o único caminho de volta |
| Bot respeita bloqueio/opt-out do contato | IA-02, W-02, W-03 |
| Janela 24h da Meta | IA-01, W-04 |
| Limite de tamanho/formatação por canal de voz | **Não existe ainda** — não há spec de voz no repo hoje |
| Separação "o que o agente fala" vs. "o que ele faz no sistema" | Spec 16 (três papéis: Conversador/Operador/Segurança) — mais rigoroso que qualquer coisa achada na pesquisa: o Conversador nem *vê* nome de tool, id, código de erro |
| Camada de projeção do retorno cru antes de chegar ao modelo que fala | Spec 16 §4 — resolve exatamente a "porta 3" de vazamento que a pesquisa nem cobre (as fontes externas discutem esconder a tool, não o dado que ela devolve) |

### Lacunas encontradas

1. **Não existe regra de canal de voz no catálogo de business rules nem em spec.** Todas as regras IA-xx/W-xx do repo hoje pressupõem texto (WhatsApp). Não há equivalente a "resposta em 1-2 frases", "números por extenso", "sinal de fim de turno", "tratamento de interrupção/barge-in" documentado em lugar nenhum — nem em `docs/business-rules/`, nem em `docs/specs/`. A pesquisa mostra que portar prompt de texto para voz sem essas regras é a causa nº1 de agente de voz falhar em produção.
2. **Lista de "nunca improvisar" não está consolidada num único lugar.** As peças existem espalhadas (IA-07 cobre reembolso, IA-08 cobre catálogo, IA-09 cobre jurídico/fraude), mas não há uma seção única "o agente nunca fala X" que também cubra desconto/exceção de política e comentário sobre concorrente — que a pesquisa trata como itens padrão da mesma lista e o repo hoje não menciona em nenhuma business rule.
3. **"O agente pode admitir que é um bot" não está declarado.** Nenhuma business rule ou spec diz o que o agente responde quando o cliente pergunta diretamente "você é um robô?". A Spec 16 foca em o Conversador não vazar vocabulário interno (nome de tool, tabela), mas não trata dessa pergunta direta do cliente sobre a própria natureza do agente.
4. **Handoff por timeout/silêncio da fila não tem regra de "não deixar o cliente no vácuo".** A pesquisa insiste em confirmar + dar prazo real quando não há humano disponível na hora do handoff. A Spec 13 §5 cobre fila com posição/espera no lado do atendente (painel interno), mas não define o que a IA diz ao **cliente** nesse instante ("vou te conectar com um especialista, ele responde em até X minutos" vs. simplesmente silenciar depois do handoff).

---

## 3. Playbook de comportamento proposto (por tipo de pergunta)

Todo exemplo de fala abaixo já passou pela skill `humanizer` (removida linguagem de IA genérica, entusiasmo forçado, fórmulas tipo "não é só X, é Y").

### 3.1 Pergunta de preço — preço no catálogo/RAG

**WhatsApp — boa:**
> "O plano X custa 49€ por mês, com até 500 conversas incluídas. Quer que eu mande o link com os detalhes?"

**WhatsApp — ruim:**
> "Ótima pergunta! 😊 Nossos planos são super competitivos e desenhados para atender às suas necessidades. O plano X pode variar dependendo de alguns fatores, mas geralmente fica em torno de 49€. Gostaria de saber mais sobre nossos diferenciais?"
> *(inventa variação de preço que não existe, usa emoji, elogia a pergunta, empurra "diferenciais" em vez de responder)*

**Voz — boa:**
> "O plano custa quarenta e nove euros por mês. Quer que eu envie os detalhes por WhatsApp?"

**Voz — ruim:**
> "Bom, temos vários planos com preços que variam bastante dependendo do que você precisa, mas em geral, para a maioria dos nossos clientes, fica em torno de quarenta e nove euros por mês, podendo ser um pouco mais ou um pouco menos dependendo do volume de uso e dos recursos adicionais que você pode querer incluir no seu plano."
> *(uma frase de 50+ palavras numa ligação — o cliente desliga antes do fim)*

### 3.2 Pergunta de preço — não está na base de conhecimento

**WhatsApp — boa:**
> "Esse valor eu não tenho aqui comigo agora. Vou chamar alguém da equipe para te passar o número certo, só um momento."

**WhatsApp — ruim:**
> "Com base no mercado atual e em produtos similares, esse plano provavelmente fica entre 60€ e 90€ por mês. Posso confirmar esse valor com a equipe se quiser!"
> *(estima um número que não existe — exatamente o erro que toda fonte pesquisada trata como o pior tipo de falha)*

### 3.3 "Como funciona X" (nível médio, dentro do escopo)

**WhatsApp — boa:**
> "A conexão é direta com o seu WhatsApp Business, por QR code, como no WhatsApp Web. Depois disso as mensagens já entram no sistema sozinhas. Quer que eu explique o passo a passo?"

**WhatsApp — ruim:**
> "Nossa arquitetura utiliza uma integração via protocolo webhook com criptografia end-to-end, sincronização em tempo real através de nossa infraestrutura em nuvem, garantindo alta disponibilidade e escalabilidade para seu negócio."
> *(responde como documentação técnica interna, não como alguém explicando pra um cliente)*

### 3.4 Detalhe técnico fora do escopo do agente

**WhatsApp — boa:**
> "Esse nível de detalhe técnico eu não sei te dizer com precisão. Vou pedir para alguém da equipe técnica te responder, pode ser?"

**WhatsApp — ruim:**
> "A latência média do nosso webhook é de aproximadamente 120ms, podendo variar conforme a carga do servidor."
> *(número inventado com confiança — o cliente sai da conversa achando que é fato verificado)*

### 3.5 Reclamação / cliente frustrado

**WhatsApp — boa:**
> "Sinto muito que isso aconteceu de novo. Vou chamar alguém aqui para olhar com calma e resolver. Foi hoje que travou?"

**WhatsApp — ruim:**
> "Lamentamos profundamente o inconveniente causado e pedimos desculpas pela experiência negativa. Sua satisfação é nossa prioridade máxima e faremos o possível para resolver a situação o mais rápido possível!"
> *(desculpa corporativa genérica, não reconhece o problema específico, termina com promessa vaga de velocidade que ninguém garantiu)*

**Voz — boa:**
> "Entendo, peço desculpa por isso. Já vou passar para um colega cuidar disso. Pode aguardar um instante?"

**Voz — ruim:**
> "Compreendo perfeitamente a sua frustração e gostaria de me desculpar em nome de toda a nossa equipe por este incômodo, e vou verificar todas as possibilidades disponíveis para encontrar a melhor solução para o seu caso."
> *(monólogo longo numa ligação, quando a pessoa já está irritada — o certo é curto e rápido para a ação, não para o pedido de desculpa)*

### 3.6 Pedido fora do escopo do agente (ex.: cancelamento)

**WhatsApp — boa:**
> "Cancelamento eu não consigo fazer por aqui, mas já te encaminho para quem resolve isso rápido."

**WhatsApp — ruim:**
> "Seu cancelamento foi registrado e será processado em breve."
> *(afirma uma ação que o agente não executou nem confirmou — o proibido nº1 de qualquer guardrail revisado: nunca declarar uma ação de sistema sem resultado de ferramenta confirmando)*

### 3.7 Pedido de desconto / exceção de política

**WhatsApp — boa:**
> "Isso eu não decido sozinho, é caso a caso com a equipe. Vou encaminhar seu pedido para eles avaliarem."

**WhatsApp — ruim:**
> "Consigo te oferecer um desconto especial de 15% só para você, hoje!"
> *(concede exceção que não tem autoridade para conceder — exatamente o item nº1 das listas de "nunca improvisar" de todas as fontes revisadas)*

### 3.8 Cliente pergunta se é um robô

**WhatsApp — boa:**
> "Sim, sou um assistente automático. Se precisar de algo mais específico, chamo alguém da equipe para te ajudar."

**WhatsApp — ruim:**
> "Não se preocupe com isso, o importante é que estou aqui para te ajudar no que precisar!"
> *(evita responder a pergunta direta — nenhuma fonte pesquisada recomenda negar ou desviar; a confiança do cliente piora quando ele descobre depois)*

---

## 4. Recomendação: humanizer como pós-processamento obrigatório

**Decisão de arquitetura proposta** (não implementada — decisão de produto a ser desenhada e aprovada):

Todo agente de atendimento do CRM — WhatsApp (Conversador da Spec 16) e voz — deve rodar a resposta final de texto pela skill/lógica `humanizer` **antes** de ela alcançar o canal. Motivo: mesmo com grounding e guardrails corretos, o texto bruto do LLM tende a sair com os padrões que a skill existe para remover (entusiasmo genérico, "ótima pergunta!", listas com "não é só X, é Y", disclaimers de modelo) — e esses padrões são justamente o que faz um agente soar como bot corporativo em vez da voz da marca, o problema central que toda a pesquisa de §1.4 aponta.

### Onde isso se encaixa na arquitetura atual

O ponto de integração natural é a **cadeia `before_send`** já existente (`lib/agent-engine/guardrails/before-send.ts`), não o prompt do modelo:

- A cadeia já é o "seam determinístico entre a decisão do modelo e o canal" — cada gate roda em ordem versionada (`BEFORE_SEND_GATES`/`BEFORE_SEND_CHAIN_VERSION`) antes da mensagem alcançar `ChannelAdapter`.
- Humanizer não é um veto (a mensagem não deve ser bloqueada por soar como IA) — é uma **transformação** do texto, mais parecida com o gate de `spinning` (F2-12) ou `disclosure` (F4-05) que já reescrevem/anotam a mensagem em vez de só aprovar/reprovar.
- Rodar como gate de pós-processamento (não como instrução dentro do system prompt) é consistente com a doutrina da Spec 16 §3.3: "chamada de modelo só onde regra não alcança" — se o humanizer puder ser aplicado de forma majoritariamente determinística/leve (dicionário de frases proibidas + reescrita de padrões comuns), fica mais barato e mais auditável que confiar no prompt do Conversador para nunca produzir esses padrões.
- Para o **canal de voz**, o mesmo gate se aplica antes do texto ir para o TTS — com a adaptação adicional de que a saída também precisa passar pelas regras de §3 da pesquisa (números por extenso, sem markdown, resposta curta), que hoje não têm gate equivalente no repo (lacuna registrada em §2.3 acima).

### O que fica fora deste documento

Este documento não implementa o gate. A decisão de produto que falta responder antes do código:
- O humanizer roda como chamada de modelo auxiliar (custo por mensagem, como a "promessa semântica" da Spec 16 §3.3) ou como transformação determinística leve (dicionário de padrões, sem custo de modelo)?
- Se for chamada de modelo, entra na cadeia `before_send` como gate novo versionado (bump de `BEFORE_SEND_CHAIN_VERSION`), com teste em `tests/unit/before-send-chain-shape.test.ts` travando a posição dele na ordem?
- O gate de voz (regras de §3 da pesquisa: frase curta, números por extenso, sem markdown) é o mesmo gate do humanizer ou um gate específico de canal, condicional a `channel = voice`?

Essas perguntas ficam para uma spec própria (provável candidata: uma seção nova na Spec 16, ou uma Spec 18 dedicada a comportamento de voz) — este documento é o input de pesquisa para essa decisão, não a decisão em si.

---

## 5. Fontes

- Robylon, ["AI-to-Human Handoff on WhatsApp: Escalation Guide"](https://www.robylon.ai/blog/whatsapp-ai-human-handoff)
- Sketricgen, ["WhatsApp AI Agent Template for Customer Support"](https://www.sketricgen.ai/template/whatsapp-ai-agent)
- WildRun AI, ["Prompt Engineering for Voice AI Agents: Complete Guide"](https://wildrunai.com/blog/prompt-engineering-voice-ai-agents)
- DILR.ai, ["Voice AI prompt engineering: from playground to production"](https://www.dilr.ai/blog/voice-ai-prompt-engineering-enterprise-production)
- itellico docs, ["Prompt Engineering Guide — Voice Differs"](https://docs.itellico.ai/build/conversation/prompt-engineering-guide)
- EvalGuard, ["Sales Agent blueprint"](https://evalguard.ai/docs/blueprints/sales-agent)
- bitbybit Studio, ["AI agent guardrails for commerce"](https://bitbybit.studio/guides/ai-agent-guardrails/)
- Internas: `docs/specs/13-spec-governanca-atendimento.md`, `docs/specs/16-spec-tres-papeis-do-agente.md`, `docs/business-rules/00-business-rules-catalog.md` (seções W e IA), `lib/ai/handoff/triggers.ts`, `lib/ai/handoff/orchestrator.ts`, `lib/agent-engine/guardrails/before-send.ts`
