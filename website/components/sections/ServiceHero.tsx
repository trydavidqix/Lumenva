import { Button } from "@/components/ui/Button";
import styles from "./InnerPages.module.css";

export interface ServiceHeroProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly capabilities: readonly string[];
  readonly ctaHref?: `/${string}` | `#${string}`;
}
export function ServiceHero({
  capabilities,
  ctaHref = "/contato",
  description,
  eyebrow,
  title,
}: Readonly<ServiceHeroProps>) {
  return (
    <section className={styles.hero} aria-labelledby="service-title">
      <div className={`site-shell ${styles.heroInner}`}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h1 className={styles.title} id="service-title">
            {title}
          </h1>
          <p className={styles.description}>{description}</p>
          <Button className={styles.heroAction} href={ctaHref} variant="primary">
            Solicitar demonstração
          </Button>
        </div>
        <ol className={styles.capabilityList} aria-label="Capacidades principais">
          {capabilities.map((capability, index) => (
            <li className={styles.capabilityItem} key={capability}>
              <span className={styles.capabilityIndex} aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span>{capability}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
