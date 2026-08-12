# Identidade Visual Lumenva — Direcção de Design

Data: 2026-08-10
Estado: Aprovado
Âmbito: arquitectura da marca, paleta e direcção visual do produto

## 1. Decisão principal

A Lumenva será a única marca do ecossistema.

O CRM não terá uma marca independente. “Lumenva CRM”, “Lumenva AI”, “Lumenva Inbox”, “Lumenva Analytics”, “Lumenva Automations” e nomes equivalentes funcionam como nomes de produto, módulo ou funcionalidade — nunca como submarcas com logótipos, paletas ou identidades próprias.

Objectivo: concentrar reconhecimento, confiança e valor de marca num único nome: **Lumenva**.

## 2. Posicionamento visual

A direcção aprovada é **Apple-inspired SaaS premium, luxury, profissional e confortável**, sem copiar a identidade visual da Apple nem de qualquer outra marca.

A referência conceptual combina os princípios de clareza e refinamento associados a Apple, Linear, Vercel e Stripe.

A interface deve transmitir:

- conforto visual;
- precisão;
- clareza;
- confiança;
- tecnologia madura;
- sofisticação sem ostentação;
- sensação de produto premium;
- baixa carga visual.

A experiência deve parecer cara, organizada e confiável — nunca agressiva, “gamer”, cyberpunk, neon ou excessivamente futurista.

## 3. Paleta oficial de marca

A identidade da Lumenva utiliza apenas três famílias cromáticas: **preto, cinzento e branco**.

### 3.1 Cores principais

| Token de marca | HEX | Função |
|---|---:|---|
| Lumenva Black | `#111111` | Texto principal, botões primários, fundos escuros e marca |
| Lumenva Gray | `#6E6E73` | Texto secundário, iconografia e elementos de apoio |
| Lumenva White | `#F5F5F7` | Fundo principal claro e superfícies de grande área |

Estas três cores formam a assinatura visual da marca.

### 3.2 Derivações técnicas

O design system pode criar tons derivados de preto, cinzento e branco para resolver hierarquia, contraste e profundidade, sem introduzir novas famílias cromáticas.

Exemplos de utilização:

- fundo principal: `#F5F5F7`;
- superfícies elevadas/cards: branco técnico próximo de `#FFFFFF`;
- texto principal: `#111111`;
- texto secundário: `#6E6E73`;
- divisores e bordas: cinzentos muito claros derivados;
- hover e selecção: variações tonais neutras;
- fundo dark: variações próximas de `#111111`;
- superfícies dark: cinzentos mais claros do que o fundo.

Essas derivações são tokens funcionais do produto, não novas cores de marca.

## 4. Regra de luminosidade e conforto

O produto deve privilegiar a experiência clara.

Como regra de composição visual:

- aproximadamente 70–80% das grandes áreas devem ser claras;
- preto e grafite devem criar contraste, foco e hierarquia;
- o dark mode é uma alternativa premium, não a identidade dominante;
- branco puro deve ser usado apenas quando necessário para elevação e contraste local;
- grandes áreas em preto absoluto devem ser evitadas.

O objectivo é reduzir fadiga visual e evitar que o CRM pareça pesado ou excessivamente técnico.

## 5. Princípios visuais

- Muito espaço negativo.
- Hierarquia tipográfica clara.
- Cantos suaves e consistentes.
- Sombras quase imperceptíveis.
- Poucas bordas; priorizar espaço, superfície e elevação.
- Ícones simples e coerentes.
- Gradientes apenas quando acrescentarem profundidade real.
- Movimento curto, discreto e funcional.
- Transições com fade, blur e pequenas deslocações, sem efeitos chamativos.
- Nenhum elemento decorativo deve competir com a informação operacional.

## 6. Estados e feedback sem cores externas

A interface deve continuar compreensível mesmo mantendo a identidade monocromática.

Estados como sucesso, erro, aviso, IA e automação devem ser diferenciados por uma combinação de:

- ícone;
- texto explícito;
- forma;
- peso tipográfico;
- contraste;
- padrão visual;
- posição e contexto.

A cor nunca pode ser o único canal de informação. Os contrastes devem cumprir requisitos de acessibilidade.

## 7. Sistema de identidade

A identidade visual organiza-se em cinco pilares.

### 7.1 Identidade corporativa

Inclui:

- logótipo principal;
- símbolo;
- wordmark;
- versões horizontais e compactas;
- favicon e app icon;
- tipografia institucional;
- paleta oficial;
- regras de utilização e áreas de protecção.

Não serão criados logótipos individuais para módulos do CRM.

### 7.2 Product Design System

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
- hover, focus, active e disabled;
- breakpoints e comportamento responsivo.

O objectivo é que qualquer ecrã seja reconhecível como parte do mesmo produto.

### 7.3 Linguagem visual de IA

A IA será integrada no sistema principal, sem marca ou estética paralela.

Devem existir padrões claros para diferenciar:

- acção humana;
- acção de agente de IA;
- sugestão de IA;
- acção executada automaticamente;
- handoff IA → humano;
- conteúdo proveniente da base de conhecimento/RAG;
- estados de processamento e confiança, quando aplicável.

### 7.4 Identidade de marketing

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

### 7.5 White-label controlado

O white-label deve funcionar como configuração do produto, não como fragmentação do design system.

A arquitectura futura pode permitir parametrizar por instalação:

- nome apresentado;
- logótipo;
- favicon;
- domínio;
- elementos de e-mail transaccional;
- alguns tokens visuais dentro de limites definidos.

## 8. Arquitectura de marca

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

## 9. Regras não negociáveis

1. Existe uma única marca: Lumenva.
2. A marca utiliza apenas preto, cinzento e branco.
3. Os módulos não recebem logótipos próprios.
4. A experiência clara é a referência principal do CRM.
5. O CRM privilegia conforto, usabilidade e legibilidade sobre efeitos visuais.
6. A IA deve parecer integrada, não uma aplicação dentro da aplicação.
7. O marketing pode ser mais expressivo, mas não pode parecer outra empresa.
8. A estética deve evitar ruído, excesso de decoração, neon e efeitos “AI genéricos”.
9. Qualquer novo componente deve reutilizar tokens e padrões do design system antes de introduzir variantes específicas.
10. Cor nunca será o único meio de comunicar estado ou significado.

## 10. Elementos ainda por fechar

Esta especificação ainda não fixa:

- família tipográfica final;
- escala tipográfica completa;
- desenho vectorial master definitivo do logótipo;
- tokens completos de cinzentos derivados;
- tokens de espaçamento;
- tokens de radius e shadow;
- regras finais de dark mode;
- biblioteca final de ícones;
- implementação em código.

## 11. Critérios de sucesso

A direcção será considerada bem aplicada quando:

- o produto transmitir sensação de qualidade premium sem parecer frio ou agressivo;
- a interface for confortável para utilização prolongada;
- qualquer ecrã do CRM for imediatamente reconhecível como Lumenva;
- módulos diferentes partilharem a mesma linguagem visual;
- IA e automação forem distinguíveis sem parecerem submarcas;
- website, produto e materiais comerciais parecerem partes do mesmo sistema;
- o contraste e os estados forem acessíveis sem depender de cores externas à identidade.
