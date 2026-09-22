import { readFile, readdir } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '../../..');
const targets = [
  'packages/maestri-context-gateway',
  'docs/LUMENVA_COMMAND_CENTER_PLAN.md',
  'docs/superpowers/plans/2026-09-22-lumenva-context-gateway.md',
  'docs/superpowers/specs/2026-09-22-lumenva-context-gateway-design.md'
];
const patterns = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/],
  ['github-token', /\bgh[pousr]_[A-Za-z0-9]{20,}\b/],
  ['openai-key', /\bsk-[A-Za-z0-9_-]{20,}\b/],
  ['anthropic-key', /\bsk-ant-[A-Za-z0-9_-]{20,}\b/],
  ['google-api-key', /\bAIza[0-9A-Za-z_-]{30,}\b/],
  ['aws-access-key', /\bAKIA[0-9A-Z]{16}\b/],
  ['mac-home-path', /\/Users\/[A-Za-z0-9._-]+\//],
  ['linux-home-path', /\/home\/[A-Za-z0-9._-]+\//],
  ['windows-home-path', /[A-Za-z]:\\Users\\[^\\\r\n]+\\/]
];
const textExtensions = new Set(['.mjs', '.js', '.json', '.md', '.ps1', '.yml', '.yaml', '.txt']);

async function collect(target) {
  const absolute = resolve(repoRoot, target);
  const entries = await readdir(absolute, { withFileTypes: true }).catch(() => null);
  if (!entries) return [absolute];
  const files = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'state') continue;
    const child = join(absolute, entry.name);
    if (entry.isDirectory()) files.push(...await collect(relative(repoRoot, child)));
    else if (entry.isFile() && textExtensions.has(extname(entry.name))) files.push(child);
  }
  return files;
}

const files = [];
for (const target of targets) files.push(...await collect(target));
const findings = [];
for (const file of files) {
  const content = await readFile(file, 'utf8');
  for (const [name, pattern] of patterns) if (pattern.test(content)) findings.push({ file: relative(repoRoot, file), pattern: name });
}
if (findings.length) {
  for (const finding of findings) console.error(`sensitive scan failed: ${finding.pattern} in ${finding.file}`);
  process.exit(1);
}
console.log(`secret/path/personal-data scan: PASS (${files.length} files)`);
