import { getAllBlogArticles } from "./articles";
import type { BlogArticle } from "./types";

export function getRelatedBlogArticles(article: BlogArticle, limit = 3, candidates: readonly BlogArticle[] = getAllBlogArticles()): BlogArticle[] {
  return candidates.filter((candidate) => candidate.slug !== article.slug).map((candidate) => ({ candidate, score: (candidate.category === article.category ? 100 : 0) + candidate.tags.filter((tag) => article.tags.includes(tag)).length * 10 + (candidate.type === article.type ? 1 : 0) })).sort((a, b) => b.score - a.score || b.candidate.publishedAt.localeCompare(a.candidate.publishedAt) || a.candidate.slug.localeCompare(b.candidate.slug)).slice(0, Math.max(0, limit)).map(({ candidate }) => candidate);
}
