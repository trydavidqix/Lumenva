import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as yaml from 'js-yaml';

describe('Publish Image Workflow Contract (F8-J3)', () => {
  const workflowPath = join(process.cwd(), '.github', 'workflows', 'publish-image.yml');

  let workflowContent: any;

  try {
    const fileContent = readFileSync(workflowPath, 'utf8');
    workflowContent = yaml.load(fileContent);
  } catch (err) {
    console.warn('Could not read publish-image.yml');
  }

  it('workflow should exist and be valid YAML', () => {
    expect(workflowContent).toBeDefined();
    expect(workflowContent.jobs).toBeDefined();
  });

  it('should authenticate via Google Workload Identity Federation (WIF)', () => {
    const steps = workflowContent.jobs['build-and-push'].steps;

    // Should NOT have docker/login-action with GHCR or static secrets
    const hasDockerLoginGHCR = steps.some((s: any) =>
      s.uses?.startsWith('docker/login-action') &&
      s.with?.registry === 'ghcr.io'
    );
    expect(hasDockerLoginGHCR).toBe(false);

    // Should use google-github-actions/auth
    const hasWifAuth = steps.some((s: any) =>
      s.uses?.startsWith('google-github-actions/auth') &&
      s.with?.workload_identity_provider &&
      s.with?.service_account
    );
    expect(hasWifAuth).toBe(true);
  });

  it('should push to Artifact Registry with dry-run support (no real push for F8-C0)', () => {
    const steps = workflowContent.jobs['build-and-push'].steps;

    const buildStep = steps.find((s: any) => s.uses?.startsWith('docker/build-push-action'));
    expect(buildStep).toBeDefined();

    // In F8-C0 gate, we should NOT push real images, or it must be explicitly dry-run
    // Let's enforce that push is set to false to respect the "dry-run - sem push de imagem de verdade" requirement.
    expect(buildStep.with?.push).toBe(false);
  });

  it('should use immutable tags (commit sha) for Artifact Registry', () => {
    const steps = workflowContent.jobs['build-and-push'].steps;
    const metaStep = steps.find((s: any) => s.uses?.startsWith('docker/metadata-action'));

    expect(metaStep).toBeDefined();
    const tags = metaStep.with?.tags;

    // Tags should include a type=sha or similar immutable hash
    expect(tags).toContain('type=sha,format=long');
    // Ensure we are targeting GCP registry
    expect(metaStep.with?.images).not.toContain('ghcr.io');
  });
});
