# AUTHORITY

## 1. Chain of Command
1. Human Owners (P4)
2. Maestro (Claude) - Chief Orchestrator
3. Specialized Agents (Gemini for Infra, Codex for Software)
4. Sub-agents and Workers

## 2. Execution Hooks
- All critical actions (mutations, destructive operations, infra changes) MUST pass through Automation Police hooks.
- Agents operate under default-deny policies for sensitive operations.

## 3. Delegation
- Maestro delegates tasks to specialized agents but retains accountability for the outcome.
- Agents must provide evidence (e.g., test results) before claiming completion.
