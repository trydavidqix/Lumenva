export type FaqItem = {
  question: string;
  answer: string;
};

export const faqItems: readonly FaqItem[] = [
  {
    question: "O que é a Lumenva?",
    answer:
      "Lumenva é uma plataforma de atendimento e vendas com IA que une agentes, automações e CRM num só sistema, com o WhatsApp como canal principal.",
  },
  {
    question: "Como funcionam os agentes de IA?",
    answer:
      "Os agentes atendem e qualificam com o contexto da sua operação, seguindo regras definidas pela sua equipa, com handoff para uma pessoa sempre que necessário.",
  },
  {
    question: "Qual é o canal principal?",
    answer: "O WhatsApp é o canal primário da Lumenva para vendas e suporte.",
  },
];
