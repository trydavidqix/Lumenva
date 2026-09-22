import type { TaskContract } from './execution-port';
import type { ContextSource } from '../context/context-engine';
import { MemoryRetriever } from './memory-retriever';
import { LazyToolRegistry } from './tool-registry';
export interface ContextResolution{sources:ContextSource[];allowed_tools:string[];provenance:string[]}
export class ContextResolver{constructor(private readonly memory:MemoryRetriever,private readonly tools:LazyToolRegistry){}
resolve(contract:TaskContract,opts:{memory_tags?:string[];memory_budget?:number;tool_budget?:number}={}):ContextResolution{
 const memories=this.memory.retrieve({tags:opts.memory_tags??contract.capabilities??[],token_budget:opts.memory_budget??1000,require_validated:true});
 const tools=this.tools.resolve(contract.capabilities??[],opts.tool_budget??1000);
 return{sources:memories.map(m=>({id:m.id,kind:'memory',source:m.provenance,reason:'validated_relevant_memory',content:m.text,token_estimate:m.token_estimate,priority:5})),allowed_tools:tools.map(t=>t.id),provenance:memories.map(m=>m.provenance)};
}}
