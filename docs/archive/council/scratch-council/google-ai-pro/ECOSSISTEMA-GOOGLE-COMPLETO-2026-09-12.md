# Ecossistema Google para a Lumenva

Data: 2026-09-12. Conta considerada: Google AI Pro pessoal/estudante. Cada item abaixo foi verificado contra documentação Google atual; a análise externa não foi usada como evidência.

## Veredito curto

O melhor retorno imediato não é migrar banco ou infraestrutura. É testar **Gemini API como provider secundário controlado**, **Workspace APIs/MCP para Calendar/Sheets/Drive/Gmail**, e um pequeno worker **Cloud Run ou Cloud Run functions** com Pub/Sub/Scheduler. O crédito de US$10/mês pode abater qualquer produto Google Cloud, mas não cria isolamento, SLA ou orçamento ilimitado. Produção continua precisando de billing guardrails, observabilidade e dono.

## Matriz de validação

| Item | Gratuito/barato e quota confirmada | MCP/CLI oficial | Julgamento para Lumenva |
|---|---|---|---|
| Gemini API / Vertex AI | Gemini API tem Free Tier para modelos selecionados, com limites por modelo em RPM/TPM/RPD; quotas devem ser vistas no AI Studio. Free Tier pode usar conteúdo para melhoria; Paid Tier dá limites maiores e opt-out. O crédito AI Pro de US$10 é separado e pode pagar Google Cloud/Vertex. | `gcloud` é oficial para Cloud; SDKs oficiais Gemini/Vertex. MCP oficial específico para Gemini API não foi confirmado. | **TESTAR JÁ** como fallback de baixo volume, com roteamento explícito, timeout, limite de gasto, redaction e sem dados sensíveis por padrão. Não substituir Anthropic/OpenAI sem benchmark e política de dados. |
| Gmail API | API sem custo adicional dentro de quotas; para projetos novos, 1.200.000 unidades/min/projeto, 6.000 unidades/min/usuário e limiar diário de 80.000.000 unidades antes de futura cobrança; `send` custa 100 unidades. Há limite de 500 destinatários/mensagem e requisitos de OAuth/escopos. | API oficial e `gcloud`; Gmail MCP remoto oficial em Developer Preview. | **TESTAR JÁ**, mas somente OAuth mínimo, leitura de labels/threads e criação de drafts. Envio automático exige consentimento, auditoria e limites. Conta Gmail pessoal não equivale a Workspace de equipe. |
| Google Sheets API | Uso padrão sem custo adicional; 300 leituras/min/projeto e 300 escritas/min/projeto; 60 leituras e 60 escritas/min/usuário/projeto. Payload recomendado até 2 MB e backoff exponencial. | API oficial, `gcloud`; Sheets MCP remoto oficial em Developer Preview. | **TESTAR JÁ** para import/export de leads e relatórios, não como sistema de registro do CRM. Usar `drive.file` quando possível, não `drive` amplo. |
| Google Drive API | API oficial; quotas atuais são quota-units por método e modelo de egress, não uma cota única universal. A documentação anuncia limite de egress de 1 TB/dia para usuários Workspace. | API oficial, `gcloud`; Drive MCP remoto oficial em Developer Preview. | **TESTAR JÁ** para documentos e anexos selecionados. Não usar Drive como storage transacional nem conceder acesso irrestrito. |
| Google Calendar API | API oficial v3, com quotas por projeto/usuário e mudanças de modelo anunciadas; números dependem do método e projeto. | API oficial, `gcloud`; Calendar MCP remoto oficial em Developer Preview, com `create_event`, `list_events`, `search_events`, `suggest_time` etc. | **TESTAR JÁ** para agenda e follow-up comercial. É o caso de uso mais direto do CRM, com escopo OAuth e confirmação humana antes de criar/cancelar eventos. |
| Cloud Storage | Free Tier: 5 GB-mês Standard, 5.000 operações Classe A, 50.000 Classe B e 100 GB/mês de saída da América do Norte para destinos elegíveis; somente regiões US específicas. | `gcloud storage` é CLI oficial recomendado; `gsutil` é legado e será desacoplado após março de 2027. MCP Storage específico não foi confirmado. | **DEPOIS** como bucket de backup/objetos grandes. Não substituir Supabase Storage agora: exige desenho de IAM, URLs assinadas, lifecycle, criptografia, retenção e restauração. |
| Cloud Run | Free Tier request-based: 2 milhões de requests/mês; cobrança adicional pode ocorrer por computação, rede, build e serviços associados. | `gcloud` oficial; MCP específico não confirmado. | **TESTAR JÁ** para webhook/worker stateless pequeno, com orçamento e concorrência limitados. Mais simples e menos operacional que VPS. |
| Cloud Run functions / Cloud Functions | Free Tier publicado: 2 milhões de invocações/mês; ainda há cobrança de compute, rede e outros recursos. | `gcloud` oficial; MCP específico não confirmado. | **TESTAR JÁ/DEPOIS**: bom para adaptadores pequenos. Preferir Cloud Run quando o serviço já é HTTP/Node contínuo; não criar duas plataformas sem necessidade. |
| Cloud Scheduler | 3 jobs gratuitos por conta de billing/mês; depois US$0,10 por job por 31 dias. Execuções não são cobradas separadamente. | `gcloud scheduler` oficial; MCP específico não confirmado. | **TESTAR JÁ** junto com um endpoint Cloud Run para lembretes/reconciliação. Três jobs cobrem um piloto real. |
| Pub/Sub | Primeiros 10 GiB de throughput Message Delivery Basic por mês gratuitos por conta de billing. | `gcloud` oficial; MCP específico não confirmado. | **TESTAR JÁ** para desacoplar webhook e tarefas assíncronas se o piloto precisar de retry/fila. Não introduzir antes de existir uma segunda etapa assíncrona real. |
| Cloud SQL | Não há instância permanente Free Tier. Existe free trial PostgreSQL de 30 dias, uma instância por projeto, exige billing e não tem SLA; após o trial para de servir se não fizer upgrade. | `gcloud sql` oficial; MCP específico não confirmado. | **NÃO AGORA**. A Lumenva já tem caminho Postgres/Supabase; Cloud SQL paralelo é custo e migração sem dor concreta. |
| Firestore | Free Tier: 1 GiB, 50.000 reads/dia, 20.000 writes/dia, 20.000 deletes/dia e 10 GiB/mês de saída; somente uma base por projeto recebe o free tier. TTL/PITR/backups/restore/clone não têm uso gratuito. | `gcloud`/Firebase CLI oficiais; MCP Firestore específico não confirmado. | **NÃO AGORA** para CRM relacional. Só faz sentido para um componente documental/offline específico, com modelo separado e aceitação da consistência/consultas NoSQL. |
| Vision API | Free Tier: 1.000 unidades/mês. | APIs/SDKs e `gcloud` oficiais; MCP específico não confirmado. | **DEPOIS** para OCR de documentos/anexos se houver volume e dor medida. Não ativar pipeline de imagem genérico. |
| Speech-to-Text | Free Tier: 60 minutos/mês. | APIs/SDKs e `gcloud` oficiais; MCP específico não confirmado. | **TESTAR DEPOIS** no pipeline de voz pendente, com áudio de teste redigido. Comparar custo/latência/idiomas contra fornecedor atual antes de trocar. |
| Text-to-Speech | Primeiros 4 milhões de caracteres/mês em vozes Standard e 1 milhão em WaveNet são gratuitos; além disso cobra por milhão de caracteres. | APIs/SDKs e `gcloud` oficiais; MCP específico não confirmado. | **TESTAR DEPOIS** para protótipo de voz. Não é prova de adequação para telefonia em tempo real; ainda faltam carrier, RTP, latência e governança. |
| Cloud CDN / Load Balancing | Não há Free Tier equivalente ao e2-micro. CDN cobra cache lookup, cache fill e transferência; Load Balancing cobra forwarding rules (primeiras 5 a US$0,025/h) e processamento (ex.: US$0,008/GiB em regiões publicadas). | `gcloud compute` oficial; MCP específico não confirmado. | **NÃO AGORA**. Over-engineering para o estágio atual; usar CDN/LB gerenciado do host de aplicação até existir necessidade de tráfego, HA ou domínio multi-região. |
| NotebookLM | Produto de pesquisa/documentos com limites de uso do produto; não encontrei quota de API pública nem MCP/CLI oficial para incorporar ao CRM. | MCP/CLI oficial para integração backend não confirmado. | **USO MANUAL/DEPOIS** para análise interna de blueprint, contratos e documentação. Não colocar no caminho transacional nem enviar dados de clientes sem política explícita. |
| Google Colab | Ambiente de notebooks; disponibilidade de compute, GPU/TPU e duração varia por tipo de conta e sessão. Não é worker persistente nem SLA. | `gcloud` não controla uma sessão Colab como serviço; MCP/CLI oficial de automação de notebooks não confirmado. | **USO MANUAL** para experimento pesado ocasional, OCR/transcrição batch ou análise. Não usar para jobs CRM, produção ou credenciais persistentes. |
| Google Cloud Developer Plugin para agentes | Anunciado em setembro de 2026 como plugin com docs Cloud, onboarding, receitas de autenticação e guardrails de `gcloud`; é ferramenta de desenvolvimento, não runtime. | Plugin/CLI do ecossistema Google, mas não substitui API/MCP de cada serviço. | **DEPOIS**: útil no setup humano de Cloud/Antigravity, não uma dependência do produto Lumenva. |

