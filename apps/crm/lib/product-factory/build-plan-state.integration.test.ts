import { describe, expect, it } from "vitest";
import { Pool } from "pg";
import { BuildPlanStateStore } from "./build-plan-state-store";

describe.skipIf(!process.env.BUILD_PLAN_DATABASE_URL)("BuildPlanStateStore real PostgreSQL", () => {
  it("reserva uma tentativa concorrente e mantém BLOCKED após restart", async () => {
    const url = process.env.BUILD_PLAN_DATABASE_URL;
    if (!url) throw new Error("BUILD_PLAN_DATABASE_URL_required");
    const pool = new Pool({ connectionString: url });
    try {
      await pool.query("truncate public.build_plan_state");
      const a = new BuildPlanStateStore(pool);
      const b = new BuildPlanStateStore(pool);
      const claims = await Promise.all([
        a.recordAttempt("org-wave9", "plan-real", "step-real"),
        b.recordAttempt("org-wave9", "plan-real", "step-real"),
      ]);
      expect(claims.filter(Boolean)).toHaveLength(1);
      expect(claims.filter((claim) => !claim)).toHaveLength(1);
      await a.finish("org-wave9", "plan-real", "step-real", "FAILED");
      const retry = await new BuildPlanStateStore(pool).recordAttempt("org-wave9", "plan-real", "step-real");
      expect(retry?.attempts).toBe(2);
      await a.finish("org-wave9", "plan-real", "step-real", "BLOCKED");
      const restarted = new BuildPlanStateStore(pool);
      expect(await restarted.get("org-wave9", "plan-real", "step-real")).toMatchObject({ status: "BLOCKED", attempts: 2 });
      expect(await restarted.recordAttempt("org-wave9", "plan-real", "step-real")).toBeUndefined();
    } finally {
      await pool.end();
    }
  });
});
