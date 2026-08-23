# Plano Mestre — Implementação Tokens

**Data:** 2026-08-23  
**Branch:** `implementacao-tokens`  
**Base:** `main`  
**Objetivo:** transformar o CRM num atendente multimodal omnichannel 24/7, com memória persistente por cliente, WhatsApp, voz/telefonia, roteamento econômico de modelos e fallback humano, reaproveitando ao máximo a infraestrutura já existente no projeto.

---

## 1. Visão do produto

O produto final não é um simples bot de WhatsApp. A meta é ter um **funcionário virtual de IA dentro do CRM** capaz de:

- atender WhatsApp 24/7;
- receber e compreender texto, imagem, áudio, vídeo, PDF e sticker;
- atender chamadas telefônicas por voz em tempo real;
- reconhecer clientes recorrentes pelo telefone;
- recuperar memória persistente e preferências;
- consultar CRM, catálogo, pedidos, agenda, estoque e outras ferramentas;
- criar pedidos/agendamentos quando autorizado;
- fornecer estimativas baseadas em dados reais;
- enviar confirmações por WhatsApp;
- transferir para humano quando necessário;
- usar modelos gratuitos primeiro e modelos pagos apenas como fallback ou quando a tarefa justificar;
- operar em arquitetura multiempresa, com isolamento por organização.

---

## 2. Arquitetura macro

```text
                         CLIENTE
                            │
              ┌─────────────┴─────────────┐
              │                           │
          WHATSAPP                    TELEFONE
              │                           │
      WAHA / Meta API              número atual
              │                           │
              │                    encaminhamento
              │                           │
              │                        TELNYX
              │                           │
              │                      LIVEKIT
              └─────────────┬─────────────┘
                            │
                       IDENTIDADE
                            │
                 telefone → cliente
                            │
                            ▼
              ┌─────────────────────────┐
              │    CUSTOMER MEMORY      │
              │ nome / morada           │
              │ preferências            │
              │ pedidos anteriores      │
              │ resumo recente          │
              └────────────┬────────────┘
                           │
                           ▼
                 ┌──────────────────┐
                 │     AGENT OS     │
                 │ atendimento      │
                 │ vendas           │
                 │ supervisor       │
                 │ escalation       │
                 └────────┬─────────┘
                          │
            ┌─────────────┼─────────────┐
            │             │             │
           CRM         ferramentas    memória
            │             │             │
        clientes       pedidos        histórico
        produtos       agenda         preferências
        leads          estoque        contexto
                          │
                          ▼
                    MODEL ROUTER
                          │
             ┌────────────┼─────────────┐
             │            │             │
         modelos        modelos       modelo pago
          FREE           FREE         emergência
             │            │               │
             └────────────┴───────────────┘
```

---

## 3. Princípio central de economia de tokens

A arquitetura não deve enviar o histórico completo do cliente a cada turno.

O sistema deve trabalhar com duas camadas:

### 3.1 Memória rápida

Contexto curto, estruturado e barato de enviar ao modelo:

- nome;
- telefone;
- morada atual;
- preferências relevantes;
- pedido habitual;
- último pedido;
- resumo recente;
- observações importantes;
- flags de atendimento.

### 3.2 Histórico completo

Somente consultado quando realmente necessário:

- pedidos antigos;
- conversas WhatsApp;
- chamadas;
- reclamações;
- alterações de morada;
- tickets;
- eventos e decisões anteriores.

### 3.3 Exemplo

```text
Cliente: David
Telefone: +351 ...
Morada: Rua X
Pedido habitual: Pepperoni grande + bebida
Preferência: sem cebola
Último pedido: quarta-feira passada
Resumo: cliente recorrente; costuma repetir o pedido semanalmente
```

Ao ligar novamente:

```text
IA: "David, quer o mesmo pedido da semana passada?"
Cliente: "Sim."
IA: "Continua para a Rua X?"
Cliente: "Sim."
IA cria o pedido e informa a estimativa real.
```

