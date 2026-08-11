import type { LucideIcon } from "lucide-react";
import styles from "./SidebarNav.module.css";

export interface SidebarNavItem {
  readonly label: string;
  readonly icon: LucideIcon;
}

export interface SidebarNavProps {
  readonly items: readonly SidebarNavItem[];
  readonly activeLabel: string;
}

export function SidebarNav({ activeLabel, items }: Readonly<SidebarNavProps>) {
  return (
    <nav className={styles.nav}>
      <span className={styles.wordmark}>LUMENVA</span>
      <ul className={styles.list}>
        {items.map(({ icon: Icon, label }) => (
          <li className={styles.item} data-active={label === activeLabel} key={label}>
            <Icon size={14} strokeWidth={1.8} />
            {label}
          </li>
        ))}
      </ul>
    </nav>
  );
}
