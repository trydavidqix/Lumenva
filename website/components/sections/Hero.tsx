import { homeContent } from "@/content/home";
import { demoCta } from "@/content/site";
import { Button } from "@/components/ui/Button";
import { ProductPreview } from "@/components/sections/ProductPreview";
import styles from "./Hero.module.css";

export function Hero() {
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={`site-shell ${styles.layout}`}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>{homeContent.eyebrow}</p>
          <h1 id="hero-title" className={styles.title}>
            {homeContent.title}
          </h1>
          <p className={styles.description}>{homeContent.description}</p>
          <div className={styles.actions}>
            <Button className={styles.primaryAction} href={demoCta.href} magnetic variant="primary">
              {demoCta.label}
            </Button>
            <Button
              className={styles.secondaryAction}
              href={homeContent.secondaryCta.href}
              variant="secondary"
            >
              {homeContent.secondaryCta.label}
            </Button>
          </div>
        </div>

        <div className={styles.previewStage}>
          <ProductPreview />
        </div>
      </div>
    </section>
  );
}
