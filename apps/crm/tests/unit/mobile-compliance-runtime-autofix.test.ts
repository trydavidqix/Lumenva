import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { applySafeAutofixes, createAndroidEmulatorRuntimeAdapter, createCommandRuntimeAdapter, createFinding, createIosSimulatorRuntimeAdapter } from "@/lib/product-factory/mobile-compliance";

const input = { organizationId: "o", projectId: "p", buildRef: "b", artifactRef: "a", artifactHash: "f".repeat(64), platform: "IOS" as const, snapshot: { files: { "package.json": "{}" } } };

describe("mobile compliance runtime adapters and autofix", () => {
  it("turns command execution errors into INFRA_FAILURE instead of a policy violation", async () => {
    const adapter = createCommandRuntimeAdapter("runtime-review", [], async () => { throw new Error("missing tool"); });
    await expect(adapter.review(input)).resolves.toMatchObject({ status: "INFRA_FAILURE", platform: "IOS" });
  });

  it("runs the iOS simulator install/launch sequence through an injected executor", async () => {
    const execute = vi.fn(async () => undefined);
    const adapter = createIosSimulatorRuntimeAdapter({ simulatorUdid: "booted", appPath: "/tmp/App.app", bundleId: "pt.lumenva.app", execute });
    const report = await adapter.review(input);
    expect(report.status).toBe("PASS");
    expect(execute).toHaveBeenCalledWith("xcrun", ["simctl", "install", "booted", "/tmp/App.app"]);
    expect(execute).toHaveBeenCalledWith("xcrun", ["simctl", "launch", "booted", "pt.lumenva.app"]);
  });

  it("runs Android device/install/launch through adb", async () => {
    const execute = vi.fn(async () => undefined);
    const adapter = createAndroidEmulatorRuntimeAdapter({ apkPath: "/tmp/app.apk", packageName: "pt.lumenva.app", launchActivity: ".MainActivity", execute });
    const report = await adapter.review({ ...input, platform: "ANDROID" });
    expect(report.status).toBe("PASS");
    expect(execute).toHaveBeenCalledWith("adb", ["install", "-r", "/tmp/app.apk"]);
  });

  it("applies only explicitly autofixable patches against the audited file hash", () => {
    const content = "before";
    const finding = createFinding({ ruleId: "SAFE", platform: "IOS", store: "APP_STORE", severity: "LOW", source: "STATIC", title: "safe", description: "safe", resource: "app.json", evidenceRefs: ["e"], autofixable: true });
    const patch = { resource: "app.json", expectedOriginalHash: createHash("sha256").update(content).digest("hex"), replacement: "after", findingFingerprint: finding.fingerprint };
    const result = applySafeAutofixes({ files: { "app.json": content } }, [finding], [patch]);
    expect(result.snapshot.files["app.json"]).toBe("after");
    expect(result.applied).toHaveLength(1);
  });

  it("rejects stale patches", () => {
    const finding = createFinding({ ruleId: "SAFE", platform: "IOS", store: "APP_STORE", severity: "LOW", source: "STATIC", title: "safe", description: "safe", resource: "app.json", evidenceRefs: ["e"], autofixable: true });
    const patch = { resource: "app.json", expectedOriginalHash: "0".repeat(64), replacement: "after", findingFingerprint: finding.fingerprint };
    expect(applySafeAutofixes({ files: { "app.json": "changed" } }, [finding], [patch]).rejected[0]?.reason).toBe("resource_changed_since_audit");
  });
});
