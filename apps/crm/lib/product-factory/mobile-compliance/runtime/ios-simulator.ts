import { createHash } from "node:crypto";
import type { RuntimeReviewAdapter, RuntimeReviewInput } from "../runtime";
import type { RuntimeReviewReport } from "../contracts";

export type RuntimeExec = (command: string, args: string[]) => Promise<void>;

export interface IosSimulatorOptions {
  simulatorUdid: string;
  appPath: string;
  bundleId: string;
  execute: RuntimeExec;
}

function evidence(input: RuntimeReviewInput, step: string): string {
  return `runtime:ios:${step}:${createHash("sha256").update(`${input.artifactHash}:${step}`).digest("hex").slice(0, 20)}`;
}

export function createIosSimulatorRuntimeAdapter(options: IosSimulatorOptions): RuntimeReviewAdapter {
  return {
    async review(input): Promise<RuntimeReviewReport> {
      if (input.platform !== "IOS") throw new Error("iOS simulator adapter requires IOS input");
      const steps: Array<RuntimeReviewReport["steps"][number]> = [];
      const refs: string[] = [];
      const run = async (name: string, command: string, args: string[]) => {
        const ref = evidence(input, name);
        try { await options.execute(command, args); refs.push(ref); steps.push({ name, status: "PASS", evidenceRefs: [ref] }); return true; }
        catch { steps.push({ name, status: "FAIL", evidenceRefs: [] }); return false; }
      };
      if (!await run("bootstatus", "xcrun", ["simctl", "bootstatus", options.simulatorUdid, "-b"])) return { runtimeReviewId: `runtime-ios:${input.artifactHash}`, platform: "IOS", status: "INFRA_FAILURE", evidenceRefs: refs, steps, createdAt: new Date().toISOString() };
      if (!await run("install", "xcrun", ["simctl", "install", options.simulatorUdid, options.appPath])) return { runtimeReviewId: `runtime-ios:${input.artifactHash}`, platform: "IOS", status: "INFRA_FAILURE", evidenceRefs: refs, steps, createdAt: new Date().toISOString() };
      const launched = await run("launch", "xcrun", ["simctl", "launch", options.simulatorUdid, options.bundleId]);
      return { runtimeReviewId: `runtime-ios:${input.artifactHash}`, platform: "IOS", status: launched ? "PASS" : "FAIL", evidenceRefs: refs, steps, createdAt: new Date().toISOString() };
    },
  };
}
