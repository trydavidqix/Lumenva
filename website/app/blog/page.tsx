import type { Metadata } from "next";
import { BlogCategoryNav, BlogSearch, FeaturedArticle, NewsletterCTA } from "@/components/blog";
import { blogCategorySlug, getBlogCategories } from "@/lib/blog/articles";
import { loadPublishedBlogArticles } from "@/lib/blog/published";
import styles from "@/components/blog/blog.module.css";

export const metadata: Metadata = {
  title: "Blog | Lumenva",
  description: "Notícias, insights e guias sobre inteligência artificial e operações.",
};

export default async function BlogPage() {
  const articles = await loadPublishedBlogArticles();
  const featured = articles.find((article) => article.featured);
  const categories = [{ label: "Todos", href: "/blog", slug: "all" }, ...[...new Set(articles.map((article) => article.category))].map((category) => ({ label: category, href: `/blog/categoria/${blogCategorySlug(category)}`, slug: blogCategorySlug(category) }))];
  return <div className={styles.blogShell}><header className={styles.pageHeader}><p>LUMENVA BLOG</p><h1>Ideias para operações mais inteligentes</h1><p>Notícias, análises e guias práticos sobre IA, agentes e automação.</p></header><BlogCategoryNav categories={categories} current="all" />{featured && <FeaturedArticle article={featured} />}<section aria-labelledby="blog-all-title"><h2 id="blog-all-title">Todos os artigos</h2><BlogSearch articles={articles} excludeSlug={featured?.slug} /></section><NewsletterCTA /></div>;
}
