import type { BenchmarkCase } from './benchmark-harness';
import type { RiskLevel,TaskComplexity } from './execution-port';
export interface CorpusSeed{category:string;goal:string;capabilities:string[];risk:RiskLevel;complexity:TaskComplexity}
export function buildValidationCorpus(seeds:CorpusSeed[],baseSha:string):BenchmarkCase[]{return seeds.flatMap(seed=>Array.from({length:5},(_,i)=>({id:`${seed.category}-${i+1}`,task_type:seed.category,risk:seed.risk,complexity:seed.complexity,contract:{task_id:`${seed.category}-${i+1}`,goal:seed.goal,scope:seed.category,allowed_paths:[],constraints:['benchmark_only','no_production_mutation'],acceptance_criteria:['deterministic checks pass'],evidence_requirements:['tests','execution evidence'],capabilities:seed.capabilities,risk:seed.risk,complexity:seed.complexity,base_sha:baseSha,max_attempts:1}})))}
export const DEFAULT_VALIDATION_SEEDS:CorpusSeed[]=[
{category:'backend',goal:'Implement a bounded backend change',capabilities:['coding','tests'],risk:'R1',complexity:'NORMAL'},
{category:'frontend',goal:'Implement a bounded frontend change',capabilities:['frontend','coding','tests'],risk:'R1',complexity:'NORMAL'},
{category:'debugging',goal:'Diagnose and fix a reproducible defect',capabilities:['debugging','tests'],risk:'R2',complexity:'HEAVY'},
{category:'review',goal:'Review a change against explicit acceptance criteria',capabilities:['review'],risk:'R2',complexity:'NORMAL'},
{category:'research',goal:'Produce evidence-backed technical research',capabilities:['research'],risk:'R1',complexity:'NORMAL'},
{category:'docs',goal:'Update technical documentation from verified implementation',capabilities:['documents'],risk:'R0',complexity:'LIGHT'}];
