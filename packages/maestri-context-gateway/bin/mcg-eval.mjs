#!/usr/bin/env node
import { homedir } from 'node:os';
import { join } from 'node:path';
import { runAbValidation } from '../src/eval-runner.mjs';

const root = process.env.MCG_ROOT || join(homedir(), '.lumenva', 'maestri-context-gateway');
const binary = process.env.CODEX_BIN || join(homedir(), '.codex', 'packages', 'standalone', 'current', 'bin', 'codex.exe');
const result = await runAbValidation({ root, binary });
process.stdout.write(`${JSON.stringify({ run_id: result.run_id, baseline: result.baseline, mcg: result.mcg, savings: result.quality_preserving_savings, trust: result.trust }, null, 2)}\n`);
