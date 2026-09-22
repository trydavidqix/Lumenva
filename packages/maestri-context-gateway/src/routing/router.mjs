import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const rank={TINY:0,LIGHT:1,NORMAL:2,HEAVY:3,EXCLUSIVE:4,CRITICAL:5};
const unavailable=new Set(['UNAVAILABLE','OFFLINE','CIRCUIT_OPEN','FAILED']);

export function classifyRisk(input={}){
  if(Number.isFinite(input.risk)) return `R${Math.max(0,Math.min(4,input.risk))}`;
  if(input.production||input.secrets||input.delete) return 'R4';
  if(input.infra||input.database||input.auth) return 'R3';
  if(input.config||input.dependencies) return 'R2';
  if(input.write) return 'R1';
  return 'R0';
}
export function selectRoute(job={},registry=[]){
  const type=String(job.type||job.complexity||'NORMAL').toUpperCase();
  const risk=classifyRisk(job);
  const candidates=registry
    .filter(item=>!unavailable.has(String(item.health||'UNAVAILABLE').toUpperCase()))
    .filter(item=>!job.capability||item.capabilities?.includes(job.capability))
    .sort((a,b)=>(b.success_rate??-1)-(a.success_rate??-1)||(a.latency??Infinity)-(b.latency??Infinity));
  const selected=candidates[0]||null;
  return {
    type,risk,
    reasoning:rank[type]>=rank.HEAVY||risk==='R3'||risk==='R4'?'high':rank[type]<=rank.LIGHT?'low':'medium',
    selected,
    owner_approval_required:['R3','R4'].includes(risk),
    source:'capability registry + risk policy',
    measurement_type:selected?.measurement_type||'unavailable',
    timestamp:new Date().toISOString()
  };
}
export function retryPlan(attempt,context={}){
  if(attempt<=1)return {attempt:1,strategy:'normal'};
  if(attempt===2)return {attempt,strategy:'smaller-context',reason:context.reason||'retry'};
  if(attempt===3)return {attempt,strategy:'alternate-tool',reason:context.reason||'retry'};
  if(attempt===4&&context.allow_fallback!==false)return {attempt,strategy:'alternate-executor',reason:context.reason||'retry'};
  return {attempt,strategy:'BLOCKED',reason:'retry limit reached'};
}

export class CircuitBreaker{
  constructor({threshold=3,cooldown_ms=60_000}={}){this.threshold=threshold;this.cooldown_ms=cooldown_ms;this.failures=0;this.opened_at=null;this.reason=null;}
  allow(){if(!this.opened_at)return true;if(Date.now()-this.opened_at>=this.cooldown_ms){this.opened_at=null;this.failures=0;return true;}return false;}
  failure(reason='failure'){this.failures+=1;this.reason=reason;if(this.failures>=this.threshold)this.opened_at=Date.now();return this.state();}
  success(){this.failures=0;this.opened_at=null;this.reason=null;return this.state();}
  state(){return {status:this.opened_at?'CIRCUIT_OPEN':'CLOSED',failures:this.failures,opened_at:this.opened_at?new Date(this.opened_at).toISOString():null,reason:this.reason,retry_after:this.opened_at?new Date(this.opened_at+this.cooldown_ms).toISOString():null};}
}

async function atomicJson(path,value){
  await mkdir(dirname(path),{recursive:true,mode:0o700});
  const tmp=`${path}.${process.pid}.tmp`;await writeFile(tmp,`${JSON.stringify(value,null,2)}\n`,{mode:0o600});await rename(tmp,path);
}
export class PersistentCircuitBreaker{
  constructor(root,id,{threshold=3,cooldown_ms=60_000}={}){
    if(!root||!id)throw new Error('root and circuit id are required');
    this.root=root;this.id=String(id).replace(/[^A-Za-z0-9._-]+/g,'-');this.threshold=threshold;this.cooldown_ms=cooldown_ms;
    this.path=join(root,'state','reliability','circuits',`${this.id}.json`);
  }
  async load(){try{return JSON.parse(await readFile(this.path,'utf8'));}catch{return {id:this.id,status:'CLOSED',failures:0,opened_at:null,reason:null,retry_after:null,updated_at:null};}}
  async save(state){const next={...state,id:this.id,updated_at:new Date().toISOString()};await atomicJson(this.path,next);return next;}
  async allow(){
    const state=await this.load();
    if(state.status!=='CIRCUIT_OPEN')return true;
    const opened=Date.parse(state.opened_at);
    if(Number.isFinite(opened)&&Date.now()-opened>=this.cooldown_ms){await this.save({...state,status:'CLOSED',failures:0,opened_at:null,reason:null,retry_after:null});return true;}
    return false;
  }
  async failure(reason='failure'){
    const state=await this.load();const failures=(state.failures||0)+1;const open=failures>=this.threshold;const now=Date.now();
    return this.save({...state,status:open?'CIRCUIT_OPEN':'CLOSED',failures,reason,opened_at:open?new Date(now).toISOString():null,retry_after:open?new Date(now+this.cooldown_ms).toISOString():null});
  }
  async success(){const state=await this.load();return this.save({...state,status:'CLOSED',failures:0,opened_at:null,reason:null,retry_after:null});}
  async state(){return this.load();}
}
