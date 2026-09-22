import test from 'node:test'; import assert from 'node:assert/strict';
import { EventBus, MemoryStateStorage, TelemetryStore } from '../src/index.ts';
test('state storage round trips JSON',async()=>{const s=new MemoryStateStorage(); await s.set('agent',{status:'RUNNING'}); assert.deepEqual(await s.get('agent'),{status:'RUNNING'}); await s.delete('agent'); assert.equal(await s.get('agent'),null);});
test('telemetry carries provenance and emits event',async()=>{const bus=new EventBus(); const seen:string[]=[]; bus.on('*',e=>{ seen.push(e.type); }); const t=new TelemetryStore(bus); await t.observe({name:'agent.duration',value:12,unit:'ms',source:'agent-runtime',provenance:'runtime'}); assert.equal(t.list()[0]?.provenance,'runtime'); assert.deepEqual(seen,['telemetry.observed']);});
