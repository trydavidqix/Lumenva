# AGENT GOVERNANCE

## 1. Agent Lifecycle
- Agent != Process. Agents are stateful, goal-oriented entities.
- Agents must have defined start and end states.
- Idle agents are suspended or terminated to conserve resources.

## 2. Agent Capabilities
- Capabilities are explicitly granted via MCP (Model Context Protocol) and tools.
- Agents cannot self-grant capabilities.

## 3. Auditing
- Every agent action, decision, and tool call is logged.
- The Maestro reviews agent execution against the initial prompt/spec.
