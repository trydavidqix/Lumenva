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
  createdAt?: string;
  validUntil: string | null;
  lifecycle: MemoryLifecycle;
  content: string;
  supersedes?: string | null;
}

export type ContextSection = Record<string, unknown> | string | null;

export interface ContextCompilerInput {
  organizationId: string;
  subject: string;
  scope: string;
  budgetTokens: number;
  now?: string;
  identity?: ContextSection;
  goal?: ContextSection;
  session?: ContextSection;
  toolState?: ContextSection;
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
    organizationId: string;
    scope: string;
    omittedRecordIds: string[];
    selectedRecordIds: string[];
  };
  generatedAt: string;
  expiresAt: string;
  identity: ContextSection;
  goal: ContextSection;
  session: ContextSection;
  toolState: ContextSection;
}

const sectionTokenCount = (section: ContextSection): number => section === null ? 0 : (typeof section === "string" ? section : JSON.stringify(section)).match(/\S+/g)?.length ?? 0;

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
  const maxTokens = Math.max(0, input.budgetTokens);
  let usedTokens = sectionTokenCount(input.identity ?? null) + sectionTokenCount(input.goal ?? null) + sectionTokenCount(input.session ?? null) + sectionTokenCount(input.toolState ?? null);

  for (const event of eligible) {
    const tokens = tokenCount(event.content);
    if (usedTokens + tokens <= maxTokens) {
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
    identity: input.identity ?? null,
    goal: input.goal ?? null,
    memory: selected,
    knowledge: selected.filter((event) => event.kind === "KNOWLEDGE"),
    session: input.session ?? null,
    toolState: input.toolState ?? null,
    budget: { maxTokens: Math.max(0, input.budgetTokens), usedTokens },
    trustMetadata: { organizationId: input.organizationId, scope: input.scope, omittedRecordIds, selectedRecordIds: selected.map((event) => event.recordId) },
    generatedAt: now,
    expiresAt,
  };
}
