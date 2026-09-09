"use client";

import { useMemo, useState } from "react";
import type { BlogArticle } from "@/lib/blog/types";
import { searchBlogArticles } from "@/lib/blog/search";
import { BlogList } from "./BlogList";
import styles from "./blog.module.css";

export function BlogSearch({ articles, excludeSlug }: Readonly<{ articles: readonly BlogArticle[]; excludeSlug?: string }>) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchBlogArticles(query, articles).filter((article) => article.slug !== excludeSlug), [articles, excludeSlug, query]);

  return (
    <section className={styles.search} role="search" aria-label="Pesquisar no blog">
      <label htmlFor="blog-search">Pesquisar artigos</label>
      <input
        id="blog-search"
        name="q"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Pesquisar por tema, título ou tag"
      />
      <p className={styles.searchStatus} role="status" aria-live="polite">{query ? `${results.length} ${results.length === 1 ? "artigo encontrado" : "artigos encontrados"}` : `${results.length} artigos`}</p>
      <BlogList articles={results} />
    </section>
  );
}