## Workspace e conta pessoal: limite importante

As APIs Gmail/Drive/Sheets/Calendar existem independentemente de uma assinatura Google AI Pro, mas acesso a dados exige um projeto Cloud, OAuth consent screen, scopes e autorização do usuário. “Google AI Pro” não concede automaticamente uma caixa Workspace corporativa, delegação de domínio, conta de serviço ou permissões multiusuário. O Google Workspace MCP remoto existe oficialmente, mas está em **Developer Preview**; cada produto tem endpoint MCP próprio e herda permissões OAuth.

## MCP e CLI: decisão prática

- CLI oficial transversal: **Google Cloud CLI (`gcloud`)**, incluindo compute, storage, Cloud Run, functions, SQL, Pub/Sub e Scheduler.
- MCP oficial confirmado: **Gmail, Drive, Docs, Sheets, Slides, Calendar, Chat e People**, todos em Developer Preview, via endpoints `*.mcp.googleapis.com/mcp/v1`.
- Para Gemini API, Vision, Speech, TTS, Firestore, Cloud SQL, Cloud Run, Pub/Sub e Scheduler, encontrei APIs/SDKs/`gcloud`, mas não uma promessa oficial de MCP remoto equivalente. Não construir wrappers “MCP oficiais” por inferência; se a regra da Lumenva exigir MCP para esses serviços, registrar como wrapper próprio futuro.

