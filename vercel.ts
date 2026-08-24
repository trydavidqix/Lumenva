/**
 * Vercel project config (canonical TS form).
 */
import type { VercelConfig } from "@vercel/config/v1";

const config: VercelConfig = {
  // Temporário na branch implementacao-tokens: usa Preview apenas como runner
  // dos gates da fase atual. Remover antes de qualquer integração com main.
  buildCommand: "bash scripts/verify-implementacao-tokens-phase-02.sh",
  crons: [{ path: "/api/v1/cron/lgpd-sla-watcher", schedule: "0 12 * * *" }],
  functions: {
    "app/api/internal/agents/run/route.ts": { maxDuration: 300 },
  },
};

export default config;
