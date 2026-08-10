# Identidade Visual Lumenva — Direcção de Design

Data: 2026-08-10
Estado: Aprovado conceptualmente
Âmbito: arquitectura da marca e direcção visual do produto

## 1. Decisão principal

A Lumenva será a única marca do ecossistema.

O CRM não terá uma marca independente. “Lumenva CRM”, “Lumenva AI”, “Lumenva Inbox”, “Lumenva Analytics”, “Lumenva Automations” e nomes equivalentes devem funcionar como nomes de produto, módulo ou funcionalidade — nunca como submarcas com logótipos, paletas ou identidades próprias.

Objectivo: concentrar reconhecimento, confiança e valor de marca num único nome: **Lumenva**.

## 2. Posicionamento visual

A direcção aprovada é **SaaS premium, minimalista e sofisticado**, inspirada nos princípios de produto associados a Apple, Linear, Vercel e Stripe, sem copiar a identidade visual de nenhuma dessas marcas.

A interface deve transmitir:

- precisão;
- clareza;
- confiança;
- tecnologia madura;
- sofisticação sem ostentação;
- baixa carga visual;
- sensação de produto premium.

A Lumenva não deve adoptar uma estética cyberpunk, neon ou excessivamente “futurista”. A inteligência artificial deve parecer uma capacidade natural do produto, não um efeito visual separado.

## 3. Princípios visuais

### 3.1 Base visual

- Predominância de branco, preto e cinzentos neutros.
- Muito espaço negativo e hierarquia clara.
- Tipografia altamente legível.
- Cantos suaves e consistentes.
- Sombras discretas, apenas quando ajudam a criar profundidade ou hierarquia.
- Ícones simples e coerentes.
- Gradientes usados com extrema moderação.
- Movimento curto, funcional e natural.

### 3.2 Uso de cor

O produto não será inteiramente monocromático.

A base será neutra, mas a cor será utilizada de forma funcional para:

- acções primárias;
- selecção e foco;
- estados de sistema;
- indicadores de IA;
- métricas e gráficos;
- feedback de sucesso, aviso e erro.

A cor de assinatura da Lumenva será definida numa etapa específica posterior de identidade visual. Esta especificação não fixa a cor final.

## 4. Sistema de identidade

A identidade visual será organizada em cinco pilares.

### 4.1 Identidade corporativa

Inclui:

- logótipo principal;
- símbolo;
- wordmark;
- versões horizontais e compactas;
- favicon e app icon;
- tipografia institucional;
- paleta de marca;
- regras de utilização e áreas de protecção.

Não serão criados logótipos individuais para módulos do CRM.

### 4.2 Product Design System

É a camada visual mais importante do produto, porque o utilizador passa a maior parte do tempo dentro da aplicação.

Deve normalizar, entre outros:

- navegação lateral;
- cabeçalhos;
- botões;
- campos de formulário;
- cards;
- tabelas;
- Kanban;
- Inbox;
- modais e drawers;
- tabs;
- dropdowns;
- tooltips;
- gráficos;
- estados vazios;
- loading e skeletons;
- estados hover, focus, active e disabled;
- breakpoints e comportamento responsivo.

O objectivo é que todas as áreas pareçam pertencer ao mesmo produto, independentemente da funcionalidade.

### 4.3 Linguagem visual de IA

A IA será integrada visualmente no sistema principal.

Devem existir padrões claros para diferenciar:

- acção humana;
- acção de agente de IA;
- sugestão de IA;
- acção executada automaticamente;
- handoff IA → humano;
- conteúdo proveniente da base de conhecimento/RAG;
- estados de processamento e confiança quando aplicável.

A IA não terá marca, logótipo ou estética paralela.

### 4.4 Identidade de marketing

A comunicação externa pode ser mais expressiva do que a interface operacional, mantendo a mesma marca.

Abrange:

- website;
- landing pages;
- apresentações;
- propostas comerciais;
- anúncios;
- redes sociais;
- screenshots e mockups;
- vídeos;
- materiais institucionais.

O marketing deve preservar os mesmos fundamentos visuais, mas pode utilizar escala tipográfica maior, composição editorial, imagens, movimento e profundidade com mais liberdade.

### 4.5 White-label controlado

O white-label deve funcionar como configuração do produto e não como criação de múltiplas marcas internas.

A arquitectura futura pode permitir parametrizar, por instalação:

- nome apresentado;
- logótipo;
- favicon;
- domínio;
- cor principal;
- cor secundária;
- elementos de e-mail transaccional;
- eventualmente tipografia dentro de limites controlados.

A base de UX, componentes, comportamento e arquitectura visual continuará a ser Lumenva.

## 5. Arquitectura de marca

```text
LUMENVA
│
├── Produto / CRM
│   ├── Inbox
│   ├── Pipeline
│   ├── Contactos
│   ├── Automações
│   ├── Analytics
│   ├── Integrações
│   └── Administração
│
├── Sistema de IA
│   ├── Agentes
│   ├── RAG
│   ├── Sugestões
│   └── Handoff
│
├── Marketing
│   ├── Website
│   ├── Social
│   ├── Ads
│   └── Comercial
│
└── White-label
    └── Configuração visual por cliente/instalação
```

## 6. Regras não negociáveis

1. Existe uma única marca: Lumenva.
2. Módulos não recebem logótipos próprios.
3. O CRM privilegia usabilidade e legibilidade sobre efeitos visuais.
4. A IA deve parecer integrada, não uma aplicação dentro da aplicação.
5. O marketing pode ser mais expressivo, mas não pode parecer outra empresa.
6. A interface não será completamente preto-e-branco; cor terá função semântica e de marca.
7. A estética deve evitar ruído, excesso de decoração, neon e efeitos “AI genéricos”.
8. Qualquer novo componente deve reutilizar tokens e padrões do design system antes de introduzir variantes específicas.

## 7. Fora do âmbito desta especificação

Esta especificação não define ainda:

- cor de assinatura final;
- valores HEX/RGB/CMYK;
- família tipográfica final;
- desenho final do logótipo;
- escala tipográfica completa;
- tokens de espaçamento;
- tokens de radius e shadow;
- dark mode;
- biblioteca final de ícones;
- implementação em código.

Esses elementos devem ser definidos nas próximas etapas do sistema visual, respeitando integralmente as decisões desta especificação.

## 8. Critérios de sucesso

A direcção será considerada bem aplicada quando:

- qualquer ecrã do CRM for imediatamente reconhecível como parte da Lumenva;
- módulos diferentes partilharem a mesma linguagem visual;
- IA e automação forem distinguíveis sem parecerem submarcas;
- a interface transmitir qualidade premium sem sacrificar densidade funcional;
- website, produto e materiais comerciais parecerem partes do mesmo sistema;
- o white-label puder alterar a apresentação do cliente sem fragmentar o design system base.
