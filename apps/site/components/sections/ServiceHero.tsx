import type { IconWeight } from "@phosphor-icons/react";
import type { ComponentType, ReactNode, SVGProps } from "react";
import { demoCta } from "@/content/site";
import { Button } from "@/components/ui/Button";
import styles from "./InnerPages.module.css";

export type ServiceHeroIcon = ComponentType<
  SVGProps<SVGSVGElement> & {
    size?: number;
    weight?: IconWeight;
    color?: string;
  }
>;

export interface ServiceHeroChip {
  readonly icon: ServiceHeroIcon;
  readonly label: string;
}

export interface ServiceHeroProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly capabilities: readonly ServiceHeroChip[];
  readonly visual?: ReactNode;
  readonly ctaHref?: `/${string}` | `#${string}`;
}
export function ServiceHero({
  capabilities,
  ctaHref = "/contato",
  description,
  eyebrow,
  title,
  visual,
}: Readonly<ServiceHeroProps>) {
  return (
    <section className={styles.hero} aria-labelledby="service-title">
      <div className={`site-shell ${styles.heroInner} ${visual ? "" : styles.heroInnerNoVisual}`}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h1 className={styles.title} id="service-title">
            {title}
          </h1>
          <p className={styles.description}>{description}</p>
          <Button className={styles.heroAction} href={ctaHref} variant="primary">
            {demoCta.label}
          </Button>
          <ul className={styles.chipRow} aria-label="Capacidades principais">
            {capabilities.map(({ icon: Icon, label }) => (
              <li className={styles.chip} key={label}>
                <Icon aria-hidden="true" size={16} weight="duotone" color="currentColor" />
                {label}
              </li>
            ))}
          </ul>
        </div>
        {visual ? <div className={styles.heroVisual}>{visual}</div> : null}
      </div>
    </section>
  );
}
