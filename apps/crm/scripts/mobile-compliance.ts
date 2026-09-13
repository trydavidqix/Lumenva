import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";

import {
  runMobileComplianceAudit,
  type MobilePlatform,
  type MobileProjectSnapshot,
  type StoreMetadataSnapshot,
} from "../lib/product-factory/mobile-compliance";
import { createCommandRuntimeAdapter } from "../lib/product-factory/mobile-compliance/runtime/command-adapter";

const ALLOWED_EXTENSIONS = new Set([
  ".json", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".swift", ".m", ".mm",
  ".plist", ".xcprivacy", ".xml", ".gradle", ".kts", ".properties", ".yaml", ".yml",
  ".dart", ".toml", ".md",
]);
const ALLOWED_BASENAMES = new Set(["Podfile", "pubspec.yaml", "package.json", "settings.gradle", "build.gradle"]);
const SKIP_DIRS = new Set([".git", "node_modules", ".next", "dist", "build", "coverage", ".turbo"]);

function extname(path: string): string {
  const last = path.lastIndexOf(".");
  return last >= 0 ? path.slice(last) : "";
}

function collectProjectFiles(root: string): Record<string, string> {
  const files: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (SKIP_DIRS.has(name)) continue;
      const absolute = resolve(dir, name);
      const info = statSync(absolute);
      if (info.isDirectory()) { walk(absolute); continue; }
      if (!info.isFile() || info.size > 1_000_000) continue;
      const rel = relative(root, absolute).replaceAll("\\", "/");
      if (!ALLOWED_BASENAMES.has(name) && !ALLOWED_EXTENSIONS.has(extname(name))) continue;
      try { files[rel] = readFileSync(absolute, "utf8"); } catch { /* binary or unreadable: omit */ }
    }
  };
  walk(root);
  return files;
}

function argValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function hasFlag(args: string[], name: string): boolean { return args.includes(name); }
function required(value: string | undefined, message: string): string { if (!value) throw new Error(message); return value; }

function parsePlatform(raw: string | undefined): MobilePlatform {
  const normalized = required(raw, "--platform ios|android is required").toLowerCase();
  if (normalized === "ios") return "IOS";
  if (normalized === "android") return "ANDROID";
  throw new Error("--platform must be ios or android");
}

function metadataFromFile(path?: string): StoreMetadataSnapshot | undefined {
  if (!path) return undefined;
  const parsed = JSON.parse(readFileSync(resolve(path), "utf8")) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("metadata file must contain a JSON object");
  return parsed as StoreMetadataSnapshot;
}

function gitBuildRef(root: string): string {
  try { return execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(); }
  catch { return "local-uncommitted"; }
}

function artifactHash(files: Record<string, string>): string {
  const hash = createHash("sha256");
  for (const [path, content] of Object.entries(files).sort(([a], [b]) => a.localeCompare(b))) hash.update(path).update("\0").update(content).update("\0");
  return hash.digest("hex");
}

function usage(): never {
  console.error("Usage: lumenva mobile audit|release-check --platform ios|android [--root PATH] [--metadata FILE] [--runtime-required] [--runtime-command BIN] [--json]");
  process.exit(2);
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] !== "mobile" || (args[1] !== "audit" && args[1] !== "release-check")) usage();
  const mode = args[1];
  const root = resolve(argValue(args, "--root") ?? process.cwd());
  if (!existsSync(root) || !statSync(root).isDirectory()) throw new Error(`project root does not exist: ${root}`);
  const platform = parsePlatform(argValue(args, "--platform"));
  const files = collectProjectFiles(root);
  if (Object.keys(files).length === 0) throw new Error("no supported project files were found");
  const hash = artifactHash(files);
  const buildRef = argValue(args, "--build-ref") ?? gitBuildRef(root);
  const projectId = argValue(args, "--project-id") ?? root.split(/[\\/]/).filter(Boolean).at(-1) ?? "local-project";
  const organizationId = argValue(args, "--organization-id") ?? "local-audit";
  const snapshot: MobileProjectSnapshot = { files, storeMetadata: metadataFromFile(argValue(args, "--metadata")) };
  const runtimeCommand = argValue(args, "--runtime-command");
  const runtimeAdapter = runtimeCommand ? createCommandRuntimeAdapter(runtimeCommand) : undefined;
  const result = await runMobileComplianceAudit({
    organizationId,
    projectId,
    buildRef,
    artifactRef: `local://${projectId}/${hash.slice(0, 16)}`,
    artifactHash: hash,
    platform,
    snapshot,
    runtimeRequired: hasFlag(args, "--runtime-required") || mode === "release-check",
    runtimeAdapter,
  });

  if (hasFlag(args, "--json")) console.log(JSON.stringify(result.report, null, 2));
  else {
    console.log(`${result.report.store} ${result.report.platform} — ${result.report.verdict}`);
    console.log(`policy=${result.report.policyVersion} artifact=${result.report.artifactHash.slice(0, 16)}`);
    console.log(`critical=${result.report.criticalCount} high=${result.report.highCount} medium=${result.report.mediumCount} low=${result.report.lowCount}`);
    for (const finding of result.report.findings) console.log(`- [${finding.severity}] ${finding.ruleId}: ${finding.title}`);
  }
  if (mode === "release-check" && result.report.verdict !== "PASS" && result.report.verdict !== "PASS_WITH_WARNINGS") process.exitCode = 1;
}

main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
