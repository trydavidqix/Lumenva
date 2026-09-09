import { Reveal } from "@/components/motion/Reveal";
import type { FaqItem } from "@/content/faq";
import styles from "./HomeSections.module.css";

export interface FAQProps {
  readonly items: readonly FaqItem[];
}

export function FAQ({ items }: Readonly<FAQProps>) {
  return (
    <section className={styles.section} aria-labelledby="faq-title">
      <div className="site-shell">
        <Reveal className={styles.sectionHeader}>
          <p className={styles.eyebrow}>Perguntas frequentes</p>
          <h2 className={styles.sectionTitle} id="faq-title">
            Respostas diretas sobre a Lumenva.
          </h2>
        </Reveal>
        <div className={styles.faqList}>
          {items.map((item) => (
            <details className={styles.faqItem} key={item.question}>
              <summary className={styles.faqQuestion}>{item.question}</summary>
              <p className={styles.faqAnswer}>{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
