/**
 * Automation Scheduling Workflow — State machine.
 *
 * Pattern: load_config → schedule_run → await_approval [INTERRUPT] → route → execute → completed
 */

import { Annotation } from '@langchain/langgraph';

export interface AutomationSchedulingGraphState {
  seed: string;
  output: Record<string, unknown> | null;
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
  seed: Annotation<string>({ default: () => 'f2-f3-vertical-001' }),
  output: Annotation<Record<string, unknown> | null>({ reducer: (_prev, next) => next, default: () => null }),
  workflowRunId: Annotation<string>(),
  organizationId: Annotation<string>(),
  automationId: Annotation<string>(),
  automationConfig: Annotation<{
    name: string;
    type: 'message_campaign' | 'lead_scoring' | 'proposal_send';
    schedule: string;
    enabled: boolean;
    filters: Record<string, unknown>;
    action_params: Record<string, unknown>;
  } | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  nextRunAt: Annotation<string | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  estimatedLeadCount: Annotation<number | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  humanDecision: Annotation<'approve' | 'reject' | 'edit' | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  humanReason: Annotation<string | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  editedSchedule: Annotation<string | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  executedAt: Annotation<string | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  executionJobId: Annotation<string | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  leadsProcessed: Annotation<number | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  status: Annotation<'drafted' | 'awaiting_approval' | 'approved' | 'rejected' | 'scheduled' | 'executed' | 'completed'>({
    reducer: (prev, next) => next || prev,
    default: () => 'drafted',
  }),
});
