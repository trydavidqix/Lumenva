import { readdir } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const roots = ['src', 'bin', 'hooks', 'scripts'];

async function collect(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await collect(path));
    else if (entry.isFile() && extname(entry.name) === '.mjs') files.push(path);
  }
  return files;
}

const files = [];
for (const root of roots) files.push(...await collect(join(packageRoot, root)));
const failures = [];
for (const file of files.sort()) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) failures.push({ file, stderr: result.stderr.trim() });
}
if (failures.length) {
  for (const failure of failures) {
    console.error(`syntax check failed: ${failure.file}`);
    if (failure.stderr) console.error(failure.stderr);
  }
  process.exit(1);
}
console.log(`syntax/import smoke: ${files.length} modules parsed`);
