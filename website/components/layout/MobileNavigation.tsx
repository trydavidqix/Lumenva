"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { demoCta, navigation, shellContent } from "@/content/site";
import { Button } from "@/components/ui/Button";
import styles from "./MobileNavigation.module.css";

export interface MobileNavigationProps {
  readonly className?: string;
}

export function MobileNavigation({
  className,
}: Readonly<MobileNavigationProps>) {
  const [isOpen, setIsOpen] = useState(false);
  const dialogId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setIsOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    dialogRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [close, isOpen]);

  return (
    <>
      <button
        aria-controls={dialogId}
        aria-expanded={isOpen}
        aria-label={shellContent.openMenuLabel}
        className={className}
        onClick={() => setIsOpen(true)}
        ref={triggerRef}
        type="button"
      >
        <span aria-hidden="true" className={styles.menuIcon} />
      </button>
      {isOpen ? (
        <>
          <button
            aria-label={shellContent.closeMenuLabel}
            className={styles.backdrop}
            onClick={close}
            type="button"
          />
          <div
            aria-labelledby={`${dialogId}-title`}
            aria-modal="true"
            className={styles.dialog}
            id={dialogId}
            ref={dialogRef}
            role="dialog"
          >
            <div className={styles.dialogHeader}>
              <p className={styles.dialogTitle} id={`${dialogId}-title`}>
                {shellContent.mobileNavigationLabel}
              </p>
              <Button
                className={styles.closeButton}
                onClick={close}
                variant="secondary"
              >
                {shellContent.closeMenuLabel}
              </Button>
            </div>
            <nav aria-label={shellContent.mobileNavigationLabel} className={styles.links}>
              {navigation.map((item) => (
                <Link className={styles.link} href={item.href} key={item.href} onClick={close}>
                  {item.label}
                </Link>
              ))}
            </nav>
            <Button className={styles.cta} href={demoCta.href} variant="primary">
              {demoCta.label}
            </Button>
          </div>
        </>
      ) : null}
    </>
  );
}
