import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const REQUIRED_RULES = [
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

const ACTIVE_HARNESS_FILES = [
  ".claude/skills/DeskcommCRM/SKILL.md",
  ".agents/skills/DeskcommCRM/SKILL.md",
  ".claude/homunculus/instincts/inherited/DeskcommCRM-instincts.yaml",
  ".claude/ecc-tools.json",
  ".codex/AGENTS.md",
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

  if (/^!\.claude\/settings\.json$/m.test(gitignore)) {
    findings.push(
      finding(
        "settings-versioned",
        ".gitignore",
        ".claude/settings.json is machine-local and must not be explicitly unignored.",
      ),
    );
  }

  const claude = await read(rootDir, "CLAUDE.md");
  if (claude === null) {
    findings.push(
      finding("missing-doctrine", "CLAUDE.md", "Canonical repository doctrine is missing."),
    );
  } else {
    for (const rule of REQUIRED_RULES) {
      const rulePath = `.claude/rules/${rule}`;
      if (!claude.includes(rulePath)) {
        findings.push(
          finding(
            "missing-rule-link",
            "CLAUDE.md",
            `Canonical doctrine must link shared rule: ${rulePath}`,
          ),
        );
      }
    }
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
