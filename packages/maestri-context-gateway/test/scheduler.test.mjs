import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PersistentScheduler } from '../src/scheduler/scheduler.mjs';
import { PersistentCircuitBreaker, selectRoute } from '../src/routing/router.mjs';

const root=await mkdtemp(join(tmpdir(),'mcg-scheduler-'));
try{
 const registry=[{id:'codex',name:'Codex',capabilities:['code'],health:'OBSERVED',success_rate:99,latency:10,measurement_type:'exact'}];
 const scheduler=new PersistentScheduler(root,{concurrency_limit:1,max_attempts:2,lease_ms:1000});
 await scheduler.submitTask({task_id:'t1',objective:'build',nodes:[
  {node_id:'a',depends_on:[],capability:'code',type:'LIGHT',status:'PENDING'},
  {node_id:'b',depends_on:['a'],capability:'code',type:'NORMAL',status:'PENDING'}
 ]});
 const duplicate=await scheduler.submitTask({task_id:'t2',objective:'build',nodes:[{node_id:'x',depends_on:[],capability:'code'}]});
 assert.equal(duplicate.deduped,true);
 let calls=0;
 let run=await scheduler.runOnce({registry,execute:async()=>({success:true}),verify:async()=>({pass:true}),worker_id:'w1'});
 assert.equal(run.outcomes[0].status,'DONE');calls+=run.outcomes.length;
 run=await scheduler.runOnce({registry,execute:async()=>({success:true}),verify:async()=>({pass:true}),worker_id:'w1'});
 assert.equal(run.state.tasks.t1.status,'DONE');assert.equal(calls+run.outcomes.length,2);
 await scheduler.submitTask({task_id:'r3',objective:'infra',infra:true,nodes:[{node_id:'main',depends_on:[],capability:'code',infra:true}]});
 run=await scheduler.runOnce({registry,execute:async()=>({success:true}),verify:async()=>({pass:true})});
 assert.equal(run.state.tasks.r3.status,'APPROVAL_REQUIRED');
 await scheduler.cancelTask('r3','owner cancelled');assert.equal((await scheduler.state()).tasks.r3.status,'CANCELLED');
 await scheduler.submitTask({task_id:'fail',objective:'fail once unique',nodes:[{node_id:'main',depends_on:[],capability:'code'}]});
 await scheduler.runOnce({registry,execute:async()=>{throw new Error('boom')},verify:async()=>({pass:false})});
 run=await scheduler.runOnce({registry,execute:async()=>{throw new Error('boom')},verify:async()=>({pass:false})});
 assert.equal(run.state.tasks.fail.status,'FAILED_FINAL');
 const breaker=new PersistentCircuitBreaker(root,'codex',{threshold:2,cooldown_ms:60000});
 await breaker.failure('x');await breaker.failure('x');assert.equal(await breaker.allow(),false);
 const breaker2=new PersistentCircuitBreaker(root,'codex',{threshold:2,cooldown_ms:60000});assert.equal((await breaker2.state()).status,'CIRCUIT_OPEN');
 assert.equal(selectRoute({capability:'code'},[{id:'offline',capabilities:['code'],health:'UNAVAILABLE'}]).selected,null);
}finally{await rm(root,{recursive:true,force:true});}
console.log('scheduler/reliability tests: 1 passed');
