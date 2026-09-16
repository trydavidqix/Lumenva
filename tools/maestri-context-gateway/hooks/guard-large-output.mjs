#!/usr/bin/env node
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const event = JSON.parse(input);
    const command = event.tool_input?.command || '';
    if (/\b(cat|gh run view|gh pr checks|TaskOutput)\b/.test(command) && !/\b(tail|head|rg|grep|--jq|--json)\b/.test(command)) process.stderr.write('MCG observe: prefer bounded or structured evidence output.\n');
  } catch { /* observe-only */ }
});
