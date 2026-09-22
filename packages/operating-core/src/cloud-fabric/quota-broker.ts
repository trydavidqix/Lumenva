import type { ExecutionPort,QuotaSnapshot } from './execution-port';
import { quotaState,type QuotaState } from './quota-router';
export interface BrokerEntry{provider:string;snapshot:QuotaSnapshot;state:QuotaState}
export class QuotaBroker{constructor(private readonly ports:ExecutionPort[]){}
async snapshot():Promise<BrokerEntry[]>{return Promise.all(this.ports.map(async port=>{try{const snapshot=await port.checkQuota();return{provider:port.name,snapshot,state:quotaState(snapshot)}}catch{return{provider:port.name,snapshot:{provider:port.name,tokens_used:0,cost_usd:0,health:'unavailable',measurement_type:'unavailable'} as QuotaSnapshot,state:'UNKNOWN' as QuotaState}}}))}
async states():Promise<Record<string,QuotaState>>{return Object.fromEntries((await this.snapshot()).map(x=>[x.provider,x.state]))}}