## Plano filtrado para a Lumenva

### Testar já - baixo risco e dor real

1. **Calendar API + Sheets API**, em um projeto sandbox e OAuth mínimo: criar eventos de teste e sincronizar uma pequena tabela de leads. Sheets permanece export/relatório; CRM/Postgres permanece fonte de verdade.
2. **Cloud Run + um Scheduler** para um worker HTTP simples e um job periódico, usando o crédito mensal e alertas de billing.
3. **Gemini API Free Tier** como provider de backup apenas para tarefas não sensíveis e de baixa taxa. Medir qualidade, latência, limites, custo e política de retenção antes de rotear tráfego real.
4. **Pub/Sub** somente se o worker demonstrar necessidade de retry/fila; começar com um tópico e dead-letter/observabilidade adequados.
5. **Gmail MCP/API em modo draft/read-only**, sem envio automático, depois de validar OAuth e consentimento.

### Interessante, mas deixar para depois

- Cloud Storage como backup secundário de objetos, com retenção e restauração testadas.
- Speech-to-Text/Text-to-Speech para o pipeline de voz pendente, após fechar carrier/telefonia e medir amostras reais.
- Vision para OCR, somente quando houver documentos e volume que justifiquem.
- Colab e NotebookLM para tarefas manuais de análise e pesquisa.
- Antigravity/Developer Plugin como ferramentas de engenharia assistida, não como infraestrutura do produto.

