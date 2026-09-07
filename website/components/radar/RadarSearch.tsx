"use client";
import { useMemo, useState } from "react";
import type { RadarArticle } from "@/lib/radar/types";
import { searchRadarArticles } from "@/lib/radar/search";
import { ArticleList } from "./ArticleList";
import styles from "./radar.module.css";

export function RadarSearch({ articles }: { articles: RadarArticle[] }) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchRadarArticles(query, articles), [query, articles]);
  return (
    <section className={styles.section} aria-labelledby="radar-search-title">
      <p className={styles.eyebrow}>PESQUISA</p>
      <h2 id="radar-search-title">Encontre no Radar</h2>
      <label htmlFor="radar-search">Pesquisar por tema, categoria ou tag</label>
      <input id="radar-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex.: agentes, automação, CRM" />
      {query && <p aria-live="polite">{results.length} resultado(s)</p>}
      {query && <ArticleList articles={results} />}
    </section>
  );
}
