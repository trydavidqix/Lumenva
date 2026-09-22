#!/usr/bin/env node
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runValidationSuite } from '../src/eval-runner.mjs';
const root = process.env.MCG_ROOT || join(homedir(), '.lumenva', 'maestri-context-gateway');
const binary = process.env.CODEX_BIN || join(homedir(), '.codex', 'packages', 'standalone', 'current', 'bin', 'codex.exe');
const mode = process.argv[2] || 'smoke';
const dataset = fileURLToPath(new URL(mode === 'validation' ? '../evals/datasets/validation.jsonl' : '../evals/datasets/smoke.jsonl', import.meta.url));
const result = await runValidationSuite({ root, binary, dataset, model: process.env.MCG_EVAL_MODEL || 'gpt-5.6', effort: process.env.MCG_EVAL_EFFORT || 'medium', limit: mode === 'smoke' ? 6 : null });
process.stdout.write(JSON.stringify(result, null, 2) + '\n');
