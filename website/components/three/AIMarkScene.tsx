"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useRef, useState } from "react";
import type { SceneQuality } from "./scene-quality";
import { AIOrganism } from "./AIOrganism";

type AIMarkSceneProps = {
  quality: SceneQuality;
};

const CAMERA = { position: [0, 0, 6.5] as [number, number, number], fov: 42 };
const GL_OPTIONS = {
  alpha: true,
  antialias: false,
  powerPreference: "low-power" as const,
};

function useInViewPause(rootRef: React.RefObject<HTMLDivElement | null>) {
  const [isInView, setIsInView] = useState(true);
  const [isDocumentVisible, setIsDocumentVisible] = useState(true);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    setIsDocumentVisible(document.visibilityState !== "hidden");

    const handleVisibilityChange = () => {
      setIsDocumentVisible(document.visibilityState !== "hidden");
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            ([entry]) => setIsInView(entry?.isIntersecting ?? false),
            { rootMargin: "12%" },
          );

    observer?.observe(root);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      observer?.disconnect();
    };
  }, [rootRef]);

  return !isInView || !isDocumentVisible;
}

export function AIMarkScene({ quality }: AIMarkSceneProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const paused = useInViewPause(rootRef);

  return (
    <div ref={rootRef} aria-hidden="true" className="lumenva-ai-scene">
      <Canvas
        camera={CAMERA}
        dpr={quality.dpr}
        flat
        frameloop={paused ? "never" : "always"}
        gl={GL_OPTIONS}
        fallback={null}
      >
        <Suspense fallback={null}>
          <AIOrganism
            key={quality.particleCount}
            particleCount={quality.particleCount}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
