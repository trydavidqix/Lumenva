export type MemoryKind =
  | "CORE"
  | "IDENTITY"
  | "WORKING"
  | "SEMANTIC"
  | "EPISODIC"
  | "PROCEDURAL"
  | "RELATIONAL"
  | "AFFECTIVE"
  | "REFLECTION"
  | "KNOWLEDGE";

export type MemoryLifecycle = "draft" | "active" | "frozen" | "superseded" | "expired" | "redacted" | "rejected";

export interface MemoryEvent {
  recordId: string;
  kind: MemoryKind;
  organizationId: string;
  subject: string;
  scope: string;
  authority: number;
  confidence: number;
  observedAt: string;
  validUntil: string | null;
  lifecycle: MemoryLifecycle;
  content: string;
}

export interface ContextCompilerInput {
  organizationId: string;
  subject: string;
  scope: string;
  budgetTokens: number;
  now?: string;
}

export interface ContextPackage {
  packageId: string;
  organizationId: string;
  subject: string;
  scope: string;
  memory: MemoryEvent[];
  knowledge: MemoryEvent[];
  budget: { maxTokens: number; usedTokens: number };
  trustMetadata: {
    omittedRecordIds: string[];
  };
  generatedAt: string;
  expiresAt: string;
}

const TOKEN_PATTERN = /\S+/g;

function tokenCount(content: string): number {
  return content.match(TOKEN_PATTERN)?.length ?? 0;
}

function rank(a: MemoryEvent, b: MemoryEvent): number {
  return (
    b.authority - a.authority ||
    b.confidence - a.confidence ||
    b.observedAt.localeCompare(a.observedAt) ||
    a.recordId.localeCompare(b.recordId)
  );
}

export function compileContextPackage(
  events: readonly MemoryEvent[],
  input: ContextCompilerInput,
): ContextPackage {
  const now = input.now ?? "1970-01-01T00:00:00.000Z";
  const eligible: MemoryEvent[] = [];
  const omittedRecordIds: string[] = [];

  for (const event of events) {
    const matchesNamespace =
      event.organizationId === input.organizationId &&
      event.subject === input.subject &&
      event.scope === input.scope;
    const active = event.lifecycle === "active";
    const unexpired = event.validUntil === null || event.validUntil > now;

    if (matchesNamespace && active && unexpired) eligible.push(event);
    else omittedRecordIds.push(event.recordId);
  }

  eligible.sort(rank);
  const selected: MemoryEvent[] = [];
  let usedTokens = 0;

  for (const event of eligible) {
    const tokens = tokenCount(event.content);
    if (usedTokens + tokens <= Math.max(0, input.budgetTokens)) {
      selected.push(event);
      usedTokens += tokens;
    } else {
      omittedRecordIds.push(event.recordId);
    }
  }

  const expiresAt = input.now ?? "1970-01-01T00:00:00.000Z";
  return {
    packageId: `context:${input.organizationId}:${input.subject}:${input.scope}:${expiresAt}`,
    organizationId: input.organizationId,
    subject: input.subject,
    scope: input.scope,
    memory: selected,
    knowledge: selected.filter((event) => event.kind === "KNOWLEDGE"),
    budget: { maxTokens: Math.max(0, input.budgetTokens), usedTokens },
    trustMetadata: { omittedRecordIds },
    generatedAt: now,
    expiresAt,
  };
}
