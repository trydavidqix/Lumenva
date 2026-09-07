import Link from "next/link";
import type { BlogArticle } from "@/lib/blog/types";
import styles from "./blog.module.css";

const labels: Record<BlogArticle["type"], string> = { noticia: "Notícia", insight: "Insight", guia: "Guia" };
export function BlogCard({ article }: Readonly<{ article: BlogArticle }>) {
  const titleId = `blog-card-title-${article.slug}`;
  return <article className={styles.card} aria-labelledby={titleId}><div className={styles.cardMeta}><span>{labels[article.type]}</span><span>{article.readingMinutes} min de leitura</span></div><h2 className={styles.cardTitle} id={titleId}><Link className={styles.cardLink} href={`/blog/${article.slug}`}>{article.title}</Link></h2>{article.subtitle ? <p className={styles.cardExcerpt}>{article.subtitle}</p> : <p className={styles.cardExcerpt}>{article.excerpt}</p>}<div className={styles.cardMeta}><time dateTime={article.publishedAt}>{new Intl.DateTimeFormat("pt-PT", { dateStyle: "medium" }).format(new Date(`${article.publishedAt}T12:00:00`))}</time><span>{article.category}</span></div>{article.tags.length ? <ul className={styles.tags} aria-label="Temas">{article.tags.map((tag) => <li className={styles.tag} key={tag}>{tag}</li>)}</ul> : null}</article>;
}
