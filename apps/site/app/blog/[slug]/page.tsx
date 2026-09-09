import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleBody, ArticleSources, NewsletterCTA, RelatedArticles, ShareActions } from "@/components/blog";
import { blogHeadingId } from "@/components/blog/BlogArticleBody";
import { loadPublishedBlogArticles } from "@/lib/blog/published";
import { getRelatedBlogArticles } from "@/lib/blog/related";
import { createBlogArticleMetadata, createBlogArticleJsonLd, createBlogBreadcrumbJsonLd } from "@/lib/blog/metadata";
import { getSiteUrl } from "@/lib/metadata";
import styles from "@/components/blog/blog.module.css";

export async function generateStaticParams() { return (await loadPublishedBlogArticles()).map((article) => ({ slug: article.slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = (await loadPublishedBlogArticles()).find((item) => item.slug === slug);
  return article ? createBlogArticleMetadata(article) : {};
}

export default async function BlogArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const articles = await loadPublishedBlogArticles();
  const article = articles.find((item) => item.slug === slug);
  if (!article) notFound();
  const url = `${getSiteUrl()}/blog/${article.slug}`;
  const jsonLd = [createBlogArticleJsonLd(article), createBlogBreadcrumbJsonLd(article)];
  const date = new Intl.DateTimeFormat("pt-PT", { dateStyle: "long" }).format(new Date(`${article.publishedAt}T12:00:00`));
  const headings = article.body.flatMap((block, index) => block.type === "heading" ? [{ ...block, id: blogHeadingId(block.text, index) }] : []);
  return (
    <div className="blogShell">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link href="/blog">Blog</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{article.title}</span>
      </nav>

      <article className={styles.articlePage}>
        <header className={styles.articleHeader}>
          <div className={styles.articleMeta}>
            <span>{article.category}</span>
            <span>{article.readingMinutes} min de leitura</span>
            <time dateTime={article.publishedAt}>{date}</time>
          </div>
          <h1>{article.title}</h1>
          {article.subtitle && <p className={styles.articleLead}>{article.subtitle}</p>}
          <p className={styles.articleLead}>{article.excerpt}</p>
          <ul className={styles.articleTags} aria-label="Etiquetas">
            {article.tags.map((tag) => <li className={styles.articleTag} key={tag}>{tag}</li>)}
          </ul>
        </header>

        <div className={styles.articleLayout}>
          <div className={styles.articleMain}>
            <ArticleBody body={article.body} />
          </div>
          {headings.length > 0 ? (
            <aside className={styles.toc} aria-label="Nesta página">
              <p className={styles.tocTitle}>Nesta página</p>
              <ol>
                {headings.map((heading) => (
                  <li key={heading.id} className={heading.level === 3 ? styles.tocNested : undefined}>
                    <a href={`#${heading.id}`}>{heading.text}</a>
                  </li>
                ))}
              </ol>
            </aside>
          ) : null}
        </div>

        <ArticleSources sources={article.sources} />
        <ShareActions title={article.title} url={url} />
        <RelatedArticles articles={getRelatedBlogArticles(article, 3, articles)} />
        <NewsletterCTA />
      </article>
    </div>
  );
}
