import styles from "./SectionIntro.module.css";

export interface SectionIntroProps {
  readonly title: string;
  readonly description?: string;
  readonly eyebrow?: string;
  readonly headingLevel?: "h2" | "h3";
}

export function SectionIntro({
  description,
  eyebrow,
  headingLevel: Heading = "h2",
  title,
}: Readonly<SectionIntroProps>) {
  return (
    <div className={styles.intro}>
      {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
      <Heading className={styles.title}>{title}</Heading>
      {description ? <p className={styles.description}>{description}</p> : null}
    </div>
  );
}
