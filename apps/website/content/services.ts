export type Service = {
  name: string;
  description: string;
};

export const services: readonly Service[] = [
  {
    name: "Agentes de IA",
    description:
      "Agentes atendem, qualificam e movem leads no funil pelo WhatsApp, com handoff para pessoas.",
  },
  {
    name: "Automações",
    description:
      "Regras conectam eventos do CRM a ações como organizar leads, atribuir atendimento e enviar mensagens.",
  },
  {
    name: "CRM para diferentes operações",
    description:
      "Vocabulários configuráveis por pipeline permitem adaptar o mesmo núcleo a diferentes tipos de negócio.",
  },
];
