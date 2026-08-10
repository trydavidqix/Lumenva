export const homeContent = {
  eyebrow: "AI Sales OS",
  title: "Vendas e suporte no WhatsApp, operados por IA e pessoas.",
  description:
    "Lumenva reúne agentes de IA, automações e CRM em uma plataforma open source e self-hosted.",
} as const;

export type ProofPoint = Readonly<{
  label: string;
  description: string;
}>;

export const proofPoints: readonly ProofPoint[] = [
  {
    label: "Open source",
    description: "Código distribuído sob licença MIT.",
  },
  {
    label: "Self-hosted",
    description: "Executado na sua própria infraestrutura.",
  },
  {
    label: "WhatsApp-native",
    description: "WhatsApp como canal primário para vendas e suporte.",
  },
  {
    label: "Governado por pessoas",
    description: "Agentes trabalham com regras e handoff para a equipe.",
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
      "A equipe acompanha o histórico no CRM e assume o atendimento quando necessário.",
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
        label: "Controle humano",
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
      "Agentes e equipe acompanham mensagens, atividades e leads no CRM.",
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
    name: "Nuvemshop",
    kind: "E-commerce",
    description: "Integração documentada para pedidos, clientes e catálogo.",
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
      "Converse com a equipe sobre agentes de IA, automações, CRM e self-hosting.",
    label: "Solicitar demonstração",
    href: "/contato",
  },
];

export type ApprovedResult = Readonly<{
  title: string;
  description: string;
  source: string;
}>;

export const approvedResults: readonly ApprovedResult[] = [];
