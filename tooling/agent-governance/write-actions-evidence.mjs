#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const sha = process.env.PR_HEAD_SHA ?? process.env.GITHUB_SHA ?? '';
const artifact = {
  task_id: process.env.GITHUB_RUN_ID ?? '',
  provider_task_ref: process.env.GITHUB_RUN_ID ?? '',
  provider: 'github_actions',
  role: 'verification',
  branch: process.env.PR_BRANCH ?? '',
  head_sha: sha,
  result: process.env.VERIFY_RESULT === 'success' && process.env.INVARIANTS_RESULT === 'success' ? 'pass' : 'fail',
  evidence: [`verify:${process.env.VERIFY_RESULT ?? 'unknown'}`, `invariants:${process.env.INVARIANTS_RESULT ?? 'unknown'}`],
  blockers: [
    ...(process.env.VERIFY_RESULT === 'success' ? [] : [`verify:${process.env.VERIFY_RESULT ?? 'unknown'}`]),
    ...(process.env.INVARIANTS_RESULT === 'success' ? [] : [`invariants:${process.env.INVARIANTS_RESULT ?? 'unknown'}`]),
  ],
  run_url: process.env.ACTIONS_RUN_URL ?? '',
};
const outputPath = resolve(process.env.GOVERNANCE_ARTIFACT_PATH ?? 'artifacts/governance/actions-evidence.json');
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`);
if (process.argv.includes('--assert-pass') && (!/^[0-9a-f]{40}$/.test(sha) || !artifact.branch || artifact.result !== 'pass')) {
  console.error(`GitHub Actions evidence not green for valid PR HEAD SHA: ${sha || 'missing'}`);
  process.exitCode = 1;
}
