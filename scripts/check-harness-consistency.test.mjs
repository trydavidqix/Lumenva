import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { checkHarnessConsistency } from "./check-harness-consistency.mjs";

const requiredRules = [
  "git-workflow.md",
  "security.md",
  "multi-tenancy.md",
  "api-contract.md",
  "audit-observability.md",
  "lgpd.md",
  "whatsapp-waha.md",
  "data-modeling.md",
  "database-migrations.md",
  "testing-verification.md",
  "documentation.md",
  "graphify.md",
  "skill-routing.md",
];

async function put(root, path, content) {
  const target = join(root, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");
}

async function healthyFixture() {
  const root = await mkdtemp(join(tmpdir(), "harness-check-"));
  await put(
    root,
    ".gitignore",
    ".claude/\n!.claude/\n.claude/*\n!.claude/agents/\n!.claude/commands/\n!.claude/rules/\n!.claude/rules/**\n",
  );
  for (const file of requiredRules) await put(root, `.claude/rules/${file}`, "# rule\n");
  const skill = "# DeskcommCRM\nAuthority: `CLAUDE.md`. Load `.claude/rules/`.\n";
  await put(root, ".claude/skills/DeskcommCRM/SKILL.md", skill);
  await put(root, ".agents/skills/DeskcommCRM/SKILL.md", skill);
  await put(
    root,
    ".claude/homunculus/instincts/inherited/DeskcommCRM-instincts.yaml",
    "source_repo: https://github.com/trydavidqix/CRM\nRead CLAUDE.md\n",
  );
  await put(
    root,
    ".claude/ecc-tools.json",
    JSON.stringify({ repo: "https://github.com/trydavidqix/CRM" }),
  );
  await put(root, ".codex/AGENTS.md", "Authority: ../CLAUDE.md\n");
  await put(
    root,
    "CLAUDE.md",
    requiredRules.map((file) => `.claude/rules/${file}`).join("\n"),
  );
  await put(root, "AGENTS.md", "Read CLAUDE.md and .claude/rules/.\n");
  await put(
    root,
    "docs/harness-doctrine-matrix.md",
    "# matrix\nESTÁVEL\nSNAPSHOT\nDIVERGENTE\n",
  );
  return root;
}

test("accepts a converged harness", async () => {
  const root = await healthyFixture();
  assert.deepEqual(await checkHarnessConsistency(root), []);
});

test("rejects stale generated conventions and commands", async () => {
  const root = await healthyFixture();
  await put(
    root,
    ".agents/skills/DeskcommCRM/SKILL.md",
    "Read CLAUDE.md\nUse **snake_case** for all file names.\nUse **relative imports**.\nCommand: /fix-bug\n",
  );
  const findings = await checkHarnessConsistency(root);
  assert.ok(findings.some((f) => f.code === "stale-file-naming"));
  assert.ok(findings.some((f) => f.code === "stale-import-style"));
  assert.ok(findings.some((f) => f.code === "stale-command"));
});

test("rejects historical repository references in active harness artifacts", async () => {
  const root = await healthyFixture();
  await put(
    root,
    ".claude/ecc-tools.json",
    JSON.stringify({ repo: "https://github.com/melgarafael/DeskcommCRM" }),
  );
  const findings = await checkHarnessConsistency(root);
  assert.ok(findings.some((f) => f.code === "historical-repo-reference"));
});

test("requires every shared rule and a gitignore exception for rules", async () => {
  const root = await healthyFixture();
  await put(
    root,
    ".gitignore",
    ".claude/\n!.claude/\n.claude/*\n!.claude/agents/\n!.claude/commands/\n",
  );
  const findings = await checkHarnessConsistency(root);
  assert.ok(findings.some((f) => f.code === "rules-not-versionable"));
});

test("requires newly preserved LGPD rule", async () => {
  const root = await healthyFixture();
  await rm(join(root, ".claude/rules/lgpd.md"));
  const findings = await checkHarnessConsistency(root);
  assert.ok(findings.some((f) => f.code === "missing-rule" && f.path.endsWith("lgpd.md")));
});

test("rejects an attempt to version local Claude settings", async () => {
  const root = await healthyFixture();
  await put(
    root,
    ".gitignore",
    ".claude/\n!.claude/\n.claude/*\n!.claude/rules/\n!.claude/rules/**\n!.claude/settings.json\n",
  );
  const findings = await checkHarnessConsistency(root);
  assert.ok(findings.some((f) => f.code === "settings-versioned"));
});

test("requires both repo skills to point to CLAUDE.md", async () => {
  const root = await healthyFixture();
  await put(
    root,
    ".agents/skills/DeskcommCRM/SKILL.md",
    "# DeskcommCRM\nNo canonical pointer here.\n",
  );
  const findings = await checkHarnessConsistency(root);
  assert.ok(findings.some((f) => f.code === "missing-doctrine-pointer"));
});

test("requires CLAUDE.md to link every shared rule", async () => {
  const root = await healthyFixture();
  await put(root, "CLAUDE.md", ".claude/rules/security.md\n");
  const findings = await checkHarnessConsistency(root);
  assert.ok(findings.some((f) => f.code === "missing-rule-link"));
});

test("requires AGENTS.md to point to canonical doctrine and shared rules", async () => {
  const root = await healthyFixture();
  await put(root, "AGENTS.md", "# portable contract\n");
  const findings = await checkHarnessConsistency(root);
  assert.ok(findings.some((f) => f.code === "portable-contract-drift"));
});

test("requires doctrine preservation matrix", async () => {
  const root = await healthyFixture();
  await rm(join(root, "docs/harness-doctrine-matrix.md"));
  const findings = await checkHarnessConsistency(root);
  assert.ok(findings.some((f) => f.code === "missing-doctrine-matrix"));
});

test("requires all matrix classifications", async () => {
  const root = await healthyFixture();
  await put(root, "docs/harness-doctrine-matrix.md", "ESTÁVEL\nSNAPSHOT\n");
  const findings = await checkHarnessConsistency(root);
  assert.ok(findings.some((f) => f.code === "incomplete-doctrine-matrix"));
});

test("allows explicit negative references to obsolete commands", async () => {
  const root = await healthyFixture();
  await put(
    root,
    ".agents/skills/DeskcommCRM/SKILL.md",
    "Read CLAUDE.md. Do not invent /fix-bug or /add-module commands.\n",
  );
  const findings = await checkHarnessConsistency(root);
  assert.equal(findings.some((f) => f.code === "stale-command"), false);
});
