import styles from "./StatCard.module.css";

export interface StatCardProps {
  readonly label: string;
  readonly value: string;
  readonly delta?: string;
}

export function StatCard({ delta, label, value }: Readonly<StatCardProps>) {
  return (
    <div className={styles.card}>
      <p className={styles.label}>{label}</p>
      <p className={styles.value}>{value}</p>
      {delta ? <p className={styles.delta}>{delta}</p> : null}
    </div>
  );
}
