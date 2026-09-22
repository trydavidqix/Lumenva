import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { readyNodes, validateDag } from './dag.mjs';
import { classifyRisk, retryPlan, selectRoute } from '../routing/router.mjs';
import { recordHistory } from '../history/store.mjs';

const terminal=new Set(['DONE','BLOCKED','CANCELLED','FAILED_FINAL']);
const now=()=>new Date().toISOString();
async function atomicJson(path,value){await mkdir(dirname(path),{recursive:true,mode:0o700});const tmp=`${path}.${process.pid}.tmp`;await writeFile(tmp,`${JSON.stringify(value,null,2)}\n`,{mode:0o600});await rename(tmp,path);}
function semanticKey(task){return createHash('sha256').update(JSON.stringify({project:task.project||null,type:task.type||null,objective:String(task.objective||'').trim().toLowerCase(),acceptance:task.acceptance||[]})).digest('hex');}
function leaseKey(taskId,nodeId){return `${taskId}:${nodeId}`;}

export class PersistentScheduler{
  constructor(root,{concurrency_limit=2,lease_ms=120_000,max_attempts=4}={}){
    if(!root)throw new Error('scheduler root required');this.root=root;this.concurrency_limit=Math.max(1,concurrency_limit);this.lease_ms=lease_ms;this.max_attempts=max_attempts;
    this.path=join(root,'state','scheduler','state.json');this.dlq=join(root,'state','scheduler','dead-letter.jsonl');
  }
  async state(){try{return JSON.parse(await readFile(this.path,'utf8'));}catch{return {version:1,tasks:{},leases:{},locks:{},retry_history:[],updated_at:null};}}
  async save(state){state.updated_at=now();await atomicJson(this.path,state);return state;}
  async cleanupExpired(state){
    const ts=Date.now();
    for(const [key,lease] of Object.entries(state.leases||{}))if(Date.parse(lease.expires_at)<=ts){delete state.leases[key];for(const [resource,owner] of Object.entries(state.locks||{}))if(owner===key)delete state.locks[resource];const task=state.tasks[lease.task_id],node=task?.nodes?.find(n=>n.node_id===lease.node_id);if(node?.status==='RUNNING')node.status='READY';}
    return state;
  }
  async submitTask(task={}){
    if(!task.task_id)throw new Error('task_id required');
    const nodes=(task.nodes||[{node_id:'main',depends_on:[],status:'PENDING',type:task.type||'NORMAL',capability:task.capability,objective:task.objective,write:task.write,risk:task.risk}]).map(node=>({...node,depends_on:node.depends_on||[],status:node.status||'PENDING',attempts:node.attempts||0,retry_history:node.retry_history||[]}));
    const dag=validateDag(nodes);if(!dag.valid)throw new Error(`invalid DAG: ${dag.error}`);
    const state=await this.cleanupExpired(await this.state());const key=semanticKey(task);const risk=classifyRisk(task);
    if(!['R3','R4'].includes(risk)){
      const duplicate=Object.values(state.tasks).find(item=>item.semantic_key===key&&!terminal.has(item.status));
      if(duplicate)return {deduped:true,task_id:duplicate.task_id,semantic_key:key};
    }
    if(state.tasks[task.task_id])throw new Error('task already exists');
    const record={...task,nodes,semantic_key:key,risk,status:'QUEUED',cancel_requested:false,created_at:now(),updated_at:now()};
    state.tasks[task.task_id]=record;this.refreshReadyInState(state,record);await this.save(state);await recordHistory(this.root,'tasks',{...record,source:'scheduler.submit',measurement_type:'exact'});
    return {deduped:false,task_id:task.task_id,semantic_key:key};
  }
  refreshReadyInState(state,task){
    if(terminal.has(task.status)||task.cancel_requested)return;
    const ready=new Set(readyNodes(task.nodes).map(n=>n.node_id));
    for(const node of task.nodes){if(ready.has(node.node_id)&&!['RUNNING','DONE','APPROVAL_REQUIRED'].includes(node.status))node.status='READY';}
    if(task.nodes.every(node=>node.status==='DONE'))task.status='DONE'; else if(task.nodes.some(node=>node.status==='RUNNING'))task.status='RUNNING'; else if(task.nodes.some(node=>node.status==='APPROVAL_REQUIRED'))task.status='APPROVAL_REQUIRED'; else task.status='QUEUED';
  }
  async cancelTask(task_id,reason='cancelled'){
    const state=await this.state(),task=state.tasks[task_id];if(!task)return null;task.cancel_requested=true;task.status='CANCELLED';task.cancel_reason=reason;task.updated_at=now();
    for(const node of task.nodes)if(!terminal.has(node.status))node.status='CANCELLED';
    for(const [key,lease] of Object.entries(state.leases))if(lease.task_id===task_id){delete state.leases[key];for(const [resource,owner] of Object.entries(state.locks))if(owner===key)delete state.locks[resource];}
    await this.save(state);await recordHistory(this.root,'tasks',{...task,source:'scheduler.cancel',measurement_type:'exact'});return task;
  }
  acquire(state,task,node,worker,resource){
    const key=leaseKey(task.task_id,node.node_id);const existing=state.leases[key];if(existing&&Date.parse(existing.expires_at)>Date.now())return null;
    if(resource&&state.locks[resource]&&state.locks[resource]!==key)return null;
    const lease={lease_id:`lease-${randomUUID()}`,task_id:task.task_id,node_id:node.node_id,worker,resource:resource||null,acquired_at:now(),expires_at:new Date(Date.now()+this.lease_ms).toISOString()};
    state.leases[key]=lease;if(resource)state.locks[resource]=key;return lease;
  }
  release(state,lease){const key=leaseKey(lease.task_id,lease.node_id);delete state.leases[key];if(lease.resource&&state.locks[lease.resource]===key)delete state.locks[lease.resource];}
  async deadLetter(state,task,node,reason){
    node.status='FAILED_FINAL';task.status='FAILED_FINAL';const row={task_id:task.task_id,node_id:node.node_id,attempts:node.attempts,reason,timestamp:now(),source:'scheduler.dlq'};
    await mkdir(dirname(this.dlq),{recursive:true,mode:0o700});await appendFile(this.dlq,`${JSON.stringify(row)}\n`,{mode:0o600});return row;
  }
  async runOnce({registry=[],execute,verify,approve,worktreeManager,worker_id='scheduler'}={}){
    if(typeof execute!=='function')throw new Error('execute callback required');
    const state=await this.cleanupExpired(await this.state());
    for(const task of Object.values(state.tasks))this.refreshReadyInState(state,task);
    let active=Object.keys(state.leases).length;const outcomes=[];
    outer: for(const task of Object.values(state.tasks)){
      if(active>=this.concurrency_limit)break;if(terminal.has(task.status)||task.cancel_requested)continue;
      for(const node of task.nodes.filter(n=>n.status==='READY')){
        if(active>=this.concurrency_limit)break outer;
        const route=selectRoute(node,registry);
        if(!route.selected){node.status='WAITING_RESOURCE';node.last_error='no healthy capability route';outcomes.push({task_id:task.task_id,node_id:node.node_id,status:node.status});continue;}
        if(route.owner_approval_required&&!node.approved){
          const approved=typeof approve==='function'?await approve({task,node,route}):false;
          if(!approved){node.status='APPROVAL_REQUIRED';task.status='APPROVAL_REQUIRED';outcomes.push({task_id:task.task_id,node_id:node.node_id,status:'APPROVAL_REQUIRED'});continue;}
          node.approved=true;node.approved_at=now();
        }
        const resource=node.resource_lock||route.selected.id;const lease=this.acquire(state,task,node,worker_id,resource);
        if(!lease){node.status='WAITING_RESOURCE';continue;}
        active+=1;node.status='RUNNING';task.status='RUNNING';node.attempts=(node.attempts||0)+1;node.route={selected:route.selected.id,risk:route.risk,reasoning:route.reasoning};
        let worktree=null;
        try{
          if(node.requires_worktree){if(!worktreeManager)throw new Error('worktree manager required');worktree=await worktreeManager.allocate({repo:node.repo||task.repo,base_commit:node.base_commit||task.base_commit||'HEAD',task_id:`${task.task_id}-${node.node_id}`,agent:route.selected.id});}
          const result=await execute({task,node,route,lease,worktree});
          const verification=typeof verify==='function'?await verify({task,node,route,result,worktree}):{pass:result?.success===true,evidence:result?.evidence||null};
          node.result=result??null;node.verification=verification;node.completed_at=now();
          if(verification?.pass===true){node.status='DONE';node.last_error=null;outcomes.push({task_id:task.task_id,node_id:node.node_id,status:'DONE'});}
          else throw new Error(verification?.reason||'verification failed');
        }catch(error){
          const reason=String(error?.message||error);node.last_error=reason;const retry=retryPlan(node.attempts+1,{reason,allow_fallback:node.allow_fallback});
          const history={task_id:task.task_id,node_id:node.node_id,attempt:node.attempts,reason,strategy:retry.strategy,timestamp:now()};node.retry_history.push(history);state.retry_history.push(history);
          if(node.attempts>=this.max_attempts||retry.strategy==='BLOCKED'){await this.deadLetter(state,task,node,reason);outcomes.push({task_id:task.task_id,node_id:node.node_id,status:'FAILED_FINAL',reason});}
          else{node.status='READY';outcomes.push({task_id:task.task_id,node_id:node.node_id,status:'RETRYING',strategy:retry.strategy});}
        }finally{this.release(state,lease);active-=1;}
        this.refreshReadyInState(state,task);task.updated_at=now();await recordHistory(this.root,'tasks',{task_id:task.task_id,status:task.status,node_id:node.node_id,node_status:node.status,source:'scheduler.run',measurement_type:'exact',provenance:{lease_id:lease.lease_id,route:node.route}});
      }
    }
    await this.save(state);return {outcomes,state};
  }
}
