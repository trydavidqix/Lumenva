/**
 * Automation Scheduling Workflow — State machine.
 *
 * Pattern: load_config → schedule_run → await_approval [INTERRUPT] → route → execute → completed
 */

import { Annotation } from '@langchain/langgraph';

export interface AutomationSchedulingGraphState {
  workflowRunId: string;
  organizationId: string;
  automationId: string;

  // Loaded automation config
  automationConfig: {
    name: string;
    type: 'message_campaign' | 'lead_scoring' | 'proposal_send';
    schedule: string; // cron-like: "0 9 * * 1-5" (9am weekdays)
    enabled: boolean;
    filters: Record<string, unknown>; // lead tags, pipeline stage, etc
    action_params: Record<string, unknown>; // message template, score threshold, etc
  } | null;

  // Scheduled run details
  nextRunAt: string | null;
  estimatedLeadCount: number | null;

  // Human approval
  humanDecision: 'approve' | 'reject' | 'edit' | null;
  humanReason: string | null;
  editedSchedule: string | null;

  // Execution
  executedAt: string | null;
  executionJobId: string | null;
  leadsProcessed: number | null;

  // Status
  status: 'drafted' | 'awaiting_approval' | 'approved' | 'rejected' | 'scheduled' | 'executed' | 'completed';
}

export const AutomationSchedulingGraphStateAnnotation = Annotation.Root({
  workflowRunId: {
    reducer: (prev: string, next: string) => next || prev,
    default: () => '',
  },
  organizationId: {
    reducer: (prev: string, next: string) => next || prev,
    default: () => '',
  },
  automationId: {
    reducer: (prev: string, next: string) => next || prev,
    default: () => '',
  },
  automationConfig: {
    reducer: (prev: any, next: any) => next ?? prev,
    default: () => null,
  },
  nextRunAt: {
    reducer: (prev: string | null, next: string | null) => next ?? prev,
    default: () => null,
  },
  estimatedLeadCount: {
    reducer: (prev: number | null, next: number | null) => next ?? prev,
    default: () => null,
  },
  humanDecision: {
    reducer: (prev: string | null, next: string | null) => next ?? prev,
    default: () => null,
  },
  humanReason: {
    reducer: (prev: string | null, next: string | null) => next ?? prev,
    default: () => null,
  },
  editedSchedule: {
    reducer: (prev: string | null, next: string | null) => next ?? prev,
    default: () => null,
  },
  executedAt: {
    reducer: (prev: string | null, next: string | null) => next ?? prev,
    default: () => null,
  },
  executionJobId: {
    reducer: (prev: string | null, next: string | null) => next ?? prev,
    default: () => null,
  },
  leadsProcessed: {
    reducer: (prev: number | null, next: number | null) => next ?? prev,
    default: () => null,
  },
  status: {
    reducer: (prev: string, next: string) => next || prev,
    default: () => 'drafted',
  },
});
