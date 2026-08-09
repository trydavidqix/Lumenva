export type FaqItem = {
  question: string;
  answer: string;
};

export const faqItems: readonly FaqItem[] = [
  {
    question: "O que é a Lumenva?",
    answer:
      "Lumenva é a identidade pública de um AI Sales OS open source e self-hosted para vendas e suporte pelo WhatsApp.",
  },
  {
    question: "A Lumenva é open source?",
    answer: "Sim. O projeto é distribuído sob a licença MIT.",
  },
  {
    question: "Onde a Lumenva é executada?",
    answer: "A Lumenva é self-hosted e pode ser executada na sua própria infraestrutura.",
  },
];
