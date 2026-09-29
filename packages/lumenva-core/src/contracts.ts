export const CORE_EVENT_TYPES = ['core.started','core.stopping','agent.created','agent.status.changed','task.created','task.status.changed','terminal.created','terminal.output','terminal.exited','telemetry.observed','alert.raised'] as const;
export type CoreEventType = (typeof CORE_EVENT_TYPES)[number];
export interface CoreEvent<T = unknown> { id: string; type: CoreEventType; occurredAt: string; source: string; payload: T; traceId?: string; }
export type Unsubscribe = () => void;
export interface CoreHealth { status: 'STARTING'|'READY'|'STOPPING'|'STOPPED'; startedAt: string | null; eventSequence: number; subscribers: number; }
