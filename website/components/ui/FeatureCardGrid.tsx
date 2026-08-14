import type { ComponentType, SVGProps } from "react";
import styles from "./FeatureCardGrid.module.css";

export type FeatureCardIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;

export interface FeatureCard {
  readonly icon: FeatureCardIcon;
  readonly title: string;
  readonly description: string;
}

export interface FeatureCardGridProps {
  readonly items: readonly FeatureCard[];
  readonly ariaLabel: string;
}

export function FeatureCardGrid({ ariaLabel, items }: Readonly<FeatureCardGridProps>) {
  return (
    <ul aria-label={ariaLabel} className={styles.grid}>
      {items.map(({ description, icon: Icon, title }) => (
        <li className={styles.card} key={title}>
          <Icon aria-hidden="true" className={styles.icon} size={20} strokeWidth={1.8} />
          <p className={styles.title}>{title}</p>
          <p className={styles.description}>{description}</p>
        </li>
      ))}
    </ul>
  );
}
