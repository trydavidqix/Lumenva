import { describe, expect, it } from "vitest";

import { NoProgressWatchdog } from "./no-progress-watchdog";

describe("No-progress Watchdog — Wave 14", () => {
  it("marca AT_RISK exatamente após 3 ciclos sem progresso", () => {
    const watchdog = new NoProgressWatchdog();
    expect(watchdog.observe({ jobId: "job-1", cycle: 1, progressed: false }).status).toBe("ON_TRACK");
    expect(watchdog.observe({ jobId: "job-1", cycle: 2, progressed: false }).status).toBe("ON_TRACK");
    const signal = watchdog.observe({ jobId: "job-1", cycle: 3, progressed: false });

    expect(signal.status).toBe("AT_RISK");
    expect(signal.noProgressCycles).toBe(3);
    expect(signal.action).toBe("SIGNAL_ONLY");
    expect(signal.processAction).toBe("CONTINUE");
  });

  it("progresso reinicia a contagem e não mata o processo", () => {
    const watchdog = new NoProgressWatchdog();
    watchdog.observe({ jobId: "job-1", cycle: 1, progressed: false });
    watchdog.observe({ jobId: "job-1", cycle: 2, progressed: false });
    expect(watchdog.observe({ jobId: "job-1", cycle: 3, progressed: false }).status).toBe("AT_RISK");

    const recovered = watchdog.observe({ jobId: "job-1", cycle: 4, progressed: true });
    expect(recovered.status).toBe("ON_TRACK");
    expect(recovered.noProgressCycles).toBe(0);
    expect(recovered.processAction).toBe("CONTINUE");
  });

  it("mantém jobs isolados e replay de ciclo idempotente", () => {
    const watchdog = new NoProgressWatchdog();
    watchdog.observe({ jobId: "job-a", cycle: 1, progressed: false });
    watchdog.observe({ jobId: "job-a", cycle: 2, progressed: false });
    const replay = watchdog.observe({ jobId: "job-a", cycle: 2, progressed: false });
    expect(replay.noProgressCycles).toBe(2);
    expect(watchdog.observe({ jobId: "job-b", cycle: 1, progressed: false }).noProgressCycles).toBe(1);
  });
});
