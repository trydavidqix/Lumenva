# MEMORIA/META — Hermes: memória avançada de longo prazo

Data da pesquisa: 2026-09-12  
Escopo: como um agente deve formar, organizar, recuperar, atualizar e corrigir memória semântica, episódica e procedural; práticas humanas; falhas; dimensões comportamentais para PsycheOS.

## Limite de evidência

- **FACT (pesquisa primária):** fontes abaixo são papers, documentação oficial ou fontes psicológicas identificáveis.
- **FACT (escuta recente):** `last30days` encontrou 6 threads Reddit e 2 histórias Hacker News no intervalo 2026-08-13—2026-09-12. Reddit ficou parcial por HTTP 429; web grounding estava indisponível; X/Twitter não estava configurado. Portanto, silêncio nessas fontes é **NOT_PROVEN**.
- A pesquisa recente teve concentração alta em uma thread sobre Antigravity: as perguntas mais votadas foram “Why use this compared to hindsight or list of memory solutions?” (u/rings48, 12 votos) e “Who decides what is saved, when is it saved and what is actually getting saved in a session?” (u/venneq, 4 votos). Isso é sinal de preocupação prática com governança da memória, não prova de uma arquitetura vencedora.

## 1. Modelo mental: três memórias, três trabalhos

### Semântica — “o que é verdade ou preferência estável”

