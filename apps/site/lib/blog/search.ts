import { getAllBlogArticles } from "./articles";
import type { BlogArticle } from "./types";

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt");

export function searchBlogArticles(query: string, articles: readonly BlogArticle[] = getAllBlogArticles()): BlogArticle[] {
  const normalizedQuery = normalize(query.trim());
  if (!normalizedQuery) return [...articles].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.slug.localeCompare(b.slug));
  return articles.filter((article) => normalize([article.title, article.subtitle ?? "", article.excerpt, article.category, article.type, ...article.tags].join(" ")).includes(normalizedQuery));
}
