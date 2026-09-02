"use client";

import Link from "next/link";
import { Robot, Kanban, FlowArrow } from "@phosphor-icons/react";
import { useEffect, useId, useRef, useState, type FocusEvent, type ComponentType, type SVGProps } from "react";
import { solutionsMenu, type SolutionMenuItem } from "@/content/site";
import { WhatsAppIcon } from "@/components/ui/BrandIcons";
import styles from "./SolutionsMenu.module.css";

type MenuIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number; weight?: "thin" | "light" | "regular" | "bold" | "duotone" | "fill" }>;

const icons: Record<SolutionMenuItem["icon"], MenuIcon> = {
  atendimento: WhatsAppIcon,
  vendas: Kanban,
  agentes: Robot,
  automacao: FlowArrow,
};

export interface SolutionsMenuProps {
  readonly triggerClassName?: string;
}

export function SolutionsMenu({ triggerClassName }: Readonly<SolutionsMenuProps>) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  function onBlurCapture(event: FocusEvent<HTMLDivElement>) {
    if (!rootRef.current?.contains(event.relatedTarget as Node | null)) {
      setIsOpen(false);
    }
  }

  return (
    <div
      className={styles.root}
      onBlurCapture={onBlurCapture}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      ref={rootRef}
    >
      <button
        aria-controls={panelId}
        aria-expanded={isOpen}
        className={[styles.trigger, triggerClassName].filter(Boolean).join(" ")}
        onClick={() => setIsOpen((value) => !value)}
        type="button"
      >
        Soluções
        <span aria-hidden="true" className={styles.chevron} data-open={isOpen} />
      </button>
      {isOpen ? (
        <nav aria-label="Soluções" className={styles.panel} id={panelId}>
          {solutionsMenu.map((item) => {
            const Icon = icons[item.icon];
            return (
              <Link
                className={styles.item}
                href={item.href}
                key={item.href}
                onClick={() => setIsOpen(false)}
              >
                <Icon aria-hidden="true" className={styles.icon} size={20} weight="duotone" color="currentColor" />
                <span className={styles.itemCopy}>
                  <span className={styles.itemTitle}>{item.label}</span>
                  <span className={styles.itemDescription}>{item.description}</span>
                </span>
              </Link>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}
