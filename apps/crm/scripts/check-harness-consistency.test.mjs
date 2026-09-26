import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import {
  checkHarnessConsistency,
  REQUIRED_ON_DEMAND_SKILLS,
  REQUIRED_ASK_RULES,
  REQUIRED_DENY_RULES,
  REQUIRED_RULES,
  SCOPED_RULES,
} from "./check-harness-consistency.mjs";

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
    ".claude/\n!.claude/\n.claude/*\n!.claude/agents/\n!.claude/commands/\n!.claude/skills/\n!.claude/skills/**\n!.claude/rules/\n!.claude/rules/**\n!.claude/settings.json\n.claude/settings.local.json\n",
  );
  for (const file of REQUIRED_RULES) {
    const paths = SCOPED_RULES[file];
    for (const pattern of paths ?? []) {
      const target = pattern.split("*")[0].replace(/\/$/, "");
      if (target && !target.includes(".")) await mkdir(join(root, target), { recursive: true });
      else if (target) await put(root, target, "fixture\n");
    }
    const frontmatter = paths ? `---\npaths:\n${paths.map((path) => `  - "${path}"`).join("\n")}\n---\n` : "";
    await put(root, `.claude/rules/${file}`, `${frontmatter}# rule\n`);
  }
  for (const skill of REQUIRED_ON_DEMAND_SKILLS) {
    await put(
      root,
      `.claude/skills/${skill}/SKILL.md`,
      `---\nname: ${skill}\ndescription: Use when the task requires ${skill}.\n---\n\nRead CLAUDE.md and the applicable rule.\n`,
    );
  }
  await put(
    root,
    ".claude/settings.json",
    JSON.stringify({
      permissions: {
        defaultMode: "default",
        disableBypassPermissionsMode: "disable",
        disableAutoMode: "disable",
        deny: REQUIRED_DENY_RULES,
        ask: REQUIRED_ASK_RULES,
      },
    }),
  );
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
    "tooling/agent-loop/setup-claude-guard.mjs",
    'join(repoRoot, ".claude", "settings.local.json");\n',
  );
  await put(root, "CLAUDE.md", "Read `.claude/rules/` as the policy index.\n");
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
    ".claude/\n!.claude/\n.claude/*\n!.claude/agents/\n!.claude/commands/\n!.claude/settings.json\n.claude/settings.local.json\n",
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
    ".claude/\n!.claude/\n.claude/*\n!.claude/rules/\n!.claude/rules/**\n!.claude/settings.json\n!.claude/settings.local.json\n",
  );
  const findings = await checkHarnessConsistency(root);
  assert.ok(findings.some((f) => f.code === "local-settings-versioned"));
});

test("rejects obsolete monorepo paths in active harness artifacts", async () => {
  const root = await healthyFixture();
  await put(
    root,
    ".claude/skills/DeskcommCRM/SKILL.md",
    "Read CLAUDE.md and use infra/infra/supabase/baseline.sql.\n",
  );
  const findings = await checkHarnessConsistency(root);
  assert.ok(findings.some((f) => f.code === "obsolete-monorepo-path"));
});

test("keeps the gov-loop Claude guard in ignored local settings", async () => {
  const root = await healthyFixture();
  await put(
    root,
    "tooling/agent-loop/setup-claude-guard.mjs",
    'join(repoRoot, ".claude", "settings.json");\n',
  );
  const findings = await checkHarnessConsistency(root);
  assert.ok(findings.some((f) => f.code === "guard-settings-not-local"));
});

test("requires shared settings to disable bypass mode and protect destructive commands", async () => {
  const root = await healthyFixture();
  await put(
    root,
    ".claude/settings.json",
    JSON.stringify({ permissions: { defaultMode: "bypassPermissions" } }),
  );
  const findings = await checkHarnessConsistency(root);
  assert.ok(findings.some((f) => f.code === "unsafe-project-permissions"));
});

test("requires scoped rules and on-demand workflow skills", async () => {
  const root = await healthyFixture();
  await put(root, ".claude/rules/multi-tenancy.md", "# multi-tenancy\nNo paths.\n");
  await rm(join(root, ".claude/skills/verify-change/SKILL.md"));
  const findings = await checkHarnessConsistency(root);
  assert.ok(findings.some((f) => f.code === "unscoped-domain-rule"));
  assert.ok(findings.some((f) => f.code === "missing-on-demand-skill"));
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

test("requires CLAUDE.md to point to the modular rules directory", async () => {
  const root = await healthyFixture();
  await put(root, "CLAUDE.md", "No policy index here.\n");
  const findings = await checkHarnessConsistency(root);
  assert.ok(findings.some((f) => f.code === "missing-rule-index"));
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
