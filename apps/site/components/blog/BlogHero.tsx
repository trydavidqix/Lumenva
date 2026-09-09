import styles from "./blog.module.css";

export interface BlogHeroProps { readonly eyebrow?: string; readonly title?: string; readonly subtitle?: string; }

export function BlogHero({ eyebrow = "Lumenva Blog", title = "Ideias para operar melhor", subtitle = "Notícias, insights e guias sobre IA, agentes e automação aplicada a negócios." }: Readonly<BlogHeroProps>) {
  return <header className={styles.hero}><div className="site-shell"><div className={styles.heroCopy}><p className={styles.eyebrow}>{eyebrow}</p><h1 className={styles.heroTitle}>{title}</h1><p className={styles.heroSubtitle}>{subtitle}</p></div></div></header>;
}