---

## 4. Estratégia de reaproveitamento do CRM existente

A implementação deve evitar reconstruir o que já existe.

### 4.1 Reaproveitar da `main`

- WhatsApp via WAHA;
- abstração de canais;
- ingestão e envio de mídia;
- armazenamento `whatsapp-media`;
- imagem;
- áudio;
- vídeo;
- PDF;
- sticker;
- Whisper/transcrição;
- derivação multimodal;
- FFmpeg e extração de áudio/frames;
- Inbox multimodal;
- respostas em mídia;
- Meta/WhatsApp oficial onde já existir;
- mecanismos existentes de pacing/anti-ban.

### 4.2 Reaproveitar seletivamente das branches Agent OS

Sem merge bruto. Trazer apenas o que fizer sentido, com adaptação e testes:

- Agent Kernel;
- agente `atendimento`;
- `sales`;
- `retention`;
- `supervisor`;
- `escalation`;
- `crm-operator`;
- políticas de autonomia;
- Tool Gateway;
- Registry;
- observabilidade;
- evals/shadow testing;
- memória multi-turno;
- model router;
- fallback de providers;
- métricas de custo/latência/qualidade;
- learning flywheel apenas quando a base estiver estável.

### 4.3 Regra de integração

Não fazer merge direto das branches Agent OS na `main` sem inventário e comparação. As branches evoluíram em paralelo e estão divergidas.

A integração deve ser seletiva, por módulo, com testes e evidência.

---

# Fases de implementação

## Fase 1 — Unificação da arquitetura existente

Objetivo: criar uma base única do atendimento sem duplicação.

### Entregas

- inventário dos módulos relevantes em `main` e nas branches Agent OS;
- mapa de dependências;
- decisão do que reaproveitar, adaptar ou descartar;
- contrato único para agentes, ferramentas, memória e providers;
- nenhuma regressão no WhatsApp multimodal existente;
- documentação da arquitetura final.

### Gate

Nenhuma implementação nova de voz/modelos começa antes de o caminho central do Agent OS estar compatível com o runtime atual do CRM.

---

## Fase 2 — Customer Memory Layer

Objetivo: cada cliente ter memória persistente e barata de recuperar.

### Modelo conceitual

```text
Organização
└── Cliente
    ├── identidade
    ├── telefones
    ├── moradas
    ├── preferências
    ├── pedido habitual
    ├── últimos pedidos
    ├── resumo de relacionamento
    ├── WhatsApp
    ├── ligações
    └── eventos importantes
```

### Requisitos

- identificação por telefone;
- memória isolada por organização;
- resumo compacto para prompt;
- histórico bruto separado;
- atualização após atendimento;
- deduplicação de clientes;
- controle de informação conflitante;
- confirmação de campos que podem ter mudado, como morada;
- auditoria de alterações automáticas.

### Economia de tokens

O modelo recebe primeiro apenas a memória rápida. Histórico detalhado vira uma ferramenta sob demanda.

---

## Fase 3 — Model Router econômico

Objetivo: usar os modelos mais baratos/gratuitos possíveis sem comprometer disponibilidade.

### Estratégia

```text
Tarefa simples
→ modelo free rápido

Tarefa complexa
→ melhor free compatível

Imagem/vídeo
→ modelo multimodal

Provider free indisponível
→ fallback free

Todos free indisponíveis
→ modelo pago barato

Caso crítico
→ modelo premium, se política permitir
```

### Providers inicialmente candidatos

- OpenRouter;
- Ox Alpha enquanto disponível/gratuito;
- OpenRouter Free Router;
- Gemini Free Tier para multimodal;
- NVIDIA Free Endpoints quando apropriado;
- Cloudflare Workers AI free tier;
- outros providers aprovados futuramente.

### Requisitos do router

