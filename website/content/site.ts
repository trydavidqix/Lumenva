export const site = {
  siteName: "Lumenva",
  description:
    "Lumenva é um AI Sales OS open source e self-hosted para vendas e suporte pelo WhatsApp.",
  githubUrl: "https://github.com/melgarafael/DeskcommCRM",
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
    label: "Soluções",
    href: "/solucoes",
    slug: "solucoes",
    heading: "Soluções",
    description: "Uma visão geral das soluções da Lumenva para vendas e suporte no WhatsApp.",
  },
  {
    label: "Inteligência artificial",
    href: "/inteligencia-artificial",
    slug: "inteligencia-artificial",
    heading: "Inteligência artificial",
    description: "Agentes de IA para vendas e suporte no WhatsApp.",
  },
  {
    label: "Automações",
    href: "/automacoes",
    slug: "automacoes",
    heading: "Automações",
    description: "Automações conectam eventos do CRM a ações da operação.",
  },
  {
    label: "CRM",
    href: "/crm",
    slug: "crm",
    heading: "CRM",
    description: "Um núcleo de CRM configurável para diferentes operações.",
  },
  {
    label: "Integrações",
    href: "/integracoes",
    slug: "integracoes",
    heading: "Integrações",
    description: "Informações sobre integrações da Lumenva.",
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
    description: "Lumenva é um AI Sales OS open source e self-hosted para vendas e suporte pelo WhatsApp.",
  },
  {
    label: "Contato",
    href: "/contato",
    slug: "contato",
    heading: "Solicitar demonstração",
    description: "Esta página reúne o caminho para solicitar uma demonstração da Lumenva.",
  },
];

export const navigation: readonly NavigationItem[] = publicRoutes.map(
  ({ href, label }) => ({ href, label }),
);

export const demoCta = {
  label: "Solicitar demonstração",
  href: "/contato",
} as const;

export const shellContent = {
  primaryNavigationLabel: "Navegação principal",
  mobileNavigationLabel: "Navegação móvel",
  openMenuLabel: "Abrir menu",
  closeMenuLabel: "Fechar menu",
  closeMenuBackdropLabel: "Fechar menu ao clicar fora",
  skipToContentLabel: "Ir para o conteúdo principal",
  githubLabel: "Ver no GitHub",
} as const;

export const { siteName, description, githubUrl } = site;
