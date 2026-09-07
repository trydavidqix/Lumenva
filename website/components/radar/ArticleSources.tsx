"use client";
import type { RadarSource } from "@/lib/radar/types";
import { trackRadarEvent } from "@/lib/radar/telemetry";
import styles from "./radar.module.css";

export function ArticleSources({ sources, slug }: { sources: RadarSource[]; slug?: string }) {
  if (!sources.length) return null;
  return <section className={styles.sources} aria-labelledby="article-sources-title"><h2 id="article-sources-title">Fontes</h2><ul>{sources.map((source) => <li key={source.url}><a onClick={() => slug && trackRadarEvent("radar_source_click", { slug, source: source.label })} href={source.url} target="_blank" rel="noopener noreferrer">{source.label}<span aria-hidden="true"> ↗</span></a></li>)}</ul></section>;
}
