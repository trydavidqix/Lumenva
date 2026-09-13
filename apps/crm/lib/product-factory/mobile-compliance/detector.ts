import { createHash } from "node:crypto";
import type { FrameworkDetection, MobileProjectSnapshot } from "./contracts";

function hasPath(files: readonly string[], predicate: (path: string) => boolean): boolean {
  return files.some(predicate);
}

function packageJson(snapshot: MobileProjectSnapshot): Record<string, unknown> | undefined {
  const raw = snapshot.files["package.json"];
  if (!raw) return undefined;
  try { return JSON.parse(raw) as Record<string, unknown>; } catch { return undefined; }
}

function packageNames(pkg: Record<string, unknown> | undefined): Set<string> {
  if (!pkg) return new Set();
  const deps = { ...(typeof pkg.dependencies === "object" && pkg.dependencies ? pkg.dependencies as Record<string, unknown> : {}), ...(typeof pkg.devDependencies === "object" && pkg.devDependencies ? pkg.devDependencies as Record<string, unknown> : {}) };
  return new Set(Object.keys(deps));
}

function evidence(path: string): string {
  return `detect:${createHash("sha256").update(path).digest("hex").slice(0, 16)}`;
}

export function detectMobileFramework(snapshot: MobileProjectSnapshot): FrameworkDetection {
  const files = Object.keys(snapshot.files);
  const lower = files.map((path) => path.toLowerCase());
  const pkgNames = packageNames(packageJson(snapshot));
  const hasIos = hasPath(lower, (path) => path.startsWith("ios/") || path.endsWith(".xcodeproj/project.pbxproj") || path.endsWith(".xcworkspace/contents.xcworkspacedata") || path === "podfile");
  const hasAndroid = hasPath(lower, (path) => path.startsWith("android/") || path.endsWith("androidmanifest.xml") || path.endsWith("build.gradle") || path.endsWith("build.gradle.kts"));
  const hasFlutter = lower.includes("pubspec.yaml");
  const hasExpo = pkgNames.has("expo") || files.some((path) => /^app\.(json|config\.(js|ts|mjs|cjs))$/i.test(path));
  const hasReactNative = pkgNames.has("react-native");

  let framework: FrameworkDetection["framework"] = "UNKNOWN";
  if (hasFlutter) framework = "FLUTTER";
  else if (hasExpo) framework = "EXPO";
  else if (hasReactNative) framework = "REACT_NATIVE";
  else if (hasIos && !hasAndroid) framework = "NATIVE_IOS";
  else if (hasAndroid && !hasIos) framework = "NATIVE_ANDROID";
  else if (hasIos || hasAndroid) framework = hasIos ? "NATIVE_IOS" : "NATIVE_ANDROID";

  const refs = files.filter((path) => /package\.json|pubspec\.yaml|androidmanifest\.xml|\.xcodeproj|app\.(json|config)/i.test(path)).map(evidence);
  return { framework, hasIos: hasIos || hasFlutter || hasExpo || hasReactNative, hasAndroid: hasAndroid || hasFlutter || hasExpo || hasReactNative, evidenceRefs: refs };
}
