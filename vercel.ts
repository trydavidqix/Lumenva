/**
 * Vercel project config (canonical TS form).
 */
import type { VercelConfig } from "@vercel/config/v1";

const config: VercelConfig = {
  crons: [{ path: "/api/v1/cron/lgpd-sla-watcher", schedule: "0 12 * * *" }],
  functions: {
    "app/api/internal/agents/run/route.ts": { maxDuration: 300 },
  },
};

export default config;
