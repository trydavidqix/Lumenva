# AI Platform Phase 3 — Knowledge, Obsidian & LlamaIndex Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a controlled editorial publication flow from Obsidian into the existing knowledge/RAG system, with LlamaIndex.TS as an optional ingestion adapter for sources that benefit from it.

**Architecture:** Obsidian remains a human authoring workspace outside runtime. Draft/review content never enters the CRM. Only `PUBLISHED` Markdown is exported, sanitized and passed into the existing knowledge source pipeline. LlamaIndex is optional and returns normalized nodes/chunks; PostgreSQL/pgvector and current `ai_knowledge_versions` remain authoritative for active retrieval.

**Tech Stack:** Existing `ai_knowledge_sources`, Storage `ai-policy`, `rag-indexer`, pgvector, TypeScript, LlamaIndex.TS OSS, Vitest.

## Global Constraints

- Phase 2 must be stable at least in SHADOW; this phase does not require Mem0 canary.
- Do not store the Obsidian vault in the CRM database.
- Do not put secrets in Obsidian.
- Do not introduce LlamaCloud/LlamaParse paid dependency without explicit approval.
- Existing native RAG remains default.
- Failed new ingestion must never replace the previously active knowledge version.

---

### Task 1: Define publication frontmatter and validator

**Files:**
- Create: `lib/ai/rag/publication/frontmatter.ts`
- Create: `lib/ai/rag/publication/frontmatter.test.ts`

**Interfaces:**

Expected frontmatter:

```yaml
---
status: PUBLISHED
organization_id: 00000000-0000-4000-8000-000000000001
agent_id: 00000000-0000-4000-8000-000000000002
title: Política de Reembolso
source_id: refund-policy
version: 3
published_at: 2026-08-10T12:00:00Z
---
```

- [ ] **Step 1: Write strict parser tests**

Reject:

- missing status;
- status other than `DRAFT|REVIEW|PUBLISHED|ARCHIVED`;
- missing/invalid UUIDs;
- empty title/source id;
- non-positive version;
- invalid date;
- unknown frontmatter keys when strict mode is enabled.

- [ ] **Step 2: Implement Zod parser**

Only `PUBLISHED` may be returned by `assertPublishableDocument()`.

- [ ] **Step 3: Verify and commit**

```bash
pnpm vitest run lib/ai/rag/publication/frontmatter.test.ts
pnpm typecheck
git add lib/ai/rag/publication/frontmatter.ts lib/ai/rag/publication/frontmatter.test.ts
git commit -m "feat(knowledge): validate published knowledge frontmatter"
```

---

### Task 2: Build publication secret/PII scanner

**Files:**
- Create: `lib/ai/rag/publication/sanitize.ts`
- Create: `lib/ai/rag/publication/sanitize.test.ts`

**Interfaces:**

```ts
scanPublishableKnowledge(markdown: string): {
  allowed: boolean;
  findings: Array<{ code: string; line: number }>;
};
```

- [ ] **Step 1: Write failing tests**

Block API keys, bearer/JWT, passwords/recovery codes, `.env` style secret lines, private keys, cookies/session tokens. Flag likely personal e-mail/phone when the doc is not explicitly classified as allowed contact-directory content.

- [ ] **Step 2: Implement deterministic scanner**

Do not log matched secret value; findings only contain code/line.

- [ ] **Step 3: Verify and commit**

```bash
pnpm vitest run lib/ai/rag/publication/sanitize.test.ts
pnpm typecheck
git add lib/ai/rag/publication/sanitize.ts lib/ai/rag/publication/sanitize.test.ts
git commit -m "feat(knowledge): scan published knowledge before ingestion"
```

---

### Task 3: Add Obsidian export CLI without direct DB access

**Files:**
- Create: `scripts/obsidian-export.ts`
- Create: `tests/unit/obsidian-export.test.ts`
- Modify: `.gitignore`
- Modify: `package.json`
- Create: `docs/runbooks/obsidian-knowledge.md`

**Interfaces:**
- Command: `pnpm knowledge:obsidian:export -- --file <absolute-or-vault-relative-path>`
- Output directory: `.local/knowledge-publish/` (gitignored).