### Não serve agora

- Cloud SQL ou Firestore como segundo banco do CRM.
- CDN/Load Balancing próprios antes de escala e requisito de HA.
- Firebase Studio como plataforma nova: criação de workspaces está desativada e há sunset anunciado.
- Colab, Jules ou NotebookLM como workers persistentes/produção.
- Afirmar que qualquer quota gratuita é SLA, isolamento, backup ou orçamento máximo.

## Fontes oficiais consultadas

- Gemini API rate limits: https://ai.google.dev/gemini-api/docs/rate-limits
- Gemini API pricing/free tier: https://ai.google.dev/gemini-api/docs/pricing
- Gemini API billing/quota: https://ai.google.dev/gemini-api/docs/billing
- Google AI Pro / Developer Program plans: https://developers.google.com/program/plans-and-pricing
- Google Cloud Free Tier (Compute, Run, Functions, Storage, Pub/Sub, Firestore, Vision, Speech): https://cloud.google.com/free/docs/free-cloud-features
- Gmail quotas: https://developers.google.com/workspace/gmail/api/reference/quota
- Sheets quotas: https://developers.google.com/workspace/sheets/api/limits
- Sheets scopes: https://developers.google.com/workspace/sheets/api/scopes
- Workspace MCP servers: https://developers.google.com/workspace/guides/configure-mcp-servers
- Cloud CLI: https://cloud.google.com/cli
- Cloud Storage CLI transition: https://docs.cloud.google.com/storage/docs/gsutil-transition-to-gcloud
- Cloud Scheduler pricing: https://cloud.google.com/scheduler/pricing
- Pub/Sub pricing: https://cloud.google.com/pubsub/pricing
- Firestore quotas: https://docs.cloud.google.com/firestore/quotas
- Cloud SQL free trial: https://docs.cloud.google.com/sql/docs/postgres/free-trial-instance
- Text-to-Speech: https://cloud.google.com/text-to-speech
- Cloud CDN pricing: https://cloud.google.com/cdn/pricing
- Load Balancing pricing: https://cloud.google.com/load-balancing/pricing
- Firebase Studio limits/sunset: https://firebase.google.com/docs/studio/pricing e https://firebase.google.com/docs/studio/migrating-project
- Google Antigravity codelab: https://codelabs.developers.google.com/getting-started-google-antigravity

## Evidência comunitária e limites

O `last30days` v3.19.0 foi executado para 2026-08-13–2026-09-12 com Reddit, Hacker News, GitHub e YouTube. Devolveu 64 itens, mas Reddit ficou parcial por HTTP 429, Web ficou indisponível e YouTube não retornou vídeos na janela; os clusters foram majoritariamente notícias gerais sobre Google, não experiências específicas de cada API. Isso é evidência de cobertura limitada, não de ausência de uso.

O sinal comunitário aproveitável foi operacional: discussões recentes destacaram o Google Cloud Developer Plugin, problemas de cobrança/conta em ofertas AI Pro e interesse em agentes de código; não forneceram base suficiente para declarar quotas, SLA ou confiabilidade de produção. A decisão acima usa números e disponibilidade apenas quando confirmados em documentação oficial.

**Limite de prova:** não foram criados projetos, vinculadas contas de billing, resgatados créditos, concedidos scopes OAuth, chamadas APIs, enviados dados da Lumenva ou medidos custos/runtime. Quotas e preços podem mudar; confirmar no console antes de qualquer ativação.
