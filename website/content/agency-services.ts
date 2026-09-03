export type AgencyServiceGroup = "Construção" | "Conteúdo" | "Aquisição";

export type AgencyService = Readonly<{
  slug: string;
  name: string;
  description: string;
  group: AgencyServiceGroup;
}>;

export const agencyServices: readonly AgencyService[] = [
  { slug: "criacao-de-site", name: "Criação de site", description: "Planeamento e desenvolvimento de sites institucionais e páginas de conversão.", group: "Construção" },
  { slug: "criacao-de-app", name: "Criação de app", description: "Desenvolvimento de aplicações mobile e web adaptadas ao contexto da operação.", group: "Construção" },
  { slug: "gestao-de-redes-sociais", name: "Gestão de redes sociais", description: "Planeamento e produção contínua de conteúdos para os canais sociais da marca.", group: "Conteúdo" },
  { slug: "geracao-de-imagens", name: "Geração de imagens", description: "Criação de imagens para campanhas, conteúdos e materiais de comunicação.", group: "Conteúdo" },
  { slug: "geracao-de-videos", name: "Geração de vídeos", description: "Produção de vídeos para comunicação, campanhas e presença digital.", group: "Conteúdo" },
  { slug: "trafego-pago", name: "Tráfego pago", description: "Planeamento, configuração e acompanhamento de campanhas de aquisição paga.", group: "Aquisição" },
  { slug: "trafego-organico", name: "Tráfego orgânico", description: "Estratégia e execução de conteúdos para melhorar a descoberta orgânica da marca.", group: "Aquisição" },
] as const;

export const agencyServiceGroups: readonly AgencyServiceGroup[] = ["Construção", "Conteúdo", "Aquisição"] as const;
