"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { useReducedMotion } from "./ReducedMotionProvider";
import { loadGsap } from "./gsap-client";

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
};

export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const root = rootRef.current;
    const media = typeof window !== "undefined" ? window.matchMedia : undefined;
    if (!root || !media) return;

    const desktopPointer = media("(min-width: 64rem) and (pointer: fine)");
    const prefersReducedMotion = reducedMotion || media("(prefers-reduced-motion: reduce)").matches;
    if (!desktopPointer.matches || prefersReducedMotion) return;

    let cancelled = false;
    let revert = () => {};
    void loadGsap().then(({ gsap, ScrollTrigger }) => {
      if (cancelled || !rootRef.current) return;
      gsap.registerPlugin(ScrollTrigger);
      const context = gsap.context(() => {
        gsap.fromTo(
          root,
          { autoAlpha: 0, y: 18 },
          {
            autoAlpha: 1,
            y: 0,
            delay,
            duration: 0.72,
            ease: "power2.out",
            scrollTrigger: { trigger: root, start: "top 88%", once: true },
          },
        );
      }, root);
      revert = () => context.revert();
    });

    return () => {
      cancelled = true;
      revert();
    };
  }, [delay, reducedMotion]);

  return (
    <div ref={rootRef} className={className}>
      {children}
    </div>
  );
}
