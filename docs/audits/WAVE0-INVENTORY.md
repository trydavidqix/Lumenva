# WAVE 0 — CONSOLIDATION AUDIT INVENTORY

## Overview
This document represents the consolidation audit of the current repository state (`packages/social-brain/`, `packages/operating-core/`, `apps/crm/`, `docs/`) against the new Canonical Blueprint. Its goal is to inventory specified components and map them to the new target architecture without creating duplicate systems.

## Component Inventory

### 1. Agent OS (and Agent Tables/AgentDefinition)
* **Location:** `apps/crm/lib/agent-engine/product-agents/definitions.ts`, `apps/crm/lib/agent-engine/contracts/agent-os.ts`
* **Classification:** **[EXTEND]**
* **Justification:** Current `apps/crm/lib/agent-engine` implementation will be extracted and moved to `packages/agent-definition/` and `packages/agent-factory/`. They will be placed behind versioned interfaces to decouple the model routing from agent definitions.

### 2. org_memory
* **Location:** `supabase/migrations/20260724010000_0067_org_memory.sql`, `apps/crm/lib/agent-engine/agent/org-memory.ts`
* **Classification:** **[EXTEND]**
* **Justification:** The existing tables and state logic will be preserved but wrapped within the new `packages/memory/` durable repository contract, ensuring the Postgres DB remains the single source of truth.

### 3. agent_memory
* **Location:** `supabase/migrations/20260819130000_0139_agent_memory_tables.sql`
* **Classification:** **[EXTEND]**
* **Justification:** Will be integrated into the `packages/memory/` boundary alongside `org_memory`. This consolidation ensures a single, unified memory interface for the runtime and prevents duplicate storage or access logic.

### 4. Graphiti
* **Location:** `docker/graphiti/zep_graphiti.py`
* **Classification:** **[REUSE]**
* **Justification:** Graphiti will continue to operate as an execution-plane capability adapter. It will be accessed via the `packages/memory/` repository contracts and will not act as the authoritative state.

### 5. Mem0
* **Location:** `docker/mem0/init-db.sh`
* **Classification:** **[REUSE]**
* **Justification:** Like Graphiti, Mem0 remains a specialized capability adapter behind the `packages/memory/` API for vector and entity retrieval, without competing with the primary Postgres truth.

### 6. Obsidian configurations
* **Location:** `apps/crm/scripts/obsidian-export.ts`
* **Classification:** **[REPLACE]**
* **Justification:** Local Obsidian workflows and exports will be replaced by the formal `DocumentationIntake` process and `packages/studio-*/` primitives in the target architecture, shifting knowledge ingestion directly into the command center.

### 7. Psyche
* **Location:** `packages/social-brain/agents/src/knowledge-loader.ts` (and related `Agent-Birth-Pipeline`)
* **Classification:** **[EXTEND]**
* **Justification:** The current Psyche pipeline and agent-birth logic will evolve into `packages/prompt-compiler/` and `packages/agent-factory/`. This compiles versioned modules from raw instructions while generating proper hashes and metadata.

### 8. roles
* **Location:** `packages/social-brain/agents/*.ts`
* **Classification:** **[REPLACE]**
* **Justification:** Disparate, hardcoded roles in the `social-brain` package will be replaced by formalized, data-driven Product Agent definitions managed by the new `packages/agent-definition/` system to standardize execution.

### 9. skills
* **Location:** `.agents/skills`, `.claude/skills`
* **Classification:** **[REUSE]**
* **Justification:** Existing skill definitions are stable and will be indexed directly by `packages/skill-registry/` without being deleted. This provides a clean interface for models to discover tools dynamically.

### 10. MCP implementations
* **Location:** `apps/crm/lib/mcp/`
* **Classification:** **[EXTEND]**
* **Justification:** Current MCP tools will be migrated into `packages/tool-registry/`. They must share the exact same API contracts, authorization, and idempotency logic as the UI/CLI, enforcing a single execution path.

### 11. Knowledge / Source Registry
* **Location:** `apps/crm/hooks/ai/useKnowledgeSources.ts`, Supabase schema for Source Registry
* **Classification:** **[EXTEND]**
* **Justification:** Will be formalized under the `DocumentationIntake` flows. The registry will serve as the canonical evidence and context source for the `prompt-compiler`, integrated seamlessly with the CRM UI.

### 12. Context Package logic
* **Location:** `packages/social-brain/core/src/analytics/context-service.ts`
* **Classification:** **[EXTEND]**
* **Justification:** Distinct context assembly services will be unified under the `packages/agent-runtime/` facade, which will act as the single state reducer and evidence seam for execution, eliminating duplicated context building.

### 13. scheduler
* **Location:** `apps/crm/workers/ai-budget-checker.cron.ts`, `apps/crm/tests/sonda-tick-cron.ts`
* **Classification:** **[REPLACE]**
* **Justification:** The current varied cron and queue loops will be fully replaced by `packages/shift-os/`, which will unify pacing, budget, and queue signals, guaranteeing that no second or competing scheduler runs simultaneously.
