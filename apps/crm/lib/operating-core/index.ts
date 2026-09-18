/**
 * Canonical application boundary for durable jobs and domain-event dispatch.
 *
 * Implementations remain in their focused modules. This facade prevents runtime
 * consumers from selecting parallel queue or event abstractions.
 */
export {
  cancelJob,
  claimJobs,
  completeJob,
  enqueueJob,
  failJob,
  reapExpiredJobs,
  rescheduleJob,
  type ClaimOptions,
  type EnqueueInput,
  type JobKind,
  type JobRow,
  type JobStatus,
  type Queryable,
} from "../agent-engine/queue/queue";

export {
  dispatchEvent,
  getRegisteredHandlers,
  registerHandler,
  type EventHandler,
  type EventRow,
  type HandlerResult,
} from "../event-log/dispatcher";
