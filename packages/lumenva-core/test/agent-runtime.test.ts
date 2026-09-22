import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentRuntime, EventBus, TerminalRuntime, DEFAULT_AGENT_MANIFESTS } from '../src/index.ts';

class FakePty { pid=7; writes:string[]=[]; onData(){return{dispose(){}}} onExit(){return{dispose(){}}} write(v:string){this.writes.push(v)} resize(){} kill(){} }

test('ships all required agent manifests',()=>{ assert.deepEqual(DEFAULT_AGENT_MANIFESTS.map(x=>x.id),['claude-ceo','codex-cto','codex-reviewer','codex-tester','codex-mcg','antigravity-cio']); });

test('agent runtime owns terminal lifecycle instead of UI',async()=>{
 const bus=new EventBus(); const pty=new FakePty(); const terminals=new TerminalRuntime(bus,{spawn:()=>pty}); const runtime=new AgentRuntime(bus,terminals);
 const agent=await runtime.start('codex-cto','C:\\repo','implement gate','trace-agent');
 assert.equal(agent.status,'RUNNING'); assert.ok(agent.terminalId); assert.equal(agent.workspace,'C:\\repo');
 runtime.write('codex-cto','status\r'); assert.deepEqual(pty.writes,['status\r']);
 await runtime.stop('codex-cto'); assert.equal(runtime.get('codex-cto')?.status,'STOPPED');
});
