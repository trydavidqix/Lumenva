import type { ExecutionPort,ExecutionResult,TaskContract } from './execution-port';
import { DEFAULT_RETRY_POLICY,retryDelay,shouldRetry,type RetryPolicy } from './retry-controller';
export interface ExecutionAttempt{attempt:number;result:ExecutionResult;delay_before_next_ms?:number}
export interface ExecutionLoopResult{result:ExecutionResult;attempts:ExecutionAttempt[]}
export async function executeWithRetry(port:ExecutionPort,contract:TaskContract,policy:RetryPolicy=DEFAULT_RETRY_POLICY,sleep:(ms:number)=>Promise<void>=ms=>new Promise(r=>setTimeout(r,ms))):Promise<ExecutionLoopResult>{
 const attempts:ExecutionAttempt[]=[];let attempt=1;
 while(true){const result=await port.execute({...contract,max_attempts:policy.max_attempts});const row:ExecutionAttempt={attempt,result};attempts.push(row);if(!shouldRetry(result,attempt,policy))return{result,attempts};const delay=retryDelay(attempt,policy);row.delay_before_next_ms=delay;await sleep(delay);attempt++;}
}
