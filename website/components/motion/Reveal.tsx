"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { type ReactNode, useRef } from "react";
import { useReducedMotion } from "./ReducedMotionProvider";

if (typeof window !== "undefined") {
  gsap.registerPlugin(useGSAP);
  if (typeof window.matchMedia === "function") {
    gsap.registerPlugin(ScrollTrigger);
  }
}

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
};

export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;

      if (typeof window.matchMedia !== "function") {
        gsap.set(root, { autoAlpha: 1, y: 0 });
        return;
      }

      const prefersReducedMotion =
        reducedMotion ||
        (typeof window.matchMedia === "function" &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches);

      if (prefersReducedMotion) {
        gsap.set(root, { autoAlpha: 1, y: 0 });
        return;
      }

      gsap.fromTo(
        root,
        { autoAlpha: 0, y: 18 },
        {
          autoAlpha: 1,
          y: 0,
          delay,
          duration: 0.72,
          ease: "power2.out",
          scrollTrigger: {
            trigger: root,
            start: "top 88%",
            once: true,
          },
        },
      );
    },
    {
      dependencies: [delay, reducedMotion],
      revertOnUpdate: true,
      scope: rootRef,
    },
  );

  return (
    <div ref={rootRef} className={className}>
      {children}
    </div>
  );
}
