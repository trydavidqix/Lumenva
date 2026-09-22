import type { RoutingDecision } from './routing-policy';
import type { RoutingTrace } from './routing-observability';
export function createRoutingTrace(input:{task_id:string;phase:RoutingTrace['phase'];decision:RoutingDecision;job_id?:string;execution_id?:string;context_packet_id?:string;agent_id?:string}):RoutingTrace{return{trace_id:`trace_${input.task_id}_${input.phase}_${Date.now()}`,...input,created_at:new Date().toISOString()}}
