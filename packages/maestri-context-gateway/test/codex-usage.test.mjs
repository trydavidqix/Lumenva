import assert from 'node:assert/strict';
import { parseCodexJsonl, parseCodexTools } from '../src/codex-usage.mjs';

const usage = parseCodexJsonl('{"type":"turn.started"}\n{"type":"turn.completed","usage":{"input_tokens":81011,"cached_input_tokens":60672,"output_tokens":464,"reasoning_output_tokens":216}}\n');
assert.deepEqual(usage, { input_tokens: 81011, cached_input_tokens: 60672, output_tokens: 464, reasoning_tokens: 216, total_tokens: 81691, measurement_type: 'exact', source: 'codex.exec.jsonl' });
assert.equal(parseCodexJsonl('{bad}\n'), null);
assert.deepEqual(parseCodexTools('{"type":"item.completed","item":{"type":"command_execution"}}\n{"type":"item.completed","item":{"type":"agent_message"}}\n'), ['command_execution']);
console.log('codex usage tests: 1 passed');