- [ ] **Step 1: Write tests**

Prove DRAFT/REVIEW are refused, PUBLISHED exports, secret finding blocks export, output filename is deterministic from `source_id` + version, and source Markdown is never modified.

- [ ] **Step 2: Implement exporter**

Exporter:

1. reads Markdown;
2. parses frontmatter;
3. verifies `PUBLISHED`;
4. scans secrets/PII;
5. strips workflow-only frontmatter from body but writes canonical metadata sidecar JSON;
6. writes sanitized artifact into `.local/knowledge-publish/`.

- [ ] **Step 3: Add package command**

```json
"knowledge:obsidian:export": "tsx scripts/obsidian-export.ts"
```

- [ ] **Step 4: Document operator flow**

Obsidian edits are human-controlled; export artifact is then submitted via the CRM knowledge UI/upload path. KeePassXC/Infisical secrets are explicitly forbidden in the vault.

- [ ] **Step 5: Verify and commit**

```bash
pnpm vitest run tests/unit/obsidian-export.test.ts
pnpm typecheck
git add scripts/obsidian-export.ts tests/unit/obsidian-export.test.ts .gitignore package.json pnpm-lock.yaml docs/runbooks/obsidian-knowledge.md
git commit -m "feat(knowledge): add controlled Obsidian publication export"
```

---

### Task 4: Extract shared native knowledge ingestion service from upload route

**Files:**
- Create: `lib/ai/rag/publication/publish-policy.ts`
- Create: `lib/ai/rag/publication/publish-policy.test.ts`
- Modify: `app/api/v1/ai/knowledge/sources/upload/route.ts`

**Interfaces:**

```ts
publishKnowledgePolicy(input: {
  organizationId: string;
  agentId: string;
  actorUserId: string;
  name: string;
  file: { name: string; mimeType: string; bytes: Buffer };
}): Promise<{ sourceId: string; blobPath: string }>;
```

- [ ] **Step 1: Lock existing route behavior in tests**

Cover MIME/size, agent tenant ownership, storage cleanup on extraction failure, source insert and `knowledge_source.updated` emission.

- [ ] **Step 2: Extract service without behavior change**

Route keeps auth/HTTP parsing; service owns storage/validation/source/event work. Organization/actor are passed only from authenticated route context.

- [ ] **Step 3: Verify existing route tests plus new service tests**

- [ ] **Step 4: Commit**

```bash
git add lib/ai/rag/publication/publish-policy.ts lib/ai/rag/publication/publish-policy.test.ts app/api/v1/ai/knowledge/sources/upload/route.ts <tests>
git commit -m "refactor(knowledge): extract canonical publication service"
```

---

### Task 5: Define optional ingestion adapter interface

**Files:**
- Create: `lib/ai/rag/ingestion/port.ts`
- Create: `lib/ai/rag/ingestion/port.test.ts`
- Create: `lib/ai/rag/ingestion/native-adapter.ts`
- Create: `lib/ai/rag/ingestion/native-adapter.test.ts`

**Interfaces:**

```ts
export interface IngestionDocument {
  text: string;
  metadata: {
    organizationId: string;
    sourceId: string;
    sourceVersion: string;
    title: string;
  };
}

export interface IngestionNode {
  text: string;
  position: number;
  metadata: Record<string, string | number | boolean | null>;
}

export interface KnowledgeIngestionPort {
  normalize(document: IngestionDocument): Promise<IngestionNode[]>;
}
```

- [ ] **Step 1: Write tests for native adapter**

Native adapter wraps current chunking behavior and preserves source metadata/content hash semantics.

- [ ] **Step 2: Implement and verify**

```bash
pnpm vitest run lib/ai/rag/ingestion/*.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add lib/ai/rag/ingestion
git commit -m "feat(knowledge): add pluggable ingestion port"
```

---

### Task 6: Add LlamaIndex.TS adapter behind feature flag

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `lib/ai/rag/ingestion/llamaindex-adapter.ts`
- Create: `lib/ai/rag/ingestion/llamaindex-adapter.test.ts`

**Interfaces:**
- Implements `KnowledgeIngestionPort`.

- [ ] **Step 1: Add LlamaIndex.TS OSS dependency**

