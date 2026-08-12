"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { demoCta, navigation, shellContent, solutionsMenu } from "@/content/site";
import { Button } from "@/components/ui/Button";
import styles from "./MobileNavigation.module.css";

export interface MobileNavigationProps {
  readonly className?: string;
}

export function MobileNavigation({
  className,
}: Readonly<MobileNavigationProps>) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSolutionsOpen, setIsSolutionsOpen] = useState(false);
  const dialogId = useId();
  const solutionsPanelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const modalRootRef = useRef<HTMLDivElement>(null);
  const shouldRestoreFocusRef = useRef(false);

  const close = useCallback(() => {
    shouldRestoreFocusRef.current = true;
    setIsOpen(false);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const dialog = dialogRef.current;
    const modalRoot = modalRootRef.current;
    if (!dialog || !modalRoot) return;

    dialog.querySelector<HTMLButtonElement>("button")?.focus();
    const previousOverflow = document.body.style.overflow;
    const outsideRoots = Array.from(document.body.children).filter(
      (element) => element !== modalRoot,
    );
    const previousInert = outsideRoots.map((element) => ({
      element,
      hadInert: element.hasAttribute("inert"),
    }));

    document.body.style.overflow = "hidden";
    outsideRoots.forEach((element) => element.setAttribute("inert", ""));

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"),
      );
      const first = focusable[0];
      const last = focusable.at(-1);

      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      previousInert.forEach(({ element, hadInert }) => {
        if (!hadInert) element.removeAttribute("inert");
      });
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [close, isOpen]);

  useEffect(() => {
    if (isOpen || !shouldRestoreFocusRef.current) return;

    triggerRef.current?.focus();
    shouldRestoreFocusRef.current = false;
  }, [isOpen]);

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
      {isOpen
        ? createPortal(
            <div ref={modalRootRef}>
          <button
            aria-label={shellContent.closeMenuBackdropLabel}
            className={styles.backdrop}
            onClick={close}
            type="button"
          />
          <div
            aria-label={shellContent.mobileNavigationLabel}
            aria-modal="true"
            className={styles.dialog}
            id={dialogId}
            ref={dialogRef}
            role="dialog"
          >
            <div className={styles.dialogHeader}>
              <Button
              className={styles.closeButton}
              onClick={close}
                variant="secondary"
              >
                {shellContent.closeMenuLabel}
              </Button>
            </div>
            <nav aria-label={shellContent.mobileNavigationLabel} className={styles.links}>
              {navigation.map((item) =>
                item.label === "Soluções" ? (
                  <div className={styles.solutionsGroup} key={item.href}>
                    <div className={styles.solutionsRow}>
                      <Link className={styles.link} href={item.href} onClick={close}>
                        {item.label}
                      </Link>
                      <button
                        aria-controls={solutionsPanelId}
                        aria-expanded={isSolutionsOpen}
                        aria-label={
                          isSolutionsOpen ? "Recolher soluções" : "Expandir soluções"
                        }
                        className={styles.solutionsToggle}
                        onClick={() => setIsSolutionsOpen((value) => !value)}
                        type="button"
                      >
                        <span
                          aria-hidden="true"
                          className={styles.solutionsChevron}
                          data-open={isSolutionsOpen}
                        />
                      </button>
                    </div>
                    {isSolutionsOpen ? (
                      <div className={styles.solutionsPanel} id={solutionsPanelId}>
                        {solutionsMenu.map((solution) => (
                          <Link
                            className={styles.solutionLink}
                            href={solution.href}
                            key={solution.href}
                            onClick={close}
                          >
                            {solution.label}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <Link className={styles.link} href={item.href} key={item.href} onClick={close}>
                    {item.label}
                  </Link>
                ),
              )}
            </nav>
            <Button href={demoCta.href} variant="primary">
              {demoCta.label}
            </Button>
          </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
