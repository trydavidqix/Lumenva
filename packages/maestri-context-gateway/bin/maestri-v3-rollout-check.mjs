import { execFileSync } from 'node:child_process';
import { evaluateRollout } from '../src/rollout-gate.mjs';

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

const result = evaluateRollout({
  branch: git(['branch', '--show-current']),
  target: process.env.MAESTRI_TARGET || 'vps',
  production: process.env.MAESTRI_PRODUCTION === 'true',
  dirty: Boolean(git(['status', '--porcelain'])),
});

console.log(JSON.stringify(result, null, 2));
if (result.status === 'BLOCKED') process.exitCode = 1;
