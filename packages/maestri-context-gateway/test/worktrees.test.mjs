import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GitWorktreeManager } from '../src/worktrees.mjs';
const exec=promisify(execFile),root=await mkdtemp(join(tmpdir(),'mcg-worktree-')),repo=join(root,'repo');
try{
 await exec('git',['init',repo]);await exec('git',['-C',repo,'config','user.email','ci@example.invalid']);await exec('git',['-C',repo,'config','user.name','MCG CI']);
 await writeFile(join(repo,'README.md'),'base\n');await exec('git',['-C',repo,'add','README.md']);await exec('git',['-C',repo,'commit','-m','base']);
 const manager=new GitWorktreeManager(root),allocation=await manager.allocate({repo,task_id:'task-1',agent:'codex'});
 assert.equal(allocation.merged,false);await writeFile(join(allocation.worktree,'change.txt'),'x\n');
 const inspected=await manager.inspect('task-1');assert.match(inspected.status,/change\.txt/);
 await manager.recordTests('task-1',[{name:'unit',status:'PASS'}]);assert.equal((await manager.state()).allocations['task-1'].tests[0].status,'PASS');
 await manager.release('task-1',{force:true});assert.ok((await manager.state()).allocations['task-1'].released_at);
}finally{await rm(root,{recursive:true,force:true});}
console.log('worktree tests: 1 passed');
