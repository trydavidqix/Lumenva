"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { demoCta, navigation, shellContent, siteName } from "@/content/site";
import { Button } from "@/components/ui/Button";
import { LumenvaMark } from "@/components/ui/LumenvaMark";
import { MobileNavigation } from "./MobileNavigation";
import { SolutionsMenu } from "./SolutionsMenu";
import styles from "./Header.module.css";
import { loadGsap } from "../motion/gsap-client";

export interface HeaderProps {
  readonly children?: never;
}

const OPEN_GAP = "2.75rem";
const COMPACT_GAP = "1rem";
const OPEN_MIN_HEIGHT = "4.5rem";
const COMPACT_MIN_HEIGHT = "4rem";
const SCROLL_RANGE = 140;

export function Header() {
  const headerRef = useRef<HTMLElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const linksRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const media = typeof window !== "undefined" ? window.matchMedia : undefined;
    if (!media || !media("(min-width: 64rem) and (pointer: fine)").matches || media("(prefers-reduced-motion: reduce)").matches) return;
    let cancelled = false;
    let revert = () => {};
    void loadGsap().then(({ gsap, ScrollTrigger }) => {
      if (cancelled || !linksRef.current || !innerRef.current) return;
      gsap.registerPlugin(ScrollTrigger);
      const context = gsap.context(() => {
        gsap.set(linksRef.current, { gap: OPEN_GAP });
        gsap.set(innerRef.current, { minHeight: OPEN_MIN_HEIGHT });
        const scrollFx = gsap.timeline({ scrollTrigger: { trigger: document.body, start: "top top", end: `+=${SCROLL_RANGE}`, scrub: 0.5 } });
        scrollFx.to(linksRef.current, { gap: COMPACT_GAP, ease: "none" }, 0).to(innerRef.current, { minHeight: COMPACT_MIN_HEIGHT, ease: "none" }, 0);
      }, headerRef);
      revert = () => context.revert();
    });
    return () => { cancelled = true; revert(); };
  }, []);

  return (
    <header className={styles.header} ref={headerRef}>
      <a className="skip-link" href="#main-content">
        {shellContent.skipToContentLabel}
      </a>
      <div className={`site-shell ${styles.inner}`} ref={innerRef}>
        <Link aria-label={siteName} className={styles.wordmark} href="/">
          <LumenvaMark priority size={50} />
          {siteName}
        </Link>
        <nav
          aria-label={shellContent.primaryNavigationLabel}
          className={styles.desktopNavigation}
        >
          <div className={styles.desktopLinks} ref={linksRef}>
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
