import type { EscalationAction,EscalationState } from './escalation-engine';
export interface EscalationRecord{task_id:string;from_model?:string;to_tier?:number;action:EscalationAction;state:EscalationState;reason:string;created_at:string}
export function recordEscalation(taskId:string,action:EscalationAction,state:EscalationState,reason:string):EscalationRecord{return{task_id:taskId,action,state:{...state},reason,created_at:new Date().toISOString()}}
