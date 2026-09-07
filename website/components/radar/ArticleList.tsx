import type { RadarArticle } from "@/lib/radar/types";
import { ArticleCard } from "./ArticleCard";
import styles from "./radar.module.css";

export function ArticleList({ articles, emptyMessage = "Ainda não existem artigos nesta seleção." }: { articles: RadarArticle[]; emptyMessage?: string }) {
  if (!articles.length) return <p className={styles.empty}>{emptyMessage}</p>;
  return <div className={styles.list}>{articles.map((article) => <ArticleCard key={article.slug} article={article} />)}</div>;
}
