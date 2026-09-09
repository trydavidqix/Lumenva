import type { FaqItem } from "@/content/faq";
import styles from "./InnerPages.module.css";

export interface ProseFAQProps {
  readonly title: string;
  readonly description: string;
  readonly items: readonly FaqItem[];
}

export function ProseFAQ({
  description,
  items,
  title,
}: Readonly<ProseFAQProps>) {
  return (
    <section className={styles.faqSection} aria-labelledby="route-faq-title">
      <div className="site-shell reading-measure">
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle} id="route-faq-title">
            {title}
          </h2>
          <p className={styles.sectionCopy}>{description}</p>
        </div>
        <dl className={styles.faqList}>
          {items.map((item) => (
            <div className={styles.faqItem} key={item.question}>
              <dt className={styles.faqQuestion}>{item.question}</dt>
              <dd className={styles.faqAnswer}>{item.answer}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