- capabilities por modelo;
- custo;
- latência;
- disponibilidade;
- qualidade;
- contexto máximo;
- fallback chain;
- circuit breaker;
- rate-limit awareness;
- observabilidade por organização;
- política de nunca ficar preso a um único provider gratuito.

---

## Fase 4 — WhatsApp 24/7 autônomo

Objetivo: transformar a infraestrutura multimodal existente em atendimento realmente operacional.

### Entradas

- texto;
- imagem;
- áudio;
- vídeo;
- PDF;
- sticker.

### Fluxo

```text
mensagem recebida
→ resolve organização
→ resolve cliente
→ carrega Customer Memory
→ deriva mídia quando necessário
→ Agent OS decide
→ chama ferramentas autorizadas
→ responde
→ atualiza memória
→ registra observabilidade
```

### Requisitos

- fallback humano;
- nunca inventar dados de negócio;
- baixa confiança deve escalar ou pedir confirmação;
- suportar continuidade de conversa;
- custo/token tracking;
- fallback automático de modelos.

---

## Fase 5 — Voice AI local ao Agent OS

Objetivo: validar conversa de voz antes de ligar à PSTN.

### Pipeline

```text
fala do cliente
→ STT
→ Agent OS
→ LLM
→ TTS
→ fala ao cliente
```

### Requisitos de experiência

- baixa latência;
- barge-in/interrupção natural;
- detecção de silêncio;
- nomes e números;
- leitura e confirmação de moradas;
- robustez a sotaques e ruído;
- repetição quando confiança baixa;
- contexto compartilhado com WhatsApp.

### Estratégia de custo

- preferir STT/TTS self-hosted quando qualidade for suficiente;
- LLM via router econômico;
- LiveKit apenas quando entrar a fase de telefonia real.

---

## Fase 6 — Telefonia gerenciada

**Decisão:** usar solução paga/gerenciada; não usar portabilidade.

### Stack

- Telnyx para número virtual/SIP/PSTN;
- LiveKit Cloud para voz em tempo real;
- Agent OS como cérebro;
- Customer Memory compartilhada;
- CRM como fonte de verdade.

### Fluxo

```text
número atual da empresa
→ encaminhamento da operadora atual
→ número técnico Telnyx
→ SIP
→ LiveKit
→ Voice Agent
→ Agent OS
```

### Regra comercial

O consumidor final continua ligando para o número tradicional da empresa. O número Telnyx funciona apenas como destino técnico do encaminhamento.

### Modos de operação por organização

- IA sempre;
- IA apenas quando ninguém atende;
- IA fora do horário;
- IA em overflow/linha ocupada;
- modos futuros configuráveis.

---

## Fase 7 — Reconhecimento instantâneo de cliente

Objetivo: identificar automaticamente quem está ligando.

### Fluxo

```text
Caller ID
→ normalização do telefone
→ organização
→ cliente
→ Customer Memory
→ contexto do Agent OS
```

### Comportamento

Cliente conhecido:

> "David, quer repetir o pedido da semana passada?"

Cliente desconhecido:

- criar/associar contacto;
- coletar apenas os dados necessários;
- salvar memória progressivamente.

---

## Fase 8 — Ferramentas de negócio

Objetivo: o agente executar ações reais em vez de apenas conversar.

### Ferramentas potenciais

- consultar catálogo/menu;
- consultar preços;
- consultar estoque/disponibilidade;
- consultar pedido;
- criar pedido;
- alterar pedido;
- cancelar quando permitido;
- consultar agenda;
- agendar;
- abrir ticket;
- registrar lead;
- enviar confirmação por WhatsApp;
- consultar prazo;
- consultar regras da empresa.

### Segurança

Toda ação deve passar pelo Tool Gateway e pelas políticas de autonomia/permissão da organização.

---

## Fase 9 — Pedidos e ETA

Objetivo: fornecer tempo estimado real e fechar fluxos comerciais completos.

