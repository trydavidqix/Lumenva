import type { QuotaState } from './quota-router';
export interface WorkforceDashboardSnapshot{generated_at:string;providers:{provider:string;health:string;quota:QuotaState}[];routing:{model_id:string;samples:number;success_rate:number;validation_state:string}[];budget:{spent_usd:number;limit_usd:number;state:string};runs:{active:number;blocked:number;failed:number;completed:number}}
export function buildDashboardSnapshot(input:Omit<WorkforceDashboardSnapshot,'generated_at'>):WorkforceDashboardSnapshot{return{...input,generated_at:new Date().toISOString()}}
