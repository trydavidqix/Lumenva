"use client";

import Link from "next/link";
import {
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { MagneticButton } from "@/components/motion/MagneticButton";
import styles from "./Button.module.css";

export interface ButtonProps {
  readonly children: ReactNode;
  readonly href?: string;
  readonly variant: "primary" | "secondary";
  readonly magnetic?: boolean;
  readonly className?: string;
  readonly onClick?: ButtonHTMLAttributes<HTMLButtonElement>["onClick"];
  readonly type?: ButtonHTMLAttributes<HTMLButtonElement>["type"];
  readonly target?: AnchorHTMLAttributes<HTMLAnchorElement>["target"];
  readonly rel?: AnchorHTMLAttributes<HTMLAnchorElement>["rel"];
}

function classNames(...names: Array<string | undefined>) {
  return names.filter(Boolean).join(" ");
}

export function Button({
  children,
  className,
  href,
  magnetic = false,
  onClick,
  rel,
  target,
  type = "button",
  variant,
}: Readonly<ButtonProps>) {
  const buttonClassName = classNames(styles.button, styles[variant], className);
  const control = href ? (
    <Link className={buttonClassName} href={href} rel={rel} target={target}>
      {children}
    </Link>
  ) : (
    <button className={buttonClassName} onClick={onClick} type={type}>
      {children}
    </button>
  );

  return magnetic ? <MagneticButton>{control}</MagneticButton> : control;
}
