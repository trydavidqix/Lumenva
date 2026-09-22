import type { ExecutionPort,ExecutionResult,RiskLevel,TaskContract } from './execution-port';
import type { ReviewResult } from './independent-review';
import { evaluateIndependentReview } from './independent-review';

export interface ReviewerTarget{provider:string;model?:string;port:ExecutionPort}
export async function executeIndependentReview(input:{implementation:ExecutionResult;contract:TaskContract;risk:RiskLevel;target:ReviewerTarget}):Promise<{reviewExecution:ExecutionResult;review:ReviewResult}>{
 const {implementation,contract,risk,target}=input;
 if(implementation.provider&&implementation.provider===target.provider)throw new Error('reviewer_must_be_independent_from_implementer');
 const reviewContract:TaskContract={...contract,task_id:`${contract.task_id}:review`,goal:`Independently review task ${contract.task_id}. Verify acceptance criteria, deterministic evidence, risks, and implementation evidence. Do not modify production.`,scope:'independent-review',constraints:[...contract.constraints,'review_only','no_production_mutation'],capabilities:['review'],risk,complexity:contract.complexity,context_packet_id:contract.context_packet_id,max_attempts:1};
 const reviewExecution=await target.port.execute(reviewContract);
 const review=evaluateIndependentReview({implementation,reviewer_provider:target.provider,reviewer_model:target.model,risk,deterministic_checks:[...implementation.tests.map((t,i)=>({name:t.name??`test-${i+1}`,passed:t.passed,evidence:t.report})),{name:'reviewer_execution',passed:reviewExecution.status==='success',evidence:reviewExecution.evidence}]});
 if(reviewExecution.status!=='success')review.reasons.push('reviewer_execution_failed');
 review.accepted=review.reasons.length===0;
 review.evidence_refs.push(reviewExecution.evidence,...(reviewExecution.artifacts??[]));
 return{reviewExecution,review};
}
