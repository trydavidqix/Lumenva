import Image from "next/image";
import type { BlogBlock } from "@/lib/blog/types";
import styles from "./blog.module.css";
export const blogHeadingId = (text: string, index: number) => `sec-${text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "section"}-${index}`;
export function BlogArticleBody({ blocks }: Readonly<{ blocks: readonly BlogBlock[] }>) {
  return (
    <div className={styles.body}>
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;
        if (block.type === "paragraph") return <p key={key}>{block.text}</p>;
        if (block.type === "heading") {
          const id = blogHeadingId(block.text, index);
          return block.level === 2 ? <h2 id={id} key={key}>{block.text}</h2> : <h3 id={id} key={key}>{block.text}</h3>;
        }
        if (block.type === "bullets") return <ul key={key}>{block.items.map((item) => <li key={item}>{item}</li>)}</ul>;
        if (block.type === "quote") return <blockquote className={styles.quote} key={key}><p>{block.text}</p>{block.cite ? <cite>{block.cite}</cite> : null}</blockquote>;
        if (block.type === "callout") return <aside className={styles.callout} key={key}>{block.title ? <p className={styles.calloutTitle}>{block.title}</p> : null}<p>{block.text}</p></aside>;
        return <figure className={styles.figure} key={key}><Image src={block.src} alt={block.alt} width={1200} height={675} sizes="(max-width: 65rem) 100vw, 65rem" />{block.caption ? <figcaption className={styles.caption}>{block.caption}</figcaption> : null}</figure>;
      })}
    </div>
  );
}
