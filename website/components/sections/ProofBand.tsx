import type { ProofPoint } from "@/content/home";
import styles from "./HomeSections.module.css";

export interface ProofBandProps {
  readonly items: readonly ProofPoint[];
}

export function ProofBand({ items }: Readonly<ProofBandProps>) {
  return (
    <section aria-label="Propriedades da plataforma" className={styles.proofBand}>
      <div className="site-shell">
        <ul className={styles.proofList}>
          {items.map((item) => (
            <li className={styles.proofItem} key={item.label}>
              <p className={styles.proofLabel}>{item.label}</p>
              <p className={styles.itemDescription}>{item.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
