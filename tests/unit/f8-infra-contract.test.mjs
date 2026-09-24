import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('F8 Infra Contract (Dry-Run & Placeholders)', () => {
  it('should enforce push: false in gcp-ci.yml', () => {
    const ciPath = join(process.cwd(), '.github/workflows/gcp-ci.yml');
    expect(existsSync(ciPath)).toBe(true);
    const content = readFileSync(ciPath, 'utf-8');

    // Ensure we are strictly in dry-run mode for docker push
    expect(content).toContain('push: false');

    // Ensure we do not use static JSON keys
    expect(content).not.toContain('credentials_json');

    // Fork pull requests cannot mint GCP credentials, and this dry-run does not need package publishing.
    expect(content).not.toMatch(/^\s*packages:\s*write\s*$/m);
    expect(content.match(/^\s*id-token:\s*write\s*$/gm) ?? []).toHaveLength(1);
    expect(content).toContain("  gcp-auth:\n    if: ${{ github.event_name != 'pull_request' && vars.GCP_WORKLOAD_IDENTITY_PROVIDER != '' && vars.GCP_SERVICE_ACCOUNT != '' }}\n    permissions:\n      contents: read\n      id-token: write");
    expect(content.match(/if: \$\{\{ github\.event_name != 'pull_request' && vars\.GCP_WORKLOAD_IDENTITY_PROVIDER != '' && vars\.GCP_SERVICE_ACCOUNT != '' \}\}/g) ?? []).toHaveLength(4);

    // Ensure OIDC is used
    expect(content).toContain('google-github-actions/auth');
  });

  it('should enforce push: false and placeholders in publish-image.yml', () => {
    const pubPath = join(process.cwd(), '.github/workflows/publish-image.yml');
    expect(existsSync(pubPath)).toBe(true);
    const content = readFileSync(pubPath, 'utf-8');

    // Ensure we are strictly in dry-run mode
    expect(content).toContain('push: false');

    // Verify placeholders are used, not real GCP IDs
    expect(content).toContain('PLACEHOLDER');
  });

  it('should have the F8-C0 runbooks present', () => {
    const runbookPath = join(process.cwd(), 'docs/runbooks/gcp-only/f8-c0-integration-runbook.md');
    expect(existsSync(runbookPath)).toBe(true);

    const runbookContent = readFileSync(runbookPath, 'utf-8');
    expect(runbookContent).toContain('F8-C0');
  });
});
