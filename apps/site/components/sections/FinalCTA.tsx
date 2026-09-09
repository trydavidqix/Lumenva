import { Reveal } from "@/components/motion/Reveal";
import { Button } from "@/components/ui/Button";
import type { FinalCtaItem } from "@/content/home";
import styles from "./HomeSections.module.css";

export interface FinalCTAProps {
  readonly items: readonly FinalCtaItem[];
}

export function FinalCTA({ items }: Readonly<FinalCTAProps>) {
  return items.map((item, index) => {
    const titleId = `final-cta-title-${index}`;

    return (
      <section className={styles.finalCta} aria-labelledby={titleId} key={item.title}>
        <div className={`site-shell ${styles.finalCtaInner}`}>
          <Reveal className={styles.sectionHeader}>
            <p className={styles.eyebrow}>{item.eyebrow}</p>
            <h2 className={styles.sectionTitle} id={titleId}>
              {item.title}
            </h2>
            <p className={styles.sectionDescription}>{item.description}</p>
          </Reveal>
          <Button className={styles.finalCtaAction} href={item.href} variant="primary">
            {item.label}
          </Button>
        </div>
      </section>
    );
  });
}
