import type { BlogArticle } from "@/lib/blog/types";
import { BlogList } from "./BlogList";
import styles from "./blog.module.css";
export function BlogRelated({ articles }: Readonly<{ articles: readonly BlogArticle[] }>) { if (!articles.length) return null; return <section className={styles.related} aria-labelledby="blog-related-title"><h2 id="blog-related-title">Também pode interessar</h2><BlogList articles={articles} /></section>; }
