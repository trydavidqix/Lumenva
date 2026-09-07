"use client";

import { useMemo, useState } from "react";
import styles from "./blog.module.css";

export function BlogShare({ title, url }: Readonly<{ title: string; url?: string }>) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");
  const shareUrl = useMemo(() => {
    if (url) return new URL(url, typeof window === "undefined" ? "https://lumenva.pt" : window.location.origin).toString();
    return typeof window === "undefined" ? "" : window.location.href;
  }, [url]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setStatus("copied");
      window.setTimeout(() => setStatus("idle"), 2500);
    } catch {
      setStatus("error");
    }
  }

  return (
    <section className={styles.share} aria-labelledby="blog-share-title">
      <h2 className={styles.shareLabel} id="blog-share-title">Partilhar artigo</h2>
      <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer" aria-label="Partilhar no LinkedIn (abre numa nova janela)">
        LinkedIn <span className="visually-hidden">(abre numa nova janela)</span>
      </a>
      <a href={`https://wa.me/?text=${encodeURIComponent(`${title} ${shareUrl}`)}`} target="_blank" rel="noopener noreferrer" aria-label="Partilhar no WhatsApp (abre numa nova janela)">
        WhatsApp <span className="visually-hidden">(abre numa nova janela)</span>
      </a>
      <button type="button" onClick={copy} aria-describedby="blog-share-status">Copiar link</button>
      <p className="visually-hidden" id="blog-share-status" role="status" aria-live="polite">
        {status === "copied" ? "Link copiado para a área de transferência." : null}
        {status === "error" ? "Não foi possível copiar o link. Copie o endereço da página manualmente." : null}
      </p>
    </section>
  );
}
