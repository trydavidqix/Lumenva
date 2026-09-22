import type { ExecutionPort } from './execution-port';
import type { LearningRouter } from './learning-router';
import { buildDashboardSnapshot,type WorkforceDashboardSnapshot } from './dashboard-snapshot';
import { QuotaBroker } from './quota-broker';
import type { CostLedger } from './cost-ledger';
export async function workforceDashboard(input:{ports:ExecutionPort[];learning:LearningRouter;modelIds:string[];costLedger:CostLedger;monthlyLimitUsd:number;runs:WorkforceDashboardSnapshot['runs']}):Promise<WorkforceDashboardSnapshot>{
 const broker=await new QuotaBroker(input.ports).snapshot();
 const spent=input.costLedger.totalCost();const ratio=input.monthlyLimitUsd>0?spent/input.monthlyLimitUsd:1;
 return buildDashboardSnapshot({providers:broker.map(x=>({provider:x.provider,health:x.snapshot.health??'unavailable',quota:x.state})),routing:input.modelIds.map(id=>{const s=input.learning.stats(id);return{model_id:id,samples:s.samples,success_rate:s.success_rate,validation_state:s.validation_state}}),budget:{spent_usd:spent,limit_usd:input.monthlyLimitUsd,state:ratio>=.9?'RESERVE':ratio>=.8?'RED':ratio>=.5?'YELLOW':'GREEN'},runs:input.runs});
}
