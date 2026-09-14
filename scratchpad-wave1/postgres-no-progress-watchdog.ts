import type { Queryable } from "../agent-engine/queue/queue";
import type { WatchdogSignal, WatchdogObservation } from "./no-progress-watchdog";

type Row = { cycle: number; progressed: boolean; no_progress_cycles: number; status: "ON_TRACK" | "AT_RISK" };

export class PostgresNoProgressWatchdog {
  constructor(private readonly db: Queryable, private readonly organizationId: string, private readonly table = "psyche_watchdog_observations") {
    if (!organizationId.trim()) throw new Error("watchdog_tenant_invalid");
    if (!/^\w+$/.test(table)) throw new Error("watchdog_table_invalid");
  }

  async observe(observation: WatchdogObservation): Promise<WatchdogSignal> {
    if (!observation.jobId) throw new TypeError("jobId is required");
    if (!Number.isInteger(observation.cycle) || observation.cycle < 1) throw new RangeError("cycle must be an integer >= 1");
    await this.db.query("BEGIN");
    try {
      const replay = await this.db.query<Row>(
        `SELECT cycle, progressed, no_progress_cycles, status FROM ${this.table} WHERE organization_id=$1 AND job_id=$2 AND cycle=$3`,
        [this.organizationId, observation.jobId, observation.cycle],
      );
      if (replay.rows[0]) {
        await this.db.query("COMMIT");
        return this.signal(observation.jobId, replay.rows[0]);
      }
      const latest = await this.db.query<{ cycle: number; no_progress_cycles: number }>(
        `SELECT cycle, no_progress_cycles FROM ${this.table} WHERE organization_id=$1 AND job_id=$2 ORDER BY cycle DESC LIMIT 1 FOR UPDATE`,
        [this.organizationId, observation.jobId],
      );
      if (latest.rows[0] && observation.cycle <= latest.rows[0].cycle) throw new RangeError("cycle must increase monotonically");
      const noProgressCycles = observation.progressed ? 0 : (latest.rows[0]?.no_progress_cycles ?? 0) + 1;
      const status = noProgressCycles >= 3 ? "AT_RISK" : "ON_TRACK";
      try {
        await this.db.query(
          `INSERT INTO ${this.table} (organization_id, job_id, cycle, progressed, no_progress_cycles, status) VALUES ($1,$2,$3,$4,$5,$6)`,
          [this.organizationId, observation.jobId, observation.cycle, observation.progressed, noProgressCycles, status],
        );
      } catch (error) {
        if ((error as { code?: string }).code !== "23505") throw error;
        await this.db.query("ROLLBACK");
        const concurrent = await this.db.query<Row>(
          `SELECT cycle, progressed, no_progress_cycles, status FROM ${this.table} WHERE organization_id=$1 AND job_id=$2 AND cycle=$3`,
          [this.organizationId, observation.jobId, observation.cycle],
        );
        if (!concurrent.rows[0]) throw new Error("watchdog_observation_missing_after_conflict");
        return this.signal(observation.jobId, concurrent.rows[0]);
      }
      await this.db.query("COMMIT");
      return this.signal(observation.jobId, { cycle: observation.cycle, progressed: observation.progressed, no_progress_cycles: noProgressCycles, status });
    } catch (error) {
      await this.db.query("ROLLBACK").catch(() => undefined);
      throw error;
    }
  }

  private signal(jobId: string, row: Row): WatchdogSignal {
    return Object.freeze({ jobId, cycle: row.cycle, status: row.status, noProgressCycles: row.no_progress_cycles, action: "SIGNAL_ONLY", processAction: "CONTINUE" });
  }
}
