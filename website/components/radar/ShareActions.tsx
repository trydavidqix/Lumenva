"use client";

import { useEffect, useState } from "react";
import styles from "./radar.module.css";
import { trackRadarEvent } from "@/lib/radar/telemetry";

export function ShareActions({ title, url }: { title: string; url?: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (url) trackRadarEvent("radar_article_view", { slug: url.split("/").pop() ?? url }); }, [url]);
  async function copyLink() {
    try { await navigator.clipboard.writeText(url ?? window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard unavailable */ }
  }
  return <div className={styles.share} aria-label="Partilhar artigo">
    <span className={styles.shareLabel}>Partilhar</span>
    <a onClick={() => trackRadarEvent("radar_share_click", { slug: url ?? "", channel: "linkedin" })} href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url ?? "")}`} target="_blank" rel="noopener noreferrer">LinkedIn</a>
    <a onClick={() => trackRadarEvent("radar_share_click", { slug: url ?? "", channel: "whatsapp" })} href={`https://wa.me/?text=${encodeURIComponent(`${title} ${url ?? ""}`)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
    <button type="button" onClick={copyLink}>{copied ? "Link copiado" : "Copiar link"}</button>
  </div>;
}
