import { sanitizeTrace } from './redaction';
export interface WorkforceTelemetryEvent{event_id:string;event_type:string;trace_id?:string;job_id?:string;task_id?:string;agent_id?:string;execution_id?:string;context_packet_id?:string;provider?:string;model?:string;payload:Record<string,unknown>;created_at:string}
export function telemetryEvent(input:Omit<WorkforceTelemetryEvent,'event_id'|'created_at'>):WorkforceTelemetryEvent{return sanitizeTrace({...input,event_id:`evt_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,created_at:new Date().toISOString()})}
