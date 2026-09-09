export const site = {
  siteName: "Lumenva",
  description:
    "Lumenva é a plataforma de atendimento e vendas com IA que une agentes, automações e CRM, com o WhatsApp como canal principal.",
} as const;

export type NavigationItem = Readonly<{
  label: string;
  href: `/${string}`;
}>;

export type PublicRoute = NavigationItem &
  Readonly<{
    slug: string;
    heading: string;
    description: string;
  }>;

export const publicRoutes: readonly PublicRoute[] = [
  {
    label: "Produto",
    href: "/produto",
    slug: "produto",
    heading: "Produto",
    description: "Como agentes de IA, automações e CRM trabalham juntos na Lumenva.",
  },
  {
    label: "Soluções",
    href: "/solucoes",
    slug: "solucoes",
    heading: "Soluções",
    description: "Uma visão geral das soluções da Lumenva para vendas e suporte no WhatsApp.",
  },
  {
    label: "Atendimento com IA",
    href: "/solucoes/atendimento-com-ia",
    slug: "atendimento-com-ia",
    heading: "Atendimento com IA",
    description: "Automatize o atendimento sem perder o toque humano.",
  },
  {
    label: "Vendas & CRM",
    href: "/solucoes/vendas-crm",
    slug: "vendas-crm",
    heading: "Vendas & CRM",
    description: "Organize o funil e feche mais negócios com previsibilidade.",
  },
  {
    label: "Agentes de IA",
    href: "/solucoes/agentes-de-ia",
    slug: "agentes-de-ia",
    heading: "Agentes de IA",
    description: "Crie agentes de IA que atendem, qualificam e executam tarefas por si.",
  },
  {
    label: "Automação de Processos",
    href: "/solucoes/automacao-de-processos",
    slug: "automacao-de-processos",
    heading: "Automação de Processos",
    description: "Automatize processos e escale a operação com mais controlo.",
  },
  {
    label: "Integrações",
    href: "/integracoes",
    slug: "integracoes",
    heading: "Integrações",
    description: "Informações sobre integrações da Lumenva.",
  },
  {
    label: "Serviços",
    href: "/servicos",
    slug: "servicos",
    heading: "Serviços",
    description: "Serviços de construção, conteúdo e aquisição para a presença digital.",
  },
  {
    label: "Projetos",
    href: "/projetos",
    slug: "projetos",
    heading: "Projetos",
    description: "Casos aprovados serão publicados nesta página.",
  },
  {
    label: "Sobre",
    href: "/sobre",
    slug: "sobre",
    heading: "Sobre a Lumenva",
    description: "Lumenva é a plataforma de atendimento e vendas com IA que une agentes, automações e CRM.",
  },
  {
    label: "Contacto",
    href: "/contato",
    slug: "contato",
    heading: "Solicitar demonstração",
    description: "Esta página reúne o caminho para solicitar uma demonstração da Lumenva.",
  },
];

export type SolutionMenuItem = Readonly<{
  label: string;
  href: `/${string}`;
  description: string;
  icon: "atendimento" | "vendas" | "agentes" | "automacao";
}>;

export const solutionsMenu: readonly SolutionMenuItem[] = [
  {
    label: "Atendimento com IA",
    href: "/solucoes/atendimento-com-ia",
    description: "Inbox, resumo e resposta sugerida com handoff para a equipa.",
    icon: "atendimento",
  },
  {
    label: "Vendas & CRM",
    href: "/solucoes/vendas-crm",
    description: "Pipeline, propostas e próximas ações num só lugar.",
    icon: "vendas",
  },
  {
    label: "Agentes de IA",
    href: "/solucoes/agentes-de-ia",
    description: "Agentes especializados por função, com supervisão humana.",
    icon: "agentes",
  },
  {
    label: "Automação de Processos",
    href: "/solucoes/automacao-de-processos",
    description: "Workflows que ligam WhatsApp, CRM e tarefas da operação.",
    icon: "automacao",
  },
] as const;

export const navigation: readonly NavigationItem[] = [
  { label: "Produto", href: "/produto" },
  { label: "Soluções", href: "/solucoes" },
  { label: "Integrações", href: "/integracoes" },
  { label: "Serviços", href: "/servicos" },
  { label: "Contacto", href: "/contato" },
] as const;

export const footerNavigation: readonly NavigationItem[] = [
  ...navigation,
  { label: "Blog", href: "/blog" },
  ...solutionsMenu.map(({ href, label }) => ({ href, label })),
  { label: "Sobre", href: "/sobre" },
  { label: "Projetos", href: "/projetos" },
] as const;

export type LegalFooterLink = Readonly<{
  label: string;
  href: string;
  external?: boolean;
}>;

export const legalNavigation: readonly LegalFooterLink[] = [
  { label: "Informação Legal", href: "/informacao-legal" },
  { label: "Política de Privacidade", href: "/politica-de-privacidade" },
  {
    label: "Livro de Reclamações",
    href: "https://www.livroreclamacoes.pt/Inicio/",
    external: true,
  },
] as const;

export const demoCta = {
  label: "Agendar demonstração",
  href: "/contato",
} as const;

export const contactDetails = {
  email: "contato@lumenva.pt",
  phone: "+351 910 293 287",
  whatsappHref: "https://wa.me/351910293287",
  address: "Porto",
} as const;

export type SocialLink = Readonly<{
  label: string;
  href: string;
  icon: "whatsapp" | "facebook" | "instagram";
}>;

export const socialLinks: readonly SocialLink[] = [
  { label: "WhatsApp", href: contactDetails.whatsappHref, icon: "whatsapp" },
  {
    label: "Facebook",
    href: "https://www.facebook.com/profile.php?id=61592131762439",
    icon: "facebook",
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/lumenva.group/",
    icon: "instagram",
  },
] as const;

export const shellContent = {
  primaryNavigationLabel: "Navegação principal",
  mobileNavigationLabel: "Navegação móvel",
  openMenuLabel: "Abrir menu",
  closeMenuLabel: "Fechar menu",
  closeMenuBackdropLabel: "Fechar menu ao clicar fora",
  skipToContentLabel: "Ir para o conteúdo principal",
} as const;

export const { siteName, description } = site;
