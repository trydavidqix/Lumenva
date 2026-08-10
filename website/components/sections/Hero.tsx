"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { ReducedMotionProvider, useReducedMotion } from "../motion/ReducedMotionProvider";
import { getSceneQuality, type SceneQuality } from "../three/scene-quality";
import { homeContent } from "@/content/home";
import { demoCta } from "@/content/site";
import { Button } from "@/components/ui/Button";
import styles from "./Hero.module.css";

if (typeof window !== "undefined") {
  gsap.registerPlugin(useGSAP);
}

const AIMarkScene = dynamic(
  () => import("../three/AIMarkScene").then((module) => module.AIMarkScene),
  { ssr: false },
);

const DISABLED_SCENE: SceneQuality = {
  enabled: false,
  dpr: [1, 1],
  particleCount: 0,
};

type NavigatorWithCapabilities = Navigator & {
  connection?: { saveData?: boolean };
  deviceMemory?: number;
};

function HeroContent() {
  const markRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const [sceneQuality, setSceneQuality] =
    useState<SceneQuality>(DISABLED_SCENE);

  useEffect(() => {
    const updateQuality = () => {
      const navigatorCapabilities = navigator as NavigatorWithCapabilities;
      const quality = getSceneQuality({
        width: window.innerWidth,
        deviceMemory: navigatorCapabilities.deviceMemory,
        reducedMotion:
          reducedMotion ||
          (typeof window.matchMedia === "function" &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches),
        saveData: navigatorCapabilities.connection?.saveData ?? false,
      });
      const hasWebGl = typeof window.WebGLRenderingContext !== "undefined";

      setSceneQuality(hasWebGl ? quality : DISABLED_SCENE);
    };

    updateQuality();
    window.addEventListener("resize", updateQuality, { passive: true });

    return () => window.removeEventListener("resize", updateQuality);
  }, [reducedMotion]);

  useGSAP(
    () => {
      const root = markRef.current;
      if (!root) return;

      const letter = root.querySelector<HTMLElement>("[data-mark-letter]");
      const scanLayer = root.querySelector<HTMLElement>("[data-scan-layer]");
      const points = root.querySelectorAll<HTMLElement>("[data-found-point]");

      if (!letter || !scanLayer) return;

      const prefersReducedMotion =
        reducedMotion ||
        (typeof window.matchMedia === "function" &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches);

      if (prefersReducedMotion) {
        gsap.set(letter, { autoAlpha: 1, scale: 1, yPercent: 0 });
        gsap.set(scanLayer, { autoAlpha: 1, rotation: 8, scale: 1 });
        gsap.set(points, { autoAlpha: 1, scale: 1 });
        return;
      }

      const letterDuration = 1.6;
      const radarStart = letterDuration * 0.9;
      const timeline = gsap.timeline();

      timeline
        .fromTo(
          letter,
          { autoAlpha: 0, scale: 0.92, yPercent: 14 },
          {
            autoAlpha: 1,
            scale: 1,
            yPercent: 0,
            duration: letterDuration,
            ease: "power3.out",
          },
        )
        .fromTo(
          scanLayer,
          { autoAlpha: 0, rotation: -8, scale: 0.92 },
          {
            autoAlpha: 1,
            rotation: 8,
            scale: 1,
            duration: 1.8,
            ease: "power2.out",
          },
          radarStart,
        )
        .fromTo(
          points,
          { autoAlpha: 0, scale: 0.4 },
          {
            autoAlpha: 1,
            scale: 1,
            duration: 0.45,
            ease: "power2.out",
            stagger: 0.12,
          },
          radarStart,
        );
    },
    {
      dependencies: [reducedMotion],
      revertOnUpdate: true,
      scope: markRef,
    },
  );

  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={`site-shell ${styles.layout}`}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>{homeContent.eyebrow}</p>
          <h1 id="hero-title" className={styles.title}>
            {homeContent.title}
          </h1>
          <p className={styles.description}>{homeContent.description}</p>
          <div className={styles.actions}>
            <Button className={styles.primaryAction} href={demoCta.href} magnetic variant="primary">
              {demoCta.label}
            </Button>
            <Button
              className={styles.secondaryAction}
              href={homeContent.secondaryCta.href}
              variant="secondary"
            >
              {homeContent.secondaryCta.label}
            </Button>
          </div>
        </div>

        <div className={styles.markStage}>
          <div
            ref={markRef}
            className={styles.mark}
            role="img"
            aria-label="Marca Lumenva: letra L sobre radar circular"
          >
            {sceneQuality.enabled ? (
              <div className={styles.scene}>
                <AIMarkScene quality={sceneQuality} />
              </div>
            ) : null}

            <span className={styles.scanLayer} data-scan-layer aria-hidden="true">
              <span className={`${styles.ring} ${styles.ringOuter}`} />
              <span className={`${styles.ring} ${styles.ringMiddle}`} />
              <span className={`${styles.ring} ${styles.ringInner}`} />
              <span className={`${styles.axis} ${styles.axisHorizontal}`} />
              <span className={`${styles.axis} ${styles.axisVertical}`} />
              <span className={styles.sweep} />
              <span
                className={`${styles.point} ${styles.pointOne}`}
                data-found-point
              />
              <span
                className={`${styles.point} ${styles.pointTwo}`}
                data-found-point
              />
              <span
                className={`${styles.point} ${styles.pointThree}`}
                data-found-point
              />
            </span>
            <span className={styles.letter} data-mark-letter>
              L
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Hero() {
  return (
    <ReducedMotionProvider>
      <HeroContent />
    </ReducedMotionProvider>
  );
}
