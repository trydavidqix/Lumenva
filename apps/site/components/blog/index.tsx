import Link from "next/link";
import type { BlogArticle } from "@/lib/blog/types";
import { BlogCard } from "./BlogCard";
import { BlogArticleBody } from "./BlogArticleBody";
import { BlogList } from "./BlogList";
import { BlogRelated } from "./BlogRelated";
import { BlogSources } from "./BlogSources";
import { BlogShare } from "./BlogShare";
import styles from "./blog.module.css";

export { BlogHero } from "./BlogHero";
export { BlogCard } from "./BlogCard";
export { BlogList } from "./BlogList";
export { BlogCategoryNav } from "./BlogCategoryNav";
export { BlogArticleBody } from "./BlogArticleBody";
export { BlogSources } from "./BlogSources";
export { BlogRelated } from "./BlogRelated";
export { BlogShare } from "./BlogShare";
export { BlogSearch } from "./BlogSearch";

export function ArticleList({ articles }: Readonly<{ articles: readonly BlogArticle[] }>) { return <BlogList articles={articles} />; }
export function FeaturedArticle({ article }: Readonly<{ article: BlogArticle }>) { return <section aria-label="Artigo em destaque"><BlogCard article={article} /></section>; }
export function ArticleBody({ body }: Readonly<{ body: BlogArticle["body"] }>) { return <BlogArticleBody blocks={body} />; }
export function ArticleSources({ sources }: Readonly<{ sources: BlogArticle["sources"] }>) { return <BlogSources sources={sources} />; }
export function RelatedArticles({ articles }: Readonly<{ articles: readonly BlogArticle[] }>) { return <BlogRelated articles={articles} />; }
export function ShareActions(props: Readonly<{ title: string; url?: string }>) { return <BlogShare {...props} />; }
export function NewsletterCTA() { return <aside className={styles.callout} aria-labelledby="blog-newsletter-title"><p className={styles.calloutTitle} id="blog-newsletter-title">Receba novidades do blog</p><p>Newsletter disponível em breve. Não recolhemos contactos sem destino aprovado.</p><Link href="/blog">Voltar ao blog</Link></aside>; }
