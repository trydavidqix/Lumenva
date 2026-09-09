import type { BlogArticle } from "@/lib/blog/types";
import { BlogCard } from "./BlogCard";
import styles from "./blog.module.css";
export function BlogList({ articles, emptyMessage = "Nenhum artigo encontrado." }: Readonly<{ articles: readonly BlogArticle[]; emptyMessage?: string }>) {
  if (!articles.length) return <p className={styles.empty} role="status">{emptyMessage}</p>;
  return <div className={styles.grid}>{articles.map((article) => <BlogCard article={article} key={article.slug} />)}</div>;
}
