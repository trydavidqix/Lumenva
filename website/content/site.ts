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

export const navigation: readonly NavigationItem[] = [
  { label: "Soluções", href: "/solucoes" },
  { label: "Inteligência artificial", href: "/inteligencia-artificial" },
  { label: "Automações", href: "/automacoes" },
  { label: "CRM", href: "/crm" },
  { label: "Integrações", href: "/integracoes" },
  { label: "Projetos", href: "/projetos" },
  { label: "Sobre", href: "/sobre" },
  { label: "Contato", href: "/contato" },
];

export const demoCta = {
  label: "Solicitar demonstração",
  href: "/contato",
} as const;

export const shellContent = {
  primaryNavigationLabel: "Navegação principal",
  mobileNavigationLabel: "Navegação móvel",
  openMenuLabel: "Abrir menu",
  closeMenuLabel: "Fechar menu",
  skipToContentLabel: "Ir para o conteúdo principal",
  githubLabel: "Ver no GitHub",
} as const;

export const { siteName, description, githubUrl } = site;
