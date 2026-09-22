export function parseCodexJsonl(text) {
  if (typeof text !== 'string') return null;
  let usage = null;
  for (const line of text.split(/\r?\n/)) {
    try {
      const event = JSON.parse(line);
      if (event.type === 'turn.completed' && event.usage && Number.isFinite(event.usage.input_tokens)) usage = event.usage;
    } catch {}
  }
  if (!usage) return null;
  const input_tokens = usage.input_tokens;
  const cached_input_tokens = Number.isFinite(usage.cached_input_tokens) ? usage.cached_input_tokens : 0;
  const context_tokens = input_tokens + cached_input_tokens;
  const output_tokens = Number.isFinite(usage.output_tokens) ? usage.output_tokens : 0;
  const reasoning_tokens = Number.isFinite(usage.reasoning_output_tokens) ? usage.reasoning_output_tokens : (Number.isFinite(usage.reasoning_tokens) ? usage.reasoning_tokens : 0);
  return { input_tokens, cached_input_tokens, context_tokens, output_tokens, reasoning_tokens, total_tokens: input_tokens + output_tokens + reasoning_tokens, measurement_type: 'exact', source: 'codex.exec.jsonl' };
}

export function parseCodexTools(text) {
  if (typeof text !== 'string') return [];
  const tools = new Set();
  for (const line of text.split(/\r?\n/)) {
    try {
      const item = JSON.parse(line).item;
      if (item?.type === 'command_execution') tools.add('command_execution');
      if (item?.type === 'mcp_tool_call') tools.add(item.server ? `mcp:${item.server}` : 'mcp_tool_call');
    } catch {}
  }
  return [...tools];
}
