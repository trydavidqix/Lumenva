import test from 'node:test'; import assert from 'node:assert/strict';
import { AgentRuntime, createCoreBridge, EventBus, LumenvaCore, TelemetryStore, TerminalRuntime } from '../src/index.ts';
class P {pid=1; onData(){return{dispose(){}}} onExit(){return{dispose(){}}} write(){} resize(){} kill(){}}
test('typed bridge exposes core state without renderer shell access',async()=>{const core=new LumenvaCore(); await core.start(); const terminals=new TerminalRuntime(core.events,{spawn:()=>new P()}); const agents=new AgentRuntime(core.events,terminals); const telemetry=new TelemetryStore(core.events); const bridge=createCoreBridge(core,agents,terminals,telemetry); assert.equal(bridge.health().status,'READY'); assert.equal(bridge.agents().length,6);});
