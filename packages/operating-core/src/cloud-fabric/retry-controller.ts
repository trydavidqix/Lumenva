import type { ExecutionResult } from './execution-port';
export interface RetryPolicy{max_attempts:number;base_delay_ms:number;max_delay_ms:number;retryable_statuses:ExecutionResult['status'][]}
export const DEFAULT_RETRY_POLICY:RetryPolicy={max_attempts:2,base_delay_ms:250,max_delay_ms:4000,retryable_statuses:['failure','partial']};
export function retryDelay(attempt:number,p:RetryPolicy=DEFAULT_RETRY_POLICY):number{return Math.min(p.max_delay_ms,p.base_delay_ms*Math.pow(2,Math.max(0,attempt-1)))}
export function shouldRetry(r:ExecutionResult,attempt:number,p:RetryPolicy=DEFAULT_RETRY_POLICY):boolean{return attempt<p.max_attempts&&p.retryable_statuses.includes(r.status)}
