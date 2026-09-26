import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const REQUIRED_RULES = [
  "git-workflow.md",
  "security.md",
  "crm-security.md",
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

export const SCOPED_RULES = {
  "crm-security.md": ["apps/crm/**", "infra/supabase/**"],
  "multi-tenancy.md": ["apps/crm/**", "infra/supabase/**"],
  "api-contract.md": ["apps/crm/app/api/**", "apps/crm/lib/api/**"],
  "audit-observability.md": ["apps/crm/**", "infra/supabase/**"],
  "lgpd.md": ["apps/crm/**", "infra/supabase/**", "knowledge/00-Canon/PRIVACY.md"],
  "whatsapp-waha.md": ["apps/crm/lib/waha/**", "apps/crm/app/api/**", "infra/supabase/**"],
  "data-modeling.md": ["apps/crm/lib/database.types.ts", "infra/supabase/**"],
  "database-migrations.md": ["infra/supabase/**", "apps/crm/lib/database.types.ts"],
  "documentation.md": ["**/*.md"],
};

export const REQUIRED_ON_DEMAND_SKILLS = ["verify-change", "db-migration", "graphify"];

export const REQUIRED_DENY_RULES = [
  "Read(./.env)",
  "Read(./.env.local)",
  "Read(./**/.env)",
  "Read(./**/.env.local)",
  "Read(./**/.env.*.local)",
  "Read(./.env.production)",
  "Read(./.env.staging)",
  "Edit(./.env)",
  "Edit(./.env.local)",
  "Edit(./**/.env)",
  "Edit(./**/.env.local)",
  "Edit(./**/.env.*.local)",
  "Edit(./.env.production)",
  "Edit(./.env.staging)",
  "Write(./.env)",
  "Write(./.env.local)",
  "Write(./**/.env)",
  "Write(./**/.env.local)",
  "Write(./**/.env.*.local)",
  "Write(./.env.production)",
  "Write(./.env.staging)",
  "Bash(git reset --hard*)",
  "PowerShell(git reset --hard*)",
  "Bash(git * reset --hard*)",
  "PowerShell(git * reset --hard*)",
  "Bash(git push --force*)",
  "Bash(git push -f*)",
  "PowerShell(git push --force*)",
  "PowerShell(git push -f*)",
];

export const REQUIRED_ASK_RULES = [
  "Bash(git clean *)",
  "PowerShell(git clean *)",
  "Bash(git rebase *)",
  "PowerShell(git rebase *)",
  "Bash(git merge *)",
  "PowerShell(git merge *)",
  "Bash(git push *)",
  "PowerShell(git push *)",
  "Bash(git commit *)",
  "PowerShell(git commit *)",
  "Bash(git checkout *)",
  "PowerShell(git checkout *)",
  "Bash(git switch *)",
  "PowerShell(git switch *)",
];

const ACTIVE_HARNESS_FILES = [
  ".claude/skills/DeskcommCRM/SKILL.md",
  ".agents/skills/DeskcommCRM/SKILL.md",
  ".claude/homunculus/instincts/inherited/DeskcommCRM-instincts.yaml",
  ".claude/ecc-tools.json",
  ".codex/AGENTS.md",
  "tooling/agent-loop/setup-claude-guard.mjs",
];

const SKILL_FILES = [
  ".claude/skills/DeskcommCRM/SKILL.md",
  ".agents/skills/DeskcommCRM/SKILL.md",
];

const DOCTRINE_MATRIX = "docs/harness-doctrine-matrix.md";
const REQUIRED_MATRIX_CLASSIFICATIONS = ["ESTÁVEL", "SNAPSHOT", "DIVERGENTE"];

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function read(rootDir, relativePath) {
  const absolutePath = join(rootDir, relativePath);
  if (!(await exists(absolutePath))) return null;
  return readFile(absolutePath, "utf8");
}

function finding(code, path, message) {
  return { code, path, message };
}

function advertisesStaleCommand(content) {
  return content.split(/\r?\n/).some((line) => {
    if (!/\/(?:fix-bug|add-module)\b/.test(line)) return false;
    if (/\b(?:do not|don't|never|not|não|nao|nunca|sem)\b/i.test(line)) return false;
    return /(?:\bcommand\b|\bcomando\b|\buse\b|\brun\b|\bexecute\b|\bworkflow\b|\bstart\b|^\s*\|?\s*\/(?:fix-bug|add-module)\b)/i.test(
      line,
    );
  });
}

export async function checkHarnessConsistency(rootDir) {
  const findings = [];

  for (const rule of REQUIRED_RULES) {
    const relativePath = `.claude/rules/${rule}`;
    if (!(await exists(join(rootDir, relativePath)))) {
      findings.push(
        finding("missing-rule", relativePath, `Shared rule is missing: ${relativePath}`),
      );
    }
  }

  const gitignore = (await read(rootDir, ".gitignore")) ?? "";
  const rulesDirAllowed = /^!\.claude\/rules\/$/m.test(gitignore);
  const rulesChildrenAllowed = /^!\.claude\/rules\/\*\*$/m.test(gitignore);
  if (!rulesDirAllowed || !rulesChildrenAllowed) {
    findings.push(
      finding(
        "rules-not-versionable",
        ".gitignore",
        "Shared .claude/rules/ must be explicitly unignored so they can travel with the repository.",
      ),
    );
  }

  if (!/^!\.claude\/settings\.json$/m.test(gitignore)) {
    findings.push(
      finding(
        "project-settings-not-versioned",
        ".gitignore",
        "Shared .claude/settings.json must be versioned so its safety policy reaches the team.",
      ),
    );
  }

  if (
    !/^!\.claude\/skills\/$/m.test(gitignore) ||
    !/^!\.claude\/skills\/\*\*$/m.test(gitignore)
  ) {
    findings.push(
      finding(
        "skills-not-versionable",
        ".gitignore",
        "Shared .claude/skills/ must be explicitly unignored so on-demand workflows travel with the repository.",
      ),
    );
  }

  if (
    !/^\.claude\/settings\.local\.json$/m.test(gitignore) ||
    /^!\.claude\/settings\.local\.json$/m.test(gitignore)
  ) {
    findings.push(
      finding(
        "local-settings-versioned",
        ".gitignore",
        ".claude/settings.local.json must remain private and ignored.",
      ),
    );
  }

  const settingsText = await read(rootDir, ".claude/settings.json");
  let settings;
  try {
    settings = settingsText === null ? null : JSON.parse(settingsText);
  } catch {
    findings.push(
      finding(
        "invalid-project-settings",
        ".claude/settings.json",
        "Shared Claude settings must be valid JSON.",
      ),
    );
  }
  if (settingsText === null) {
    findings.push(
      finding(
        "missing-project-settings",
        ".claude/settings.json",
        "Shared Claude safety settings are missing.",
      ),
    );
  } else if (settings) {
    const permissions = settings.permissions ?? {};
    const deny = permissions.deny ?? [];
    const missingDenyRules = REQUIRED_DENY_RULES.filter((rule) => !deny.includes(rule));
    const ask = permissions.ask ?? [];
    const missingAskRules = REQUIRED_ASK_RULES.filter((rule) => !ask.includes(rule));
    if (
      permissions.defaultMode !== "default" ||
      permissions.disableBypassPermissionsMode !== "disable" ||
      permissions.disableAutoMode !== "disable" ||
      missingDenyRules.length > 0 ||
      missingAskRules.length > 0
    ) {
      findings.push(
        finding(
          "unsafe-project-permissions",
          ".claude/settings.json",
          `Project settings must use manual permissions, disable auto/bypass modes, deny secrets/destructive Git commands, and ask before risky Git operations. Missing deny rules: ${missingDenyRules.join(", ") || "none"}; missing ask rules: ${missingAskRules.join(", ") || "none"}`,
        ),
      );
    }
  }

  const claude = await read(rootDir, "CLAUDE.md");
  if (claude === null) {
    findings.push(
      finding("missing-doctrine", "CLAUDE.md", "Canonical repository doctrine is missing."),
    );
  } else {
    if (!claude.includes(".claude/rules/")) {
      findings.push(
        finding(
          "missing-rule-index",
          "CLAUDE.md",
          "Project doctrine must point to the modular .claude/rules/ directory.",
        ),
      );
    }
  }

  for (const [rule, requiredPaths] of Object.entries(SCOPED_RULES)) {
    const relativePath = `.claude/rules/${rule}`;
    const content = await read(rootDir, relativePath);
    if (content === null) continue;
    const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    const pathsBlock =
      frontmatter?.[1].match(/^paths:\r?\n((?:[ \t]+-[ \t]+[^\r\n]+\r?\n?)+)/m)?.[1] ?? "";
    for (const pattern of requiredPaths) {
      if (!pathsBlock.includes(pattern)) {
        findings.push(
          finding(
            "unscoped-domain-rule",
            relativePath,
            `Path-scoped rule must include its verified monorepo path: ${pattern}`,
          ),
        );
      }
      const concretePrefix = pattern.split("*")[0].replace(/\/$/, "");
      if (concretePrefix && !(await exists(join(rootDir, concretePrefix)))) {
        findings.push(
          finding(
            "missing-rule-scope-target",
            relativePath,
            `Rule path scope has no matching monorepo target: ${pattern}`,
          ),
        );
      }
    }
  }

  for (const skill of REQUIRED_ON_DEMAND_SKILLS) {
    const relativePath = `.claude/skills/${skill}/SKILL.md`;
    const content = await read(rootDir, relativePath);
    if (content === null || !/^description:\s*.+$/m.test(content)) {
      findings.push(
        finding(
          "missing-on-demand-skill",
          relativePath,
          `On-demand workflow skill with a discoverable description is required: ${skill}`,
        ),
      );
    }
  }

  const guardSetup = await read(rootDir, "tooling/agent-loop/setup-claude-guard.mjs");
  if (
    guardSetup === null ||
    !guardSetup.includes('join(repoRoot, ".claude", "settings.local.json")')
  ) {
    findings.push(
      finding(
        "guard-settings-not-local",
        "tooling/agent-loop/setup-claude-guard.mjs",
        "The optional gov-loop guard must use the ignored settings.local.json, not shared settings.json.",
      ),
    );
  }

  const matrix = await read(rootDir, DOCTRINE_MATRIX);
  if (matrix === null) {
    findings.push(
      finding(
        "missing-doctrine-matrix",
        DOCTRINE_MATRIX,
        "Doctrine preservation matrix is missing.",
      ),
    );
  } else {
    const missingClassifications = REQUIRED_MATRIX_CLASSIFICATIONS.filter(
      (classification) => !matrix.includes(classification),
    );
    if (missingClassifications.length > 0) {
      findings.push(
        finding(
          "incomplete-doctrine-matrix",
          DOCTRINE_MATRIX,
          `Doctrine preservation matrix is missing classification(s): ${missingClassifications.join(", ")}`,
        ),
      );
    }
  }

  const portable = await read(rootDir, "AGENTS.md");
  if (
    portable === null ||
    !portable.includes("CLAUDE.md") ||
    !portable.includes(".claude/rules/")
  ) {
    findings.push(
      finding(
        "portable-contract-drift",
        "AGENTS.md",
        "Portable agent contract must point to CLAUDE.md and .claude/rules/.",
      ),
    );
  }

  for (const relativePath of ACTIVE_HARNESS_FILES) {
    const content = await read(rootDir, relativePath);
    if (content === null) continue;

    if (content.includes("melgarafael/DeskcommCRM")) {
      findings.push(
        finding(
          "historical-repo-reference",
          relativePath,
          "Active harness artifact points to the historical repository instead of trydavidqix/CRM.",
        ),
      );
    }

    if (content.includes("infra/infra/supabase/")) {
      findings.push(
        finding(
          "obsolete-monorepo-path",
          relativePath,
          "Active harness artifact references the pre-monorepo infra/infra/supabase path.",
        ),
      );
    }

    if (advertisesStaleCommand(content)) {
      findings.push(
        finding(
          "stale-command",
          relativePath,
          "Active harness artifact advertises a command that does not exist in the canonical repo workflow.",
        ),
      );
    }

    if (/use\s+(?:\*\*)?snake_case(?:\*\*)?\s+for\s+(?:all\s+)?file\s+names/i.test(content)) {
      findings.push(
        finding(
          "stale-file-naming",
          relativePath,
          "Active harness artifact normatively requires snake_case for file names.",
        ),
      );
    }

    if (/use\s+(?:\*\*)?relative imports(?:\*\*)?/i.test(content)) {
      findings.push(
        finding(
          "stale-import-style",
          relativePath,
          "Active harness artifact normatively requires relative imports.",
        ),
      );
    }
  }

  for (const relativePath of SKILL_FILES) {
    const content = await read(rootDir, relativePath);
    if (content === null) {
      findings.push(
        finding("missing-repo-skill", relativePath, `Repo skill is missing: ${relativePath}`),
      );
      continue;
    }

    if (!content.includes("CLAUDE.md")) {
      findings.push(
        finding(
          "missing-doctrine-pointer",
          relativePath,
          "Repo skill must point to CLAUDE.md as the canonical repository doctrine.",
        ),
      );
    }
  }

  return findings;
}

function defaultRootDir() {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..");
}

async function main() {
  const rootDir = process.argv[2] ? join(process.cwd(), process.argv[2]) : defaultRootDir();
  const findings = await checkHarnessConsistency(rootDir);

  if (findings.length === 0) {
    console.log(
      "harness:check ok — canonical doctrine, shared rules, preservation matrix and agent bridges are consistent.",
    );
    return;
  }

  console.error(`harness:check failed — ${findings.length} finding(s):`);
  for (const item of findings) {
    console.error(`- [${item.code}] ${item.path}: ${item.message}`);
  }
  process.exitCode = 1;
}

const invokedAsScript = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedAsScript) await main();
