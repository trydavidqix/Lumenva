import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const exec=promisify(execFile);
const safe=value=>String(value||'').replace(/[^A-Za-z0-9._/-]+/g,'-').replace(/^[-/]+|[-/]+$/g,'');
async function atomicJson(path,value){await mkdir(dirname(path),{recursive:true,mode:0o700});const tmp=`${path}.${process.pid}.tmp`;await writeFile(tmp,`${JSON.stringify(value,null,2)}\n`,{mode:0o600});await rename(tmp,path);}

export class GitWorktreeManager{
  constructor(root){if(!root)throw new Error('worktree manager root required');this.root=root;this.statePath=join(root,'state','worktrees','allocations.json');this.baseDir=join(root,'state','worktrees','trees');}
  async state(){try{return JSON.parse(await readFile(this.statePath,'utf8'));}catch{return {allocations:{}};}}
  async save(state){await atomicJson(this.statePath,state);return state;}
  async git(repo,args){const {stdout='',stderr=''}=await exec('git',['-C',repo,...args],{windowsHide:true,maxBuffer:4*1024*1024});return {stdout,stderr};}
  async allocate({repo,base_commit='HEAD',task_id,agent=null,branch=null}={}){
    if(!repo||!task_id)throw new Error('repo and task_id are required');
    const state=await this.state();if(state.allocations[task_id])return state.allocations[task_id];
    const task=safe(task_id);if(!task)throw new Error('invalid task_id');
    const branchName=branch||`lumenva/task-${task}`;if(!/^[A-Za-z0-9._/-]+$/.test(branchName))throw new Error('invalid branch');
    const path=resolve(this.baseDir,task);await mkdir(dirname(path),{recursive:true,mode:0o700});
    const base=(await this.git(repo,['rev-parse',base_commit])).stdout.trim();
    await this.git(repo,['worktree','add','-b',branchName,path,base]);
    const allocation={repo:resolve(repo),base_commit:base,branch:branchName,worktree:path,task:task_id,agent,diff:null,tests:[],created_at:new Date().toISOString(),released_at:null,merged:false};
    state.allocations[task_id]=allocation;await this.save(state);return allocation;
  }
  async inspect(task_id){
    const state=await this.state(),allocation=state.allocations[task_id];if(!allocation)return null;
    const status=(await this.git(allocation.worktree,['status','--porcelain'])).stdout;
    const diff=(await this.git(allocation.worktree,['diff','--stat'])).stdout;
    return {...allocation,status,diff};
  }
  async recordTests(task_id,tests=[]){const state=await this.state(),allocation=state.allocations[task_id];if(!allocation)throw new Error('allocation not found');allocation.tests=tests;await this.save(state);return allocation;}
  async release(task_id,{force=false}={}){
    const state=await this.state(),allocation=state.allocations[task_id];if(!allocation)return null;
    const args=['worktree','remove'];if(force)args.push('--force');args.push(allocation.worktree);
    await this.git(allocation.repo,args);
    allocation.released_at=new Date().toISOString();state.allocations[task_id]=allocation;await this.save(state);
    await rm(allocation.worktree,{recursive:true,force:true}).catch(()=>{});
    return allocation;
  }
}
