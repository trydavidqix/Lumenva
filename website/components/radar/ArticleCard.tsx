"use client";
import Image from "next/image";
import Link from "next/link";
import type { RadarArticle } from "@/lib/radar/types";
import { trackRadarEvent } from "@/lib/radar/telemetry";
import styles from "./radar.module.css";

export function ArticleCard({ article }: { article: RadarArticle }) {
  return <article className={styles.card}>
    {article.cover ? <Link onClick={() => trackRadarEvent("radar_related_click", { slug: article.slug })} className={styles.cardImage} href={`/radar/${article.slug}`} aria-label={`Abrir ${article.title}`}><Image src={article.cover.src} alt={article.cover.alt} width={640} height={360} /></Link> : null}
    <p className={styles.eyebrow}>{article.category} · {article.readingMinutes} min de leitura</p>
    <h3><Link onClick={() => trackRadarEvent("radar_related_click", { slug: article.slug })} href={`/radar/${article.slug}`}>{article.title}</Link></h3>
    <p>{article.excerpt}</p>
    <Link className={styles.textLink} href={`/radar/${article.slug}`}>Ler artigo <span aria-hidden="true">→</span></Link>
  </article>;
}