### Exemplo pizzaria

```text
pedido
→ disponibilidade de produtos
→ fila atual
→ tempo médio de preparação
→ entrega ou retirada
→ região/distância quando aplicável
→ ETA
```

### Regra

O modelo não inventa ETA. O Agent OS recebe o tempo de uma ferramenta/regra determinística.

---

## Fase 10 — Escalonamento humano

Objetivo: sempre existir saída segura para humano.

### Gatilhos

- cliente pede humano;
- confiança baixa;
- situação sensível;
- reclamação grave;
- ferramenta falha;
- política exige aprovação;
- risco de dano comercial;
- repetidas falhas de entendimento.

### Voz

Suportar transferência via LiveKit/Telnyx, idealmente com contexto/resumo entregue ao atendente.

### WhatsApp

Transferir controle da conversa no CRM para humano sem perder histórico/memória.

---

## Fase 11 — Geração de imagem e vídeo

Objetivo: adicionar criação de mídia sem misturar isso ao caminho crítico de atendimento.

### Casos

- criação de imagem promocional;
- edição de imagem;
- geração de vídeo promocional;
- criação de mídia para respostas autorizadas;
- integração futura com Content OS.

### Regra

Modelos de mídia devem ser rotas separadas, com orçamento próprio, porque podem ser caros/lentos.

---

## Fase 12 — Multiempresa SaaS

Objetivo: cada organização operar isoladamente.

### Estrutura

```text
CRM
├── Empresa A
│   ├── WhatsApp
│   ├── telefone
│   ├── clientes
│   ├── memória
│   ├── agente
│   ├── ferramentas
│   └── políticas
├── Empresa B
│   └── isolamento completo
└── Empresa C
    └── isolamento completo
```

### Requisitos

- isolamento de dados por organização;
- números/rotas de telefonia por organização;
- WhatsApp por organização;
- agentes/prompt/políticas por organização;
- catálogo/ferramentas por organização;
- custo/uso por organização;
- logs e auditoria por organização.

---

## Fase 13 — Painel do agente

Objetivo: dar ao empresário visibilidade e controle.

### Painel deve mostrar

- chamadas;
- WhatsApps;
- transcrições;
- resumos;
- pedidos;
- transferências;
- clientes recorrentes;
- memória do cliente;
- custos;
- tokens;
- providers/modelos usados;
- falhas;
- latência;
- taxa de resolução;
- taxa de escalonamento.

### Configurações

Exemplos:

- "IA pode criar pedidos automaticamente";
- "cancelamentos exigem humano";
- "acima de X euros pedir confirmação";
- "fora do horário IA atende todas as chamadas".

---

## Fase 14 — Qualidade, evals e segurança

Objetivo: testar extensivamente antes de aumentar autonomia.

### Cenários obrigatórios

- produto inexistente;
- cliente irritado;
- endereço incompleto;
- pedido ambíguo;
- áudio ruim;
- vídeo longo;
- mídia inválida;
- prompt injection/manipulação;
- provider free offline;
- rate limit;
- ferramenta indisponível;
- dois clientes com mesmo nome;
- mudança de morada;
- preço desatualizado;
- tentativa de ação fora da permissão.

### Estratégia

Usar shadow evals, golden cases, replay e quality judge antes de promover níveis de autonomia.

---

## Fase 15 — Observabilidade e otimização contínua

Objetivo: medir custo, qualidade e operação real.

### Métricas

- tempo até primeira resposta;
- latência de voz;
- duração média da ligação;
- % resolvido pela IA;
- % transferido para humano;
- custo por atendimento;
- tokens por atendimento;
- custo por organização;
- modelo/provider usado;
- falhas por provider;
- fallback rate;
- satisfação;
- conversão de pedidos;
- retrabalho humano;
- precisão da memória;
- acerto do ETA.

### Otimização

