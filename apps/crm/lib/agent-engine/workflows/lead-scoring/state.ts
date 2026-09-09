/**
 * Lead Scoring Workflow — State machine.
 *
 * Reuses proposal pattern:
 * load_context → draft_score → validate → await_human_decision [INTERRUPT] → apply_score → completed
 */

import { Annotation } from '@langchain/langgraph';

export interface LeadScoringGraphState {
  workflowRunId: string;
  organizationId: string;
  leadId: string;

  // Context loaded in node
  leadData: {
    name: string;
    email: string;
    phone: string;
    engagement_score: number;
    conversation_count: number;
    last_message_at: string;
    tags: string[];
  } | null;

  // Draft scoring output
  draftScore: number | null;
  draftReason: string | null;

  // Validation result
  isValid: boolean;
  validationErrors: string[];

  // Human decision (awaited at INTERRUPT)
  humanDecision: 'approve' | 'reject' | 'edit' | null;
  humanReason: string | null;
  editedScore: number | null;

  // Applied result
  appliedScore: number | null;
  appliedAt: string | null;

  // Status
  status: 'drafted' | 'validated' | 'awaiting_approval' | 'approved' | 'rejected' | 'applied' | 'completed';
}

export const LeadScoringGraphStateAnnotation = Annotation.Root({
  workflowRunId: Annotation<string>(),
  organizationId: Annotation<string>(),
  leadId: Annotation<string>(),
  leadData: Annotation<{
    name: string;
    email: string;
    phone: string;
    engagement_score: number;
    conversation_count: number;
    last_message_at: string;
    tags: string[];
  } | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  draftScore: Annotation<number | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  draftReason: Annotation<string | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  isValid: Annotation<boolean>({
    reducer: (_prev, next) => next,
    default: () => false,
  }),
  validationErrors: Annotation<string[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  humanDecision: Annotation<'approve' | 'reject' | 'edit' | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  humanReason: Annotation<string | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  editedScore: Annotation<number | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  appliedScore: Annotation<number | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  appliedAt: Annotation<string | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  status: Annotation<'drafted' | 'validated' | 'awaiting_approval' | 'approved' | 'rejected' | 'applied' | 'completed'>({
    reducer: (prev, next) => next || prev,
    default: () => 'drafted',
  }),
});