**FACT:** memória semântica guarda fatos, conceitos e preferências abstraídos de episódios; a documentação do LangChain distingue fatos semânticos, experiências episódicas e regras procedurais e recomenda memória de longo prazo para dados específicos do utilizador/aplicação ([LangChain — Memory concepts](https://docs.langchain.com/oss/python/concepts/memory)). A psicologia clássica trata semântica e episódica como sistemas declarativos dissociáveis ([Annual Review of Psychology — Episodic Memory](https://www.annualreviews.org/content/journals/10.1146/annurev.psych.53.100901.135114); [PMC — Memory Dysfunction](https://pmc.ncbi.nlm.nih.gov/articles/PMC4455839/)).

Prática para Hermes: guardar afirmações atómicas com `subject/predicate/object`, fonte, data de observação, confiança, escopo (utilizador, organização, projeto) e validade temporal. “David prefere respostas curtas” deve ser uma afirmação revisável, não uma instrução irrevogável.

### Episódica — “o que aconteceu, quando e em que contexto”

**FACT:** memória episódica é recordação de experiências com contexto temporal e espacial (“mental time travel”), distinta de conhecimento factual ([PMC — communicative function of episodic memory](https://pmc.ncbi.nlm.nih.gov/articles/PMC5404722/)).

Prática para Hermes: manter eventos imutáveis ou append-only (mensagem, ação, ferramenta, resultado, erro, participantes, timestamp, evidência). A camada episódica deve responder “o que fizemos na última tentativa?” e permitir auditoria/replay; não deve ser substituída por um resumo sem ponte para os eventos originais.

### Procedural — “como executar e sob que condições”

**FACT:** memória procedural representa habilidades/regras de ação; LangChain documenta a separação entre fatos, episódios e regras ([LangChain — Memory concepts](https://docs.langchain.com/oss/python/concepts/memory)). Em agentes, [A-Mem (NeurIPS 2025)](https://proceedings.neurips.cc/paper_files/paper/2025/file/19909c36f51abc4856b4560aff3d36d6-Paper-Conference.pdf) mostra notas atómicas ligadas dinamicamente e evolução das representações; [AdMem](https://arxiv.org/html/2606.06787) explicita procedimentos como orientação extraída de ações e resultados, com avaliação por crítico.

Prática para Hermes: uma rotina deve incluir pré-condições, passos, pós-condições, ferramentas permitidas, exemplos de sucesso, contraexemplos/falhas e taxa de sucesso por contexto. Nunca promover automaticamente uma trajetória única a “procedimento universal”.

## 2. Arquitetura e ciclo de vida recomendados

1. **Captura com proveniência.** Registar episódio bruto antes de resumir; cada abstração aponta para os IDs dos episódios que a suportam.
2. **Classificação explícita.** Roteador decide semântica, episódica, procedural (uma mesma ocorrência pode gerar as três, mas com IDs distintos).
3. **Consolidação assíncrona.** Agrupar episódios coerentes em narrativas; extrair fatos periféricos para semântica; induzir procedimentos apenas após observar resultado. [Amory (EACL 2026)](https://aclanthology.org/2026.eacl-long.183.pdf) usa narrativas episódicas, consolidação guiada por “momentum” e semanticização de fatos periféricos; relata melhor cobertura que similaridade vetorial em perguntas multi-hop.
4. **Retrieval híbrido e orientado à intenção.** Combinar lexical/BM25 (nomes exatos), embeddings (similaridade), filtros temporais/entidades e grafos causais/temporais. [SYNAPSE (Findings ACL 2026)](https://aclanthology.org/2026.findings-acl.1108.pdf) usa grafo episódico-semântico, spreading activation, decaimento temporal e inibição lateral para evitar isolamento contextual; [MAGMA](https://arxiv.org/abs/2603.29194) modela relações semânticas, temporais, causais e de entidade com roteamento adaptativo.
5. **Gating antes de injetar contexto.** Recuperar não basta: aplicar relevância, autoridade, recência, escopo, sensibilidade e conflito. Limitar o orçamento de tokens e devolver “não sei” quando o suporte é insuficiente.
6. **Feedback e manutenção.** Medir uso, utilidade, correções, contradições e idade. Consolidar/mesclar duplicatas; arquivar memórias pouco usadas; preservar histórico de alterações. AdMem descreve avaliação por recompensa, merge e pruning para escalar ([AdMem](https://arxiv.org/html/2606.06787)).
7. **Correção e esquecimento controláveis.** O utilizador deve poder ver, corrigir, apagar e restringir memórias. A eliminação precisa propagar-se a índices, grafos, caches e derivados; registrar tombstone sem reter o conteúdo apagado.

## 3. Frameworks e padrões respeitados

- **CoALA (cognitive architectures for language agents):** usar memória de trabalho, episódica, semântica e procedural como módulos com operações distintas; tratar memória como parte do ciclo perceber–raciocinar–agir. Referência: [Paper “Cognitive Architectures for Language Agents”](https://arxiv.org/abs/2309.02427). **INFERENCE:** é um bom contrato conceitual para Hermes, não uma implementação pronta.
- **MemGPT/Letta — hierarquia e autoedição:** Letta documenta agente com memória persistente em filesystem Git-backed (`MemFS`), além de busca de mensagens full-text/vector/hybrid ([Letta docs](https://docs.letta.com/); [MemFS](https://github.com/letta-ai/letta-docs-md/blob/main/concepts/memfs/index.md)). Padrão útil: memória ativa pequena + arquivo externo pesquisável + ferramentas explícitas de leitura/escrita.
- **Zettelkasten/A-Mem — notas atómicas e links:** cada memória recebe descrição contextual, palavras-chave e tags; novas notas podem criar links e atualizar contexto de notas antigas ([A-Mem](https://proceedings.neurips.cc/paper_files/paper/2025/file/19909c36f51abc4856b4560aff3d36d6-Paper-Conference.pdf)). **RISCO:** evolução automática pode reescrever história; manter versão anterior e proveniência.
- **Generative Agents — memória stream + reflexão:** o trabalho de Park et al. regista experiências, gera reflexões de nível superior e usa-as no planeamento; a recuperação combina relevância, recência e importância ([paper](https://arxiv.org/abs/2304.03442)). **INFERENCE:** reflexões devem apontar para episódios-fonte; caso contrário, generalizações tornam-se impossíveis de auditar.
- **MemGPT/Letta — paginação de contexto:** MemGPT trata a janela de contexto como memória física limitada e move dados entre contexto principal e armazenamento externo por operações explícitas ([MemGPT](https://arxiv.org/abs/2310.08560)). Letta documenta `MemFS` Git-backed e pesquisa full-text/vector/hybrid ([Letta docs](https://docs.letta.com/); [MemFS](https://github.com/letta-ai/letta-docs-md/blob/main/concepts/memfs/index.md)).
- **MemoryBank — reforço e esquecimento:** o framework propõe atualização contínua, recuperação por relevância e decaimento inspirado na curva de esquecimento, com reforço quando a memória é importante ou reutilizada ([paper](https://arxiv.org/abs/2305.10250)). **INFERENCE:** retenção infinita não deve ser o padrão de Hermes.
- **Grafo temporal/causal:** não depender apenas de vizinho vetorial. SYNAPSE e MAGMA são evidência recente de que relações e caminhos recuperam causas/episódios que não partilham palavras com a consulta.
- **Neuro-simbólico:** [NS-Mem](https://doi.org/10.48550/arxiv.2603.15280) separa camada episódica, semântica e lógica/procedural; combina embeddings com consultas simbólicas determinísticas. **INFERENCE:** adequado para runbooks críticos, onde “parece semelhante” não autoriza uma ação.

## 4. Erros comuns documentados

- **Só vetor/RAG.** Similaridade lexical não recupera causa, sequência ou contexto temporal; produz “contextual isolation/tunneling” (SYNAPSE; Amory). Mitigação: híbrido lexical + denso + grafo + tempo.
- **Resumo que apaga a fonte.** Um resumo sem ponte para episódios impede auditoria, correção e distinção entre facto dito pelo utilizador e inferência do modelo. Mitigação: IDs de proveniência e evidência citável.
- **Guardar tudo.** Custo, ruído e exposição de dados aumentam; o agente passa a recuperar detalhes irrelevantes. Mitigação: política de saliência, retenção e escopo; medir precisão de memória e taxa de falsa memória.
- **Guardar pouco demais.** Consolidar cedo transforma tentativa, erro e condição em regra falsa. Mitigação: janela de inatividade/consolidação e promoção procedural somente com resultado observado (AdMem, Amory).
- **Misturar tipos.** Preferência semântica, episódio e procedimento têm validade e retrieval diferentes; misturá-los causa “fato” tratado como instrução ou experiência tratada como regra.
- **Conflitos sem resolução.** Atualizar “prefere X” sem manter “preferia Y até data Z” gera respostas contraditórias. Mitigação: validade temporal, confiança, autoridade da fonte e política explícita de conflito.
- **Sem escopo/tenant.** Memória de um utilizador/projeto vaza para outro. Mitigação: ACL/RLS por memória e testes negativos de isolamento.
- **Autoaprendizagem sem aprovação.** Procedimentos podem cristalizar uma ação perigosa. Mitigação: níveis de aprovação, sandbox, dry-run e rollback.
- **Apagar apenas a linha visível.** Índices vetoriais, grafos, resumos e caches continuam a lembrar. Mitigação: apagar por lineage e verificar ausência em cada backend.
- **Confundir ausência de recuperação com ausência de memória.** O retrieval pode falhar, como mostram as fontes recentes; registrar `not_retrieved`, `not_found` e `not_proven` separadamente.

## 5. Como avaliar Hermes

**FACT:** LoCoMo e LongMemEval são benchmarks recorrentes na literatura recente (AdMem, Amory, SYNAPSE, MAGMA) para perguntas temporais, multi-hop e conversas longas. Não tratar uma pontuação única como prova de segurança em produção.

Métricas mínimas:

- precisão factual e **false-memory rate**;
- recall de episódios relevantes e cobertura de caminhos multi-hop;
- fidelidade de citação/proveniência;
- resolução temporal (última preferência válida, não primeira menção);
- sucesso procedural separado por contexto, com falhas recuperadas;
- latência, tokens e custo de escrita/leitura/consolidação;
- isolamento entre utilizadores/projetos;
- tempo e completude de correção/apagamento;
- calibração: frequência de “não tenho evidência suficiente” quando realmente não há suporte.

**UNKNOWN:** nenhuma das fontes consultadas prova que uma arquitetura específica mantém precisão, privacidade e apagamento completos em produção multi-tenant; isso exige testes no ambiente e no provedor reais.

## 6. Traços comportamentais e emocionais para PsycheOS

Estes pontos são **INFERENCE** a partir das exigências técnicas e da observação humana, não diagnósticos psicológicos:

- **Humildade epistémica:** distinguir lembrança, inferência e palpite; declarar confiança e fonte.
- **Identidade estável, não teimosia:** manter continuidade sem defender uma memória quando o utilizador corrige.
- **Sensibilidade a consentimento:** perguntar antes de guardar dados íntimos/sensíveis; respeitar “não memorize isto”.
- **Reparação sem defensividade:** admitir “lembrei errado”, corrigir derivados e explicar o que mudou.
- **Curiosidade orientada a lacunas:** procurar episódios relacionados quando a pergunta exige causa, mas não fazer associações invasivas.
- **Discrição e minimização:** lembrar o necessário para ajudar, não tudo o que pode ser armazenado.
- **Paciência temporal:** preferir esperar consolidação a converter uma experiência incompleta em regra.
- **Prudência procedural:** tratar procedimentos como hipóteses condicionais; usar dry-run/confirmar em ações irreversíveis.
- **Transparência social:** explicar de forma curta “lembro isto porque…” quando a personalização puder surpreender.

## 7. Síntese: o que Hermes deve saber antes de “nascer cru”

Hermes precisa de uma memória em camadas, com episódios rastreáveis, fatos semânticos revisáveis e procedimentos condicionais. Deve recuperar por intenção (tempo, entidade, causalidade e tarefa), não por embedding isolado; consolidar fora do caminho crítico; aprender com sucesso **e** falha; e manter lineage de cada abstração até a evidência original. A UX de memória — ver, corrigir, esquecer e consentir — é parte da competência, não um extra.

O comportamento padrão deve ser: recuperar pouco e relevante; citar a base; marcar conflito; pedir confirmação antes de promover regra ou executar ação; e dizer `NOT_PROVEN` quando a memória ou a fonte não sustentam a resposta. A arquitetura só estará pronta para Wave 2 após testes de falsa memória, isolamento, apagamento, regressão temporal e recuperação multi-hop no ambiente real.

## Apêndice — escuta `last30days` (últimos 30 dias)

**FACT:** a escuta local retornou discussão prática sobre quem decide o que é salvo, quando é carregado e por que usar uma solução em vez de “hindsight”. Reddit ficou parcial por rate limit; HN trouxe apenas dois itens; YouTube/X/web não forneceram evidência utilizável nesta execução. Não extrapolar popularidade ou consenso.

---
✅ All agents reported back!
├─ 🟠 Reddit: 6 threads │ 92 upvotes │ 127 comments │ ⚠ partial after 6 items: HTTP 429: Too Many Requests (run doctor for fixes)
├─ 🟡 HN: 2 storys │ 8 points │ 2 comments
├─ 🗣️ Top voices: r/AI_Agents, r/google_antigravity, r/SillyTavernAI
└─ 📎 Raw results saved to /private/tmp/last30-hermes-memory3/long-term-memory-for-ai-agents-semantic-episodic-procedural-memory-raw.md
---
