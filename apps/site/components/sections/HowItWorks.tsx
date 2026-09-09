import { Reveal } from "@/components/motion/Reveal";
import type { HowItWorksStep } from "@/content/home";
import styles from "./HomeSections.module.css";

export interface HowItWorksProps {
  readonly steps: readonly HowItWorksStep[];
}

export function HowItWorks({ steps }: Readonly<HowItWorksProps>) {
  return (
    <section className={styles.sectionAlt} aria-labelledby="how-it-works-title">
      <div className={`site-shell ${styles.howLayout}`}>
        <Reveal className={styles.sectionHeader}>
          <p className={styles.eyebrow}>Como funciona</p>
          <h2 className={styles.sectionTitle} id="how-it-works-title">
            Um fluxo único, do canal ao CRM.
          </h2>
          <p className={styles.sectionDescription}>
            A operação parte do WhatsApp e preserva contexto para agentes e pessoas.
          </p>
        </Reveal>
        <Reveal>
          <ol className={`${styles.steps} ${styles.stepRail}`}>
            {steps.map((step) => (
              <li className={styles.step} key={step.label}>
                <div className={styles.stepHeader}>
                  <span className={styles.index}>{step.label}</span>
                  <h3 className={styles.stepTitle}>{step.title}</h3>
                </div>
                <p className={styles.itemDescription}>{step.description}</p>
              </li>
            ))}
          </ol>
        </Reveal>
      </div>
    </section>
  );
}