O router deve aprender quais modelos dão melhor relação qualidade/custo/latência por tarefa, sem permitir promoção automática insegura.

---

# 5. Fluxo de referência — pizzaria

```text
☎️ David liga para o número habitual da pizzaria
→ chamada é encaminhada ao destino Telnyx
→ LiveKit conecta o agente
→ Caller ID identifica David
→ Customer Memory carrega:
   - morada
   - pedido habitual
   - último pedido
   - preferências
→ IA: "David, quer o mesmo pedido da semana passada?"
→ David: "Sim"
→ IA confirma morada atual
→ ferramenta consulta menu/preço/disponibilidade
→ ferramenta cria pedido
→ ferramenta calcula ETA
→ IA: "Perfeito. Ficou confirmado e a estimativa é de 30–35 minutos."
→ WhatsApp envia confirmação
→ memória registra o novo pedido
→ observabilidade registra custo, duração, modelo e resultado
```

---

# 6. Estratégia de custos

Meta: usar recursos gratuitos primeiro, sem comprometer disponibilidade.

### Camadas a minimizar

- LLM: free-first com fallback;
- STT: self-hosted quando viável;
- TTS: self-hosted quando viável;
- visão/vídeo understanding: free tier quando possível;
- telefonia: inevitavelmente paga via PSTN/SIP;
- LiveKit Cloud: usar plano compatível com produção quando necessário.

### Regra

Nunca assumir que um modelo gratuito continuará gratuito. Toda rota free precisa de fallback configurado.

---

# 7. Regras de segurança e governança

- nenhuma ação comercial sensível sem política explícita;
- não inventar preço, disponibilidade, ETA ou status de pedido;
- dados de negócio vêm de ferramenta/fonte autoritativa;
- alterações importantes devem ser auditáveis;
- memória deve ser isolada por organização;
- campos mutáveis devem ser confirmados quando necessário;
- humano deve ser sempre acessível;
- falha de provider não pode quebrar o atendimento inteiro;
- dados pessoais devem seguir regras de retenção/privacidade definidas pelo produto;
- cada provider externo precisa ser avaliado quanto a retenção de prompts/dados.

---

# 8. Ordem de execução recomendada

```text
1. Unificação CRM + Agent OS
2. Customer Memory Layer
3. Model Router econômico
4. WhatsApp 24/7
5. Voice AI sem PSTN
6. Telnyx + LiveKit
7. Caller recognition
8. Ferramentas comerciais
9. Pedidos + ETA
10. Escalonamento humano
11. Geração de imagem/vídeo
12. Multiempresa / hardening
13. Painel e controles
14. Evals e segurança
15. Observabilidade + otimização
```

---

# 9. Critério de pronto do projeto

O projeto só pode ser considerado pronto quando um fluxo real completo funcionar em produção de teste:

1. cliente recorrente envia WhatsApp ou liga;
2. sistema identifica a organização e o cliente;
3. recupera memória compacta;
4. entende texto/mídia/voz conforme o canal;
5. escolhe modelo adequado pelo router;
6. consulta dados reais do negócio;
7. executa ação autorizada;
8. responde naturalmente;
9. registra histórico e atualiza memória;
10. transfere para humano se necessário;
11. registra custos, latência, provider e resultado;
12. mantém isolamento entre organizações;
13. sobrevive à indisponibilidade do provider principal através de fallback;
14. passa nos casos de avaliação e segurança definidos.

---

# 10. Regra de implementação

Este documento é o **plano mestre** da branch `implementacao-tokens`.

Antes de qualquer implementação:

- confirmar estado atual da `main`;
- comparar com os módulos selecionados das branches Agent OS;
- produzir um plano técnico por fase;
- implementar em etapas pequenas e verificáveis;
- não fazer merge bruto de branches divergidas;
- preservar toda funcionalidade multimodal já comprovada;
- registrar decisões, testes, bloqueadores e evidências durante a execução.
