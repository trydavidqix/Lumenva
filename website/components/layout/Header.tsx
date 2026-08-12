"use client";

import { useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { demoCta, navigation, shellContent, siteName } from "@/content/site";
import { Button } from "@/components/ui/Button";
import { LumenvaMark } from "@/components/ui/LumenvaMark";
import { MobileNavigation } from "./MobileNavigation";
import { SolutionsMenu } from "./SolutionsMenu";
import styles from "./Header.module.css";

gsap.registerPlugin(useGSAP, ScrollTrigger);

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

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add(
        {
          isDesktop: "(min-width: 64rem)",
          reduceMotion: "(prefers-reduced-motion: reduce)",
        },
        (context) => {
          const { isDesktop, reduceMotion } = context.conditions as {
            isDesktop: boolean;
            reduceMotion: boolean;
          };
          if (!isDesktop || !linksRef.current || !innerRef.current) return;

          gsap.set(linksRef.current, { gap: OPEN_GAP });
          gsap.set(innerRef.current, { minHeight: OPEN_MIN_HEIGHT });

          if (reduceMotion) return;

          const scrollFx = gsap.timeline({
            scrollTrigger: {
              trigger: document.body,
              start: "top top",
              end: `+=${SCROLL_RANGE}`,
              scrub: 0.5,
            },
          });
          scrollFx
            .to(linksRef.current, { gap: COMPACT_GAP, ease: "none" }, 0)
            .to(innerRef.current, { minHeight: COMPACT_MIN_HEIGHT, ease: "none" }, 0);

          return () => {
            scrollFx.scrollTrigger?.kill();
            scrollFx.kill();
          };
        },
      );

      return () => mm.revert();
    },
    { scope: headerRef },
  );

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
