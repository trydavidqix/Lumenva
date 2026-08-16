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
  workflowRunId: {
    reducer: (prev: string, next: string) => next || prev,
    default: () => '',
  },
  organizationId: {
    reducer: (prev: string, next: string) => next || prev,
    default: () => '',
  },
  leadId: {
    reducer: (prev: string, next: string) => next || prev,
    default: () => '',
  },
  leadData: {
    reducer: (prev: any, next: any) => next ?? prev,
    default: () => null,
  },
  draftScore: {
    reducer: (prev: number | null, next: number | null) => next ?? prev,
    default: () => null,
  },
  draftReason: {
    reducer: (prev: string | null, next: string | null) => next ?? prev,
    default: () => null,
  },
  isValid: {
    reducer: (prev: boolean, next: boolean) => next ?? prev,
    default: () => false,
  },
  validationErrors: {
    reducer: (prev: string[], next: string[]) => next ?? prev,
    default: () => [],
  },
  humanDecision: {
    reducer: (prev: string | null, next: string | null) => next ?? prev,
    default: () => null,
  },
  humanReason: {
    reducer: (prev: string | null, next: string | null) => next ?? prev,
    default: () => null,
  },
  editedScore: {
    reducer: (prev: number | null, next: number | null) => next ?? prev,
    default: () => null,
  },
  appliedScore: {
    reducer: (prev: number | null, next: number | null) => next ?? prev,
    default: () => null,
  },
  appliedAt: {
    reducer: (prev: string | null, next: string | null) => next ?? prev,
    default: () => null,
  },
  status: {
    reducer: (prev: string, next: string) => next || prev,
    default: () => 'drafted',
  },
});
