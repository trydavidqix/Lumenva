#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { parseCodexJsonl, parseCodexTools } from '../src/codex-usage.mjs';

const path = process.argv[2];
if (!path) process.exit(2);
const output = await readFile(path, 'utf8');
const usage = parseCodexJsonl(output);
process.stdout.write(`${JSON.stringify({ usage, tools: parseCodexTools(output) })}\n`);
