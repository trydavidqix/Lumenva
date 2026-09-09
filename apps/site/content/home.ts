export const homeContent = {
  eyebrow: "A plataforma de atendimento e vendas com IA",
  title: "Atendimento e vendas com IA, WhatsApp e CRM num só lugar",
  description:
    "Centralize conversas, automatize processos e acompanhe vendas com IA, tudo numa única operação.",
  secondaryCta: { label: "Ver produto", href: "/produto" },
} as const;

export const heroIntegrations = ["WhatsApp", "OpenAI", "Claude", "n8n", "Supabase", "Vercel"] as const;

export type ProofPoint = Readonly<{
  label: string;
  description: string;
}>;

export const proofPoints: readonly ProofPoint[] = [
  {
    label: "Multi-tenant seguro",
    description: "Isolamento de dados por organização em cada camada.",
  },
  {
    label: "Auditoria completa",
    description: "Toda mutação relevante fica registada para rastreabilidade.",
  },
  {
    label: "WhatsApp",
    description: "WhatsApp como canal primário para vendas e suporte.",
  },
  {
    label: "Governado por pessoas",
    description: "Agentes trabalham com regras e handoff para a equipa.",
  },
];

export type AgentNarrativeStep = Readonly<{
  label: string;
  title: string;
  description: string;
}>;

export const agentNarrativeSteps: readonly AgentNarrativeStep[] = [
  {
    label: "01",
    title: "Entender",
    description:
      "O agente lê a mensagem recebida no WhatsApp e o contexto disponível para o atendimento.",
  },
  {
    label: "02",
    title: "Decidir",
    description:
      "Regras e capacidades configuradas orientam a próxima ação.",
  },
  {
    label: "03",
    title: "Executar",
    description:
      "O agente atende, qualifica e movimenta o lead no funil quando a operação permite.",
  },
  {
    label: "04",
    title: "Automatizar",
    description:
      "Eventos do CRM acionam regras para organizar leads, atribuir atendimento e enviar mensagens.",
  },
  {
    label: "05",
    title: "Resultado",
    description:
      "A equipa acompanha o histórico no CRM e assume o atendimento quando necessário.",
  },
];

export type CapabilityDetail = Readonly<{
  label: string;
  description: string;
}>;

export type CapabilitySection = Readonly<{
  id: "automacoes" | "crm";
  eyebrow: string;
  title: string;
  description: string;
  items: readonly CapabilityDetail[];
}>;

export const capabilitySections: readonly CapabilitySection[] = [
  {
    id: "automacoes",
    eyebrow: "Automações",
    title: "Do evento à ação, com regras claras.",
    description:
      "Automações conectam o que acontece no CRM às próximas ações da operação.",
    items: [
      {
        label: "Eventos",
        description: "Mudanças e atividades do CRM alimentam as regras da operação.",
      },
      {
        label: "Ações",
        description: "Organize leads, atribua atendimento e envie mensagens.",
      },
      {
        label: "Controlo humano",
        description: "Pessoas definem as regras e podem assumir o atendimento.",
      },
    ],
  },
  {
    id: "crm",
    eyebrow: "CRM",
    title: "Contexto para agentes e pessoas trabalharem juntos.",
    description:
      "O CRM conecta conversas, leads, atividades e pipeline na mesma operação.",
    items: [
      {
        label: "Contexto",
        description: "Conversas e atividades acompanham o histórico do lead.",
      },
      {
        label: "Pipeline",
        description: "Etapas organizam o andamento das oportunidades.",
      },
      {
        label: "Vocabulário configurável",
        description: "O mesmo núcleo se adapta a diferentes tipos de operação.",
      },
    ],
  },
];

export type HowItWorksStep = Readonly<{
  label: string;
  title: string;
  description: string;
}>;

export const howItWorksSteps: readonly HowItWorksStep[] = [
  {
    label: "01",
    title: "Conecte o canal",
    description: "O WhatsApp é o ponto de entrada para vendas e suporte.",
  },
  {
    label: "02",
    title: "Configure a operação",
    description: "Defina agentes, regras, automações e o vocabulário do pipeline.",
  },
  {
    label: "03",
    title: "Opere com contexto",
    description:
      "Agentes e equipa acompanham mensagens, atividades e leads no CRM.",
  },
];

export type IntegrationItem = Readonly<{
  name: string;
  kind: string;
  description: string;
}>;

export const integrationItems: readonly IntegrationItem[] = [
  {
    name: "WhatsApp",
    kind: "Canal primário",
    description: "Vendas e suporte conectados pelo WAHA.",
  },
  {
    name: "OpenAI / Claude Code",
    kind: "IA",
    description: "Fornecedor de apoio para embeddings de IA.",
  },
  {
    name: "Supabase",
    kind: "Dados",
    description: "Base de dados, autenticação e armazenamento com isolamento por organização.",
  },
  {
    name: "Vercel",
    kind: "Infraestrutura",
    description: "Plataforma de deploy do frontend.",
  },
];

export type FinalCtaItem = Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  label: string;
  href: `/${string}`;
}>;

export const finalCtaItems: readonly FinalCtaItem[] = [
  {
    eyebrow: "Demonstração",
    title: "Veja a Lumenva aplicada à sua operação.",
    description:
      "Converse com a equipa sobre agentes de IA, automações e CRM.",
    label: "Agendar demonstração",
    href: "/contato",
  },
];

export type ApprovedResult = Readonly<{
  title: string;
  description: string;
  source: string;
}>;

export const approvedResults: readonly ApprovedResult[] = [];
