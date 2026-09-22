import type { ExecutionPort,ExecutionResult,TaskComplexity,TaskContract } from './execution-port';
import { executeWithRetry,type ExecutionAttempt } from './execution-loop';
import { DEFAULT_ESCALATION_POLICY,nextEscalation,type EscalationPolicy,type EscalationState } from './escalation-engine';
export interface EscalationPorts{worker?:ExecutionPort;professional?:ExecutionPort;frontier?:ExecutionPort}
export interface EscalatingExecution{result:ExecutionResult;attempts:ExecutionAttempt[];state:EscalationState;history:string[]}
export async function executeWithEscalation(contract:TaskContract,ports:EscalationPorts,complexity:TaskComplexity='NORMAL',policy:EscalationPolicy=DEFAULT_ESCALATION_POLICY):Promise<EscalatingExecution>{
 const state:EscalationState={worker_attempts:0,professional_attempts:0,frontier_attempts:0,replans:0};const attempts:ExecutionAttempt[]=[];const history:string[]=[];
 let last:ExecutionResult={task_id:contract.task_id,status:'blocked',files_changed:[],tests:[],evidence:'no_executor_available',risks:['no_executor_available']};
 while(true){const action=nextEscalation(state,policy,complexity);history.push(action);if(action==='blocked'||action==='replan')return{result:last,attempts,state,history};
 const port=action==='retry-worker'?ports.worker:action==='use-professional'?ports.professional:ports.frontier;
 if(!port){if(action==='retry-worker')state.worker_attempts=policy.max_worker_attempts;else if(action==='use-professional')state.professional_attempts=policy.max_professional_attempts;else state.frontier_attempts=policy.max_frontier_attempts;continue}
 const loop=await executeWithRetry(port,contract,{max_attempts:1,base_delay_ms:0,max_delay_ms:0,retryable_statuses:[]});last=loop.result;attempts.push(...loop.attempts);
 if(action==='retry-worker')state.worker_attempts++;else if(action==='use-professional')state.professional_attempts++;else state.frontier_attempts++;
 if(last.status==='success')return{result:last,attempts,state,history};
 }}
