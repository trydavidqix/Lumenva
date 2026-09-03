"use client";

import { useEffect, useRef } from "react";
import { Reveal } from "@/components/motion/Reveal";
import { useReducedMotion } from "@/components/motion/ReducedMotionProvider";
import type { AgentNarrativeStep } from "@/content/home";
import styles from "./HomeSections.module.css";
import { loadGsap } from "../motion/gsap-client";

export function AgentNarrative({ steps }: Readonly<{ steps: readonly AgentNarrativeStep[] }>) {
  const rootRef = useRef<HTMLDivElement>(null);
  const introRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const media = typeof window !== "undefined" ? window.matchMedia : undefined;
    if (reducedMotion || !media || !media("(min-width: 64rem) and (pointer: fine)").matches || media("(prefers-reduced-motion: reduce)").matches) return;
    let cancelled = false;
    let revert = () => {};
    void loadGsap().then(({ gsap, ScrollTrigger }) => {
      if (cancelled || !rootRef.current || !introRef.current) return;
      gsap.registerPlugin(ScrollTrigger);
      const context = gsap.context(() => {
        ScrollTrigger.create({ trigger: rootRef.current, start: "top top+=96", end: "bottom bottom-=96", pin: introRef.current, pinSpacing: false });
      }, rootRef);
      revert = () => context.revert();
    });
    return () => { cancelled = true; revert(); };
  }, [reducedMotion]);

  return (
    <section className={styles.sectionAlt} aria-labelledby="agents-title">
      <div className={`site-shell ${styles.agentLayout}`} ref={rootRef}>
        <div className={styles.agentIntro} ref={introRef}>
          <p className={styles.eyebrow}>Inteligência artificial</p>
          <h2 className={styles.sectionTitle} id="agents-title">Agentes de IA, sob controlo humano.</h2>
          <p className={styles.sectionDescription}>Um fluxo conectado para atender, agir e devolver contexto à equipa.</p>
        </div>
        <Reveal>
          <ol className={styles.steps}>
            {steps.map((step) => <li className={styles.step} key={step.label}><div className={styles.stepHeader}><span className={styles.index}>{step.label}</span><h3 className={styles.stepTitle}>{step.title}</h3></div><p className={styles.itemDescription}>{step.description}</p></li>)}
          </ol>
        </Reveal>
      </div>
    </section>
  );
}
