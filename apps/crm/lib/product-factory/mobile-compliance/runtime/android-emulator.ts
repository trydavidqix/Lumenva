import { createHash } from "node:crypto";
import type { RuntimeReviewAdapter, RuntimeReviewInput } from "../runtime";
import type { RuntimeReviewReport } from "../contracts";
import type { RuntimeExec } from "./ios-simulator";

export interface AndroidEmulatorOptions {
  serial?: string;
  apkPath: string;
  packageName: string;
  launchActivity: string;
  execute: RuntimeExec;
}

function evidence(input: RuntimeReviewInput, step: string): string {
  return `runtime:android:${step}:${createHash("sha256").update(`${input.artifactHash}:${step}`).digest("hex").slice(0, 20)}`;
}

export function createAndroidEmulatorRuntimeAdapter(options: AndroidEmulatorOptions): RuntimeReviewAdapter {
  const adb = (args: string[]) => options.serial ? ["adb", ["-s", options.serial, ...args] as string[]] as const : ["adb", args] as const;
  return {
    async review(input): Promise<RuntimeReviewReport> {
      if (input.platform !== "ANDROID") throw new Error("Android emulator adapter requires ANDROID input");
      const steps: RuntimeReviewReport["steps"] = [];
      const refs: string[] = [];
      const run = async (name: string, args: string[], infrastructure = false) => {
        const [cmd, cmdArgs] = adb(args); const ref = evidence(input, name);
        try { await options.execute(cmd, cmdArgs); refs.push(ref); steps.push({ name, status: "PASS", evidenceRefs: [ref] }); return { ok: true, infrastructure }; }
        catch { steps.push({ name, status: "FAIL", evidenceRefs: [] }); return { ok: false, infrastructure }; }
      };
      const device = await run("device", ["get-state"], true);
      if (!device.ok) return { runtimeReviewId: `runtime-android:${input.artifactHash}`, platform: "ANDROID", status: "INFRA_FAILURE", evidenceRefs: refs, steps, createdAt: new Date().toISOString() };
      const install = await run("install", ["install", "-r", options.apkPath], true);
      if (!install.ok) return { runtimeReviewId: `runtime-android:${input.artifactHash}`, platform: "ANDROID", status: "INFRA_FAILURE", evidenceRefs: refs, steps, createdAt: new Date().toISOString() };
      const launch = await run("launch", ["shell", "am", "start", "-n", `${options.packageName}/${options.launchActivity}`]);
      return { runtimeReviewId: `runtime-android:${input.artifactHash}`, platform: "ANDROID", status: launch.ok ? "PASS" : "FAIL", evidenceRefs: refs, steps, createdAt: new Date().toISOString() };
    },
  };
}