```bash
pnpm add llamaindex
```

Do not add LlamaCloud/LlamaParse packages or API keys in this task.

- [ ] **Step 2: Write tests with deterministic local transformations**

The adapter must not call an LLM merely to chunk plain Markdown. Use OSS parser/splitter transformations. Tests compare deterministic nodes/metadata and abort behavior.

- [ ] **Step 3: Implement adapter**

Use LlamaIndex only for normalization/chunking features actually needed by configured source type. Preserve canonical source metadata. Return nodes; never write to an independent vector DB.

- [ ] **Step 4: Feature-gate selection**

Add resolver in knowledge ingestion layer: default native; `llamaindex` mode only when feature flag `canary|on` for the tenant/source and kill switch not active. In `shadow`, run both and compare but index native output only.

- [ ] **Step 5: Verify and commit**

```bash
pnpm vitest run lib/ai/rag/ingestion/llamaindex-adapter.test.ts lib/ai/rag/ingestion/native-adapter.test.ts
pnpm typecheck
pnpm lint
git add package.json pnpm-lock.yaml lib/ai/rag/ingestion
git commit -m "feat(knowledge): add optional LlamaIndex ingestion adapter"
```

---

### Task 7: Wire ingestion adapters into RAG indexer without changing active-version safety

**Files:**
- Modify: `workers/rag-indexer.ts`
- Modify/create: `workers/rag-indexer.test.ts`

**Interfaces:**
- Existing `createKnowledgeVersion -> chunks -> mark ready -> activate` lifecycle remains authoritative.

- [ ] **Step 1: Add regression tests**

Prove:

- feature off uses native output;
- shadow computes comparison but stores native nodes only;
- adapter failure leaves previous knowledge version active;
- zero written chunks never activates new version;
- metadata contains provenance fields;
- org filters unchanged.

- [ ] **Step 2: Refactor only the chunk-generation seam**

Do not rewrite version lifecycle or embedding storage.

- [ ] **Step 3: Verify**

```bash
pnpm vitest run workers/rag-indexer.test.ts lib/ai/rag/ingestion/*.test.ts
pnpm test:unit
pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add workers/rag-indexer.ts workers/rag-indexer.test.ts lib/ai/rag/ingestion
git commit -m "feat(knowledge): route ingestion through optional adapters"
```

---

### Task 8: Add provenance and publication regression suite

**Files:**
- Create: `tests/unit/knowledge-publication-golden.test.ts`
- Extend: `tests/fixtures/ai-platform/golden-cases.json`

- [ ] **Step 1: Add cases**

- published refund policy answers correctly;
- archived/draft copy is never indexed;
- old version does not beat published current version;
- Mem0 preference cannot override PUBLISHED policy;
- prompt injection inside document remains data, not instruction;
- secret-containing document is blocked pre-ingestion.

- [ ] **Step 2: Verify deterministic tests**

```bash
pnpm vitest run tests/unit/knowledge-publication-golden.test.ts
pnpm ai:eval:local
```

- [ ] **Step 3: Commit**

```bash
git add tests/unit/knowledge-publication-golden.test.ts tests/fixtures/ai-platform/golden-cases.json
git commit -m "test(knowledge): cover publication authority and provenance"
```

---

### Task 9: Phase 3 release gate

**Files:**
- Create: `docs/evidence/ai-platform/phase-3-knowledge-gate.md`

- [ ] **Step 1: Prove native-only mode matches baseline**
- [ ] **Step 2: Prove Obsidian DRAFT/REVIEW cannot export**
- [ ] **Step 3: Prove PUBLISHED export->upload->index path using synthetic Markdown**
- [ ] **Step 4: Prove LlamaIndex shadow failure cannot replace active knowledge**
- [ ] **Step 5: Run full verification**

```bash
pnpm typecheck
pnpm lint
pnpm test:unit
pnpm test:db
pnpm ai:eval:local
pnpm build
git diff --check
```

- [ ] **Step 6: Record GO/NO-GO and commit**

```bash
git add docs/evidence/ai-platform/phase-3-knowledge-gate.md
git commit -m "docs(ai-platform): record knowledge release gate"
```
