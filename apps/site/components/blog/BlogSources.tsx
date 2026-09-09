import type { BlogSource } from "@/lib/blog/types";
import styles from "./blog.module.css";
export function BlogSources({ sources }: Readonly<{ sources: readonly BlogSource[] }>) { if (!sources.length) return null; return <section className={styles.sources} aria-labelledby="blog-sources-title"><h2 id="blog-sources-title">Fontes</h2><ol className={styles.sourceList}>{sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.label}</a></li>)}</ol></section>; }
