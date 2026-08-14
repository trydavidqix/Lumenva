import type { ReactNode } from "react";
import styles from "./AppWindow.module.css";

export interface AppWindowProps {
  readonly sidebar: ReactNode;
  readonly children: ReactNode;
  readonly panel?: ReactNode;
}

export function AppWindow({ children, panel, sidebar }: Readonly<AppWindowProps>) {
  return (
    <div aria-hidden="true" className={styles.window}>
      <div className={styles.chrome}>
        <span className={styles.dots}>
          <span className={styles.dot} />
          <span className={styles.dot} />
          <span className={styles.dot} />
        </span>
        <span className={styles.caption}>Pré-visualização ilustrativa</span>
      </div>
      <div className={panel ? styles.body : `${styles.body} ${styles.bodyNoPanel}`}>
        <div className={styles.sidebar}>{sidebar}</div>
        <div className={styles.main}>{children}</div>
        {panel ? <div className={styles.panel}>{panel}</div> : null}
      </div>
    </div>
  );
}
