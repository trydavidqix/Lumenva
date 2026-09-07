import Link from "next/link";
import type { RadarArticle } from "@/lib/radar/types";
import styles from "./radar.module.css";

export function FeaturedArticle({ article }: { article: RadarArticle }) {
  return <article className={styles.featured}>
    <p className={styles.eyebrow}>EM DESTAQUE</p>
    <p className={styles.meta}>{article.category} · {article.readingMinutes} min de leitura</p>
    <h2><Link href={`/radar/${article.slug}`}>{article.title}</Link></h2>
    {article.subtitle ? <p className={styles.subtitle}>{article.subtitle}</p> : <p>{article.excerpt}</p>}
    <Link className={styles.textLink} href={`/radar/${article.slug}`}>Ler artigo <span aria-hidden="true">→</span></Link>
  </article>;
}
