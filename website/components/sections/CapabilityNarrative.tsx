"use client";

import { useEffect, useRef } from "react";
import { Reveal } from "@/components/motion/Reveal";
import { useReducedMotion } from "@/components/motion/ReducedMotionProvider";
import type {
  AgentNarrativeStep,
  CapabilitySection,
} from "@/content/home";
import type { Service } from "@/content/services";
import styles from "./HomeSections.module.css";
import { loadGsap } from "../motion/gsap-client";

export interface CapabilityOverviewProps {
  readonly items: readonly Service[];
}

export function CapabilityOverview({ items }: Readonly<CapabilityOverviewProps>) {
  return (
    <section className={styles.section} aria-labelledby="capabilities-title">
      <div className={`site-shell ${styles.sectionStack}`}>
        <Reveal className={styles.sectionHeader}>
          <p className={styles.eyebrow}>O que a Lumenva faz</p>
          <h2 className={styles.sectionTitle} id="capabilities-title">
            Agentes, automações e CRM trabalham como um sistema.
          </h2>
          <p className={styles.sectionDescription}>
            Cada parte partilha o mesmo contexto operacional, do WhatsApp ao pipeline.
          </p>
        </Reveal>
        <Reveal>
          <ul className={styles.overviewList}>
            {items.map((item) => (
              <li className={styles.overviewItem} key={item.name}>
                <p className={styles.itemTitle}>{item.name}</p>
                <p className={styles.itemDescription}>{item.description}</p>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

export interface AgentNarrativeProps {
  readonly steps: readonly AgentNarrativeStep[];
}

export function AgentNarrative({ steps }: Readonly<AgentNarrativeProps>) {
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
          <h2 className={styles.sectionTitle} id="agents-title">
            Agentes de IA, sob controlo humano.
          </h2>
          <p className={styles.sectionDescription}>
            Um fluxo conectado para atender, agir e devolver contexto à equipa.
          </p>
        </div>
        <Reveal>
          <ol className={styles.steps}>
            {steps.map((step) => (
              <li className={styles.step} key={step.label}>
                <div className={styles.stepHeader}>
                  <span className={styles.index}>{step.label}</span>
                  <h3 className={styles.stepTitle}>{step.title}</h3>
                </div>
                <p className={styles.itemDescription}>{step.description}</p>
              </li>
            ))}
          </ol>
        </Reveal>
      </div>
    </section>
  );
}

export interface CapabilitySectionsProps {
  readonly sections: readonly CapabilitySection[];
}

export function CapabilitySections({
  sections,
}: Readonly<CapabilitySectionsProps>) {
  return (
    <div className={styles.capabilitySections}>
      {sections.map((section) => (
        <section
          className={styles.section}
          id={section.id}
          aria-labelledby={`${section.id}-title`}
          key={section.id}
        >
          <div className={`site-shell ${styles.capabilitySection}`}>
            <Reveal className={styles.sectionHeader}>
              <p className={styles.eyebrow}>{section.eyebrow}</p>
              <h2 className={styles.sectionTitle} id={`${section.id}-title`}>
                {section.title}
              </h2>
              <p className={styles.sectionDescription}>{section.description}</p>
            </Reveal>
            <Reveal>
              <ul className={styles.detailList}>
                {section.items.map((item) => (
                  <li className={styles.detailItem} key={item.label}>
                    <h3 className={styles.itemTitle}>{item.label}</h3>
                    <p className={styles.itemDescription}>{item.description}</p>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>
      ))}
    </div>
  );
}
