"use client";

import {
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
  useState,
} from "react";
import { useMediaQuery } from "@/hooks/useMediaQuery";

export interface MagneticButtonProps {
  readonly children: ReactNode;
}

const motionStyle = (event: PointerEvent<HTMLSpanElement>): CSSProperties => {
  const bounds = event.currentTarget.getBoundingClientRect();
  const x = (event.clientX - bounds.left - bounds.width / 2) * 0.08;
  const y = (event.clientY - bounds.top - bounds.height / 2) * 0.08;

  return { transform: `translate3d(${x}px, ${y}px, 0)` };
};

export function MagneticButton({ children }: Readonly<MagneticButtonProps>) {
  const hasFinePointer = useMediaQuery("(pointer: fine)");
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [isKeyboardFocused, setIsKeyboardFocused] = useState(false);

  if (!hasFinePointer || prefersReducedMotion || isKeyboardFocused) {
    return <>{children}</>;
  }

  return (
    <span
      onBlurCapture={() => setIsKeyboardFocused(false)}
      onFocusCapture={() => setIsKeyboardFocused(true)}
      onPointerLeave={(event) => {
        event.currentTarget.style.transform = "";
      }}
      onPointerMove={(event) => {
        Object.assign(event.currentTarget.style, motionStyle(event));
      }}
      style={{ transition: "transform var(--duration-fast) var(--ease-standard)" }}
    >
      {children}
    </span>
  );
}
