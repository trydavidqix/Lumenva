# MEMORY GOVERNANCE

## 1. Ephemeral vs. Persistent
- Short-term memory (context window) is ephemeral.
- Long-term memory must be intentionally persisted to the Knowledge Core or database.

## 2. Memory Sanitization
- Memories must be sanitized of PII and secrets before persistence.
- Context windows are wiped between disjoint tasks to prevent leakage.

## 3. Memory Limits
- Memory is bounded. Agents must summarize and compress past interactions to stay focused.
