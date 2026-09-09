import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

describe('Phase 7 all-engine benchmark command', () => {
  it('exposes the single package script and executable orchestrator', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    expect(packageJson.scripts?.['phase7:benchmark:all']).toContain('scripts/phase7-benchmark-all.ts');
    expect(fs.existsSync(path.join(root, 'scripts', 'phase7-benchmark-all.ts'))).toBe(true);
  });

  it('uses the canonical comparative evidence output paths', () => {
    const source = fs.readFileSync(path.join(root, 'scripts', 'phase7-benchmark-all.ts'), 'utf8');
    expect(source).toContain('phase-7-comparative-benchmark-evidence.json');
    expect(source).toContain('phase-7-comparative-benchmark-summary.md');
    expect(source).toContain('serializePhase7BenchmarkEvidence');
  });
});
