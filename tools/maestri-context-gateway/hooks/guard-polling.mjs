#!/usr/bin/env node
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const event = JSON.parse(input);
    const tool = event.tool_name || event.toolName;
    const command = event.tool_input?.command || '';
    if (tool === 'TaskOutput' || /\bTaskOutput\b/.test(command)) process.stderr.write('MCG observe: use mcg wait/result instead of polling executor output.\n');
  } catch { /* hooks are observe-only and must never block Claude */ }
});
