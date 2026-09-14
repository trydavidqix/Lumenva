# Veredito de validação — Codex Cloud (12-09-2026)

## Limite de entrada

O ficheiro solicitado `texto-para-validar.md` não existia no checkout no momento da pesquisa (também não existia a pasta `scratch-council/codex-cloud`). Portanto, os sete pontos abaixo foram validados contra a lista explícita da missão, não contra o texto original. A ausência do texto é `NOT_PROVEN` quanto a quaisquer formulações adicionais que ele possa conter.

## 1. Codex Cloud incluído no ChatGPT Plus?

**FACT — confirmado.** O anúncio oficial registou que Codex ficou disponível para utilizadores Plus em 3 de junho de 2025. A documentação atual de uso diz que o uso de Codex/Work está incluído nos planos Plus e Pro. A página atual de preços deve ser usada para a franquia vigente da conta, porque a oferta e os modelos mudam.

Fontes: [anúncio oficial do Codex](https://openai.com/index/introducing-codex/); [Using Codex with your ChatGPT plan](https://help.openai.com/en/articles/11369540-icodex-in-chatgpt); [FAQ Work e Codex](https://help.openai.com/en/articles/20001275).

## 2. Há limite partilhado entre local e cloud no Plus? Qual é a franquia?

**FACT — limite partilhado; franquia não é um número fixo universal.** A OpenAI afirma que o uso de Codex no CLI/IDE e o uso delegado na web/cloud consomem o mesmo conjunto de uso/créditos quando disponíveis no plano. O consumo varia por modelo, tamanho/complexidade da tarefa, contexto e duração. A documentação atual descreve janelas de cinco horas e semanal; o painel Settings → Usage é a fonte autoritativa da conta. A tabela publicada dá apenas intervalos estimados por modelo (por exemplo, para Plus: GPT‑5.6 Sol 10–100 mensagens locais por janela de cinco horas), não uma quota fixa de tarefas cloud.

**CONTRADITO** se o texto afirmar uma franquia simples do tipo “X tarefas por mês” ou uma conversão fixa local/cloud. A própria OpenAI diz que não existe conversão temporal fiável.

Fontes: [guia atual de limites Work/Codex](https://help.openai.com/en/articles/20001516-managing-usage-with-gpt-6-astra-in-work-and-codex); [Using Codex with your ChatGPT plan](https://help.openai.com/en/articles/11369540-icodex-in-chatgpt); [discussão da comunidade com resposta da OpenAI](https://community.openai.com/t/is-a-codex-free-vs-plus-limits-comparison-possible/1382408).

## 3. A OpenAI não publica CPU/RAM fixos dos containers de tarefa cloud?

**FACT com qualificação.** Para o produto Codex Cloud, as páginas públicas descrevem um container/sandbox isolado, mas não prometem uma classe fixa de CPU/RAM por tarefa. Logo, uma afirmação de “especificações fixas publicadas” é `CONTRADITO`. Contudo, a API de Containers é outro produto: nela a OpenAI publica opções de memória (`1g`, `4g`, `16g`, `64g`) e default de `1g`; isso não prova que essas opções sejam as mesmas do executor interno do Codex Cloud, nem fornece CPU.

Fontes: [system card sobre sandbox cloud](https://cdn.openai.com/pdf/97cc5669-7a25-4e63-b15f-5fd5bdc4d149/gpt-5-codex-system-card.pdf); [API Containers — create](https://developers.openai.com/api/reference/cli/resources/containers/methods/create).

## 4. Codex Cloud suporta tarefas paralelas, isoladas?

**FACT — confirmado.** O lançamento oficial descreve várias tarefas em paralelo, cada uma processada independentemente num ambiente isolado pré-carregado com o repositório. A documentação administrativa atual confirma tarefas concorrentes e ambientes GitHub; a página Codex também descreve cloud environments e worktrees para trabalho paralelo.

Fontes: [Introducing Codex](https://openai.com/index/introducing-codex/); [guia de administração Enterprise](https://help.openai.com/en/articles/11390924); [página Codex](https://openai.com/codex/).

## 5. Como a comunidade usa/configura e quais são as limitações práticas?

**FACT — sinais recentes, mas não uma especificação contratual.** A discussão pública mostra uso centrado em GitHub, worktrees/branches separados e delegação de tarefas de teste, correção e revisão. As reclamações recorrentes são limites difíceis de prever, consumo dependente de contexto/modelo/MCP e redução abrupta de capacidade quando limites de cinco horas ou semanais mudam. Um tópico recente relata utilizadores a atingir o limite muito mais depressa após alterações de rate limits; outro descreve a necessidade prática de criar worktrees separados para conversas paralelas.

**NOT_PROVEN:** a amostra comunitária não permite afirmar uma “configuração padrão” universal, nem medir disponibilidade regional, latência ou fiabilidade do serviço. Reddit ficou com cobertura parcial no `last30days` (RSS/keyless e resultados incompletos); não tratei ausência de resultados como ausência de queixas.

Fontes: [Codex Rate Limits Discussion Thread](https://community.openai.com/t/codex-rate-limits-discussion-thread/1378553); [Branch Workspaces: native worktrees](https://community.openai.com/t/branch-workspaces-native-git-worktree-management-for-parallel-codex-tasks/1384924); [Using credits](https://help.openai.com/en/articles/12642688-using-credits-for-flexible-usage-in-chatgpt-freego-pluspro-sora).

## 6. Existe um “executor local vs cloud” configurável como no texto?

**CONTRADITO / INFERENCE.** Não encontrei, na documentação pública, uma API ou configuração chamada `executor` que permita ao Maestri selecionar um backend local ou o executor Codex Cloud com uma única abstração. Existem superfícies distintas: CLI/IDE local, app Codex, delegação cloud e worktrees. A extensão IDE permite criar/acompanhar tarefas cloud e trazê-las para o ambiente local, mas isso não equivale a um parâmetro de executor documentado. Portanto, o conceito pode ser uma convenção arquitetural interna da Lumenva, mas não deve ser apresentado como capacidade nativa da API OpenAI.

Fontes: [CLI local](https://help.openai.com/en/articles/11096431); [upgrades do Codex e movimento cloud/local](https://openai.com/index/introducing-upgrades-to-codex/); [referência pública da API](https://developers.openai.com/api/reference/cli/resources/containers).

## 7. Compatibilidade com Maestri e API/CLI externa para orquestrar Codex Cloud?

**FACT parcial + NOT_PROVEN para a integração proposta.** Codex Cloud integra-se oficialmente com GitHub Cloud: conecta repositórios, cria ambientes e pode abrir/pushar pull requests conforme as permissões. Isso permite um fluxo Maestri → GitHub → Codex via artefactos/PRs, desde que Maestri opere GitHub.

**NOT_PROVEN / não encontrado:** não há documentação pública de uma API específica de “criar tarefa Codex Cloud”, consultar o estado dessa tarefa e escolher o seu sandbox a partir de um orquestrador externo como Maestri. A OpenAI oferece a Responses API e a API genérica de Containers, que permitem construir um agente próprio, mas isso não é a API do produto Codex Cloud nem garante os mesmos ambientes, limites ou integração GitHub. A CLI oficial documentada para Codex é local; a referência de API pública expõe `responses` e `containers`, não recursos `codex/tasks` cloud.

Fontes: [guia Enterprise (GitHub e ambientes)](https://help.openai.com/en/articles/11390924); [GitHub + ChatGPT/Codex](https://help.openai.com/en/articles/11145903); [Responses API](https://developers.openai.com/api/reference/cli/resources/responses/methods/create); [Containers API](https://developers.openai.com/api/reference/cli/resources/containers).

## Recomendação

**Híbrido, mas sem dependência de orquestração Cloud agora.** Manter Maestri a controlar CLI local no Mac/worker Linux para execução verificável, segredos, gates e provas de SHA. Usar Codex Cloud como superfície opcional para tarefas GitHub isoladas, paralelas e de baixo risco, com PR/revisão humana. Não substituir o worker por Cloud nem prometer um `executor=cloud` até existir uma API oficial de tarefas/orquestração e uma prova ponta a ponta no repositório Lumenva.

Estado final: os pontos 1 e 4 estão confirmados; o ponto 2 está confirmado apenas como pool partilhado com limites variáveis; o ponto 3 é confirmado com a qualificação indicada; o ponto 5 tem sinais comunitários mas cobertura parcial; os pontos 6 e 7 não sustentam a abstração/API descrita. O texto original continua `NOT_PROVEN` porque não estava presente.

## Pesquisa aprofundada: CLI, ambientes e estado local (12-09-2026)

### 1. Documentação oficial e comandos disponíveis

**FACT — confirmado no CLI instalado e na documentação pública.** O `codex-cli` local é a superfície que expõe `codex cloud`. A versão instalada é `0.154.0`; `codex cloud --help` lista:

- `exec`: submete uma tarefa sem abrir a TUI;
- `status <TASK_ID>`: consulta estado;
- `list`: lista tarefas, com `--env`, `--limit`, `--cursor` e `--json`;
- `diff <TASK_ID>`: mostra diff unificado;
- `apply <TASK_ID>`: aplica o diff localmente.

`codex cloud exec --help` exige `--env <ENV_ID>` e aceita prompt, `--branch` (por omissão, branch atual) e `--attempts`. Isto é diferente de uma API pública que aceite apenas nome de repositório. O identificador de ambiente é pré-requisito para submissão.

**FACT — ambientes na API OpenAI, com escopo diferente.** A documentação Developers atual também expõe `agent.environment` (`openai_hosted` ou `self_hosted`), templates reutilizáveis, env vars, ficheiros, packages, setup commands confidenciais, network policy, skills e plugins. Esta é uma API beta de ambientes de agentes; a documentação não afirma que seja o mesmo catálogo de ambientes GitHub mostrado pelo produto Codex Cloud no CLI/UI.

Fontes: [API de ambientes de agentes](https://developers.openai.com/api/reference/typescript/resources/beta/subresources/agents/subresources/environments/methods/retrieve); [criar template de ambiente](https://developers.openai.com/api/reference/go/resources/beta/subresources/agents/subresources/environments/subresources/templates/methods/create); [API de ficheiros de ambiente](https://developers.openai.com/api/reference/python/resources/beta/subresources/agents/subresources/environments/subresources/files/methods/create).

### 2. Requisitos de configuração, secrets e permissões

**FACT — GitHub Cloud e autorização são necessários para ambientes Codex Cloud no produto.** O guia oficial de administração diz que Codex Cloud usa GitHub como sistema SCM cloud-hosted, requer ligar a conta/organização GitHub, escolher repositórios autorizados e criar um ambiente. Utilizadores só podem operar ambientes públicos ou aqueles para os quais têm acesso. A possibilidade de criar/pushar PRs depende das permissões GitHub.

**FACT — secrets e setup devem ser tratados como configuração de ambiente, não como texto do prompt.** Nos ambientes de agentes da API, env vars, setup commands e ficheiros são campos de configuração; setup commands são confidenciais e não são devolvidos nas respostas. A referência permite rede desativada ou allowlist por domínio. Não encontrei documentação que permita obter secrets do ambiente Codex Cloud através de `codex cloud list/status/diff`.

**NOT_PROVEN:** não há, nas páginas consultadas, uma matriz pública completa de quais env vars/secrets são suportados pelo ambiente GitHub específico do Codex Cloud, nem um comando CLI documentado para criar ou editar esse ambiente. O `--env` do CLI apenas seleciona um `ENV_ID` já existente.

Fontes: [guia Enterprise de ambientes e GitHub](https://help.openai.com/en/articles/11390924); [templates com env/setup/network](https://developers.openai.com/api/reference/go/resources/beta/subresources/agents/subresources/environments/subresources/templates/methods/create); [GitHub e Codex](https://help.openai.com/en/articles/11145903).

### 3. Estado observado neste Mac

**FACT — autenticado.** `codex cloud list --json --limit 20` terminou com exit code 0 e devolveu tarefas reais, portanto a sessão local está autenticada/autorizada para leitura do serviço. Não expus tokens nem conteúdo de credenciais.

**FACT — há histórico de tarefas associadas ao repositório Lumenva/CRM.** A listagem mostra o label de ambiente `trydavidqix/CRMDeskcommCRM Testes Pesados` e tarefas como “Run full cloud validation on Lumenva branch”, “Confirm cloud checkout identity” e “Run validation commands and generate report”. Também há tarefas no ambiente `trydavidqix/Teacher`.

**FACT — não foi provado um `ENV_ID` explícito nem um ambiente chamado Lumenva.** Nos 20 itens devolvidos, `environment_id` é `null`; só existe `environment_label`. Portanto, o estado permite confirmar histórico e associação nominal ao projeto CRM/Lumenva, mas não permite confirmar, por este comando, um identificador de ambiente reutilizável para `codex cloud exec --env ...`. Não executei `exec`, `apply`, `diff` ou qualquer operação mutável.

**FACT — o help local não documenta criação de ambientes.** Não há subcomando `environment create` em `codex cloud --help`; a criação/gestão parece ocorrer na UI/integração GitHub ou em APIs beta separadas.

### 4. Uso prático e recomendação operacional

**FACT — confirmado por documentação e relatos comunitários recentes.** Os padrões observados são: uma tarefa por branch/worktree; prompts orientados a um resultado verificável; execução de testes/linters dentro do sandbox; revisão do diff e PR antes de integrar. Relatos no fórum OpenAI descrevem limites de uso que dependem de modelo, tamanho de prompt, contexto, MCP e duração, além de utilizadores que atingem limites muito mais cedo após alterações de rate limits. A pesquisa `last30days` foi executada com Reddit/GitHub/YouTube/web, mas ficou parcialmente limitada por fontes keyless e timeouts de YouTube; logo, estes sinais são direcionais, não uma amostra estatística.

**INFERENCE — formato recomendado para Lumenva.** Dividir uma tarefa grande em fatias independentes, cada uma com branch própria, objetivo fixo, critérios de aceitação, comandos permitidos e condição explícita de “não tocar fora do escopo”. Submeter em paralelo apenas fatias sem dependência de estado ou ficheiros partilhados. Cada prompt deve repetir o objetivo/goal, SHA ou branch de base, paths permitidos, testes obrigatórios e formato de relatório. A integração deve ser por diff/PR revisto; `status READY` ou existência de URL nunca substitui validar diff, testes e SHA.

**ASSUMPTION — a arquitetura híbrida continua a ser a opção segura.** Para Maestri, manter execução local no worker quando há segredos, migrações, gates de produção ou necessidade de prova direta. Usar Codex Cloud para análise, testes, documentação e patches isolados no GitHub. Antes de automatizar submissões em massa, é necessário obter/provar um `ENV_ID` estável e uma política de permissões/secrets; a sessão atual não fornece essa prova.
