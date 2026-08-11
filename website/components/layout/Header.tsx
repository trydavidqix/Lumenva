import Link from "next/link";
import { demoCta, navigation, shellContent, siteName } from "@/content/site";
import { Button } from "@/components/ui/Button";
import { LumenvaMark } from "@/components/ui/LumenvaMark";
import { MobileNavigation } from "./MobileNavigation";
import { SolutionsMenu } from "./SolutionsMenu";
import styles from "./Header.module.css";

export interface HeaderProps {
  readonly children?: never;
}

export function Header() {
  return (
    <header className={styles.header}>
      <a className="skip-link" href="#main-content">
        {shellContent.skipToContentLabel}
      </a>
      <div className={`site-shell ${styles.inner}`}>
        <Link aria-label={siteName} className={styles.wordmark} href="/">
          <LumenvaMark size={22} />
          {siteName}
        </Link>
        <nav
          aria-label={shellContent.primaryNavigationLabel}
          className={styles.desktopNavigation}
        >
          <div className={styles.desktopLinks}>
            {navigation.map((item) =>
              item.label === "Soluções" ? (
                <SolutionsMenu key={item.href} />
              ) : (
                <Link className={styles.navigationLink} href={item.href} key={item.href}>
                  {item.label}
                </Link>
              ),
            )}
          </div>
        </nav>
        <Button
          className={styles.demoAction}
          href={demoCta.href}
          magnetic
          variant="primary"
        >
          {demoCta.label}
        </Button>
        <MobileNavigation className={styles.mobileMenuButton} />
      </div>
    </header>
  );
}
