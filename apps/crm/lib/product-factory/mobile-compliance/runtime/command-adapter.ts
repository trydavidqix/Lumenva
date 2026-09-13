import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { RuntimeReviewAdapter, RuntimeReviewInput } from "../runtime";
import type { RuntimeReviewReport } from "../contracts";

const execFileAsync = promisify(execFile);

export type RuntimeCommandExecutor = (command: string, args: string[], input: RuntimeReviewInput) => Promise<{ stdout: string; stderr: string }>;

const defaultExecutor: RuntimeCommandExecutor = async (command, args) => {
  const result = await execFileAsync(command, args, { encoding: "utf8", timeout: 5 * 60_000, maxBuffer: 2 * 1024 * 1024 });
  return { stdout: result.stdout, stderr: result.stderr };
};

export function createCommandRuntimeAdapter(command: string, fixedArgs: string[] = [], execute: RuntimeCommandExecutor = defaultExecutor): RuntimeReviewAdapter {
  if (!command.trim()) throw new Error("runtime review command is required");
  return {
    async review(input): Promise<RuntimeReviewReport> {
      const payload = Buffer.from(JSON.stringify(input), "utf8").toString("base64url");
      try {
        const { stdout } = await execute(command, [...fixedArgs, "--lumenva-runtime-input", payload], input);
        const parsed = JSON.parse(stdout) as RuntimeReviewReport;
        if (!parsed || parsed.platform !== input.platform || !parsed.runtimeReviewId || !Array.isArray(parsed.evidenceRefs) || !Array.isArray(parsed.steps)) throw new Error("runtime command returned an invalid report");
        return parsed;
      } catch {
        return {
          runtimeReviewId: `runtime-infra-failure:${input.artifactHash}`,
          platform: input.platform,
          status: "INFRA_FAILURE",
          evidenceRefs: [],
          steps: [{ name: "runtime-command", status: "FAIL", evidenceRefs: [] }],
          createdAt: new Date().toISOString(),
        };
      }
    },
  };
}
