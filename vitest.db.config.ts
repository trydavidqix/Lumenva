import { defineConfig } from "vitest/config";
import path from "node:path";

// Config dedicada da suíte de invariantes de banco (tests/invariants/**).
// Roda SÓ via `pnpm test:db` (scripts/test-db.sh), que sobe o Postgres efêmero
// e exporta TEST_DB_CONTAINER. Não faz parte do `pnpm test:unit`.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/invariants/**/*.test.ts"],
    globals: false,
    // Seed + queries via docker exec são lentos o suficiente pro default de 5s.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // webhooks-trigger-events.test.ts chama os handlers REST diretamente (não
    // só SQL cru), e eles importam lib/env transitivamente (via lib/audit) —
    // sem isso o import falha (env obrigatória ausente) e derruba a suíte
    // inteira. audit()/emit_event reais nunca são alcançados (fetch falha
    // rápido contra porta fechada, engolido pelo try/catch de audit()).
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:1",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
      SUPABASE_SERVICE_ROLE_KEY:
        "test-service-role-key-not-a-placeholder-1234567890-1234567890",
    },
  },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
