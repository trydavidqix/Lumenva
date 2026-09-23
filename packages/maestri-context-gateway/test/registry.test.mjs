import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { recordTelemetry } from '../src/telemetry.mjs';
import { REGISTRY_TYPES, refreshRegistries, validateRegistryEntry } from '../src/registry.mjs';
const root=await mkdtemp(join(tmpdir(),'mcg-registry-'));
try{
 await recordTelemetry(root,{agent:'Codex CTO',runtime:'Codex CLI',tool:'git.status',plugin:'caveman',mcp:'Maestri Wire',model:'observed-model-1',operation:'test',total_tokens:12,input_tokens:10,output_tokens:2,measurement_type:'exact',source:'registry.test'});
 await recordTelemetry(root,{agent:'Codex CTO',runtime:'Codex CLI',tool:'git.status',plugin:'caveman',mcp:'Maestri Wire',model:'observed-model-1',operation:'test',outcome:'success',latency_ms:30,measurement_type:'unavailable',source:'registry.test'});
 await recordTelemetry(root,{agent:'Codex CTO',runtime:'Codex CLI',tool:'git.status',plugin:'caveman',mcp:'Maestri Wire',model:'observed-model-1',operation:'test',outcome:'failure',latency_ms:50,measurement_type:'unavailable',source:'registry.test'});
 const registries=await refreshRegistries(root,{include_processes:false});
 for(const type of REGISTRY_TYPES){assert.ok(registries[type].length>0,`${type} must not be empty`);for(const row of registries[type])assert.equal(validateRegistryEntry(type,row).valid,true,`${type}:${row.id}`);}
 assert.equal(registries.models.some(row=>row.name==='observed-model-1'&&row.health==='OBSERVED'),true);
 const codex=registries.agents.find(row=>row.name==='Codex CTO');assert.equal(codex.health,'OBSERVED');assert.equal(codex.measurement_type,'exact');assert.equal(codex.usage.tokens,12);assert.equal(codex.usage.calls,3);assert.equal(codex.success_rate,50);assert.equal(codex.failure_rate,50);assert.equal(codex.latency,40);
}finally{await rm(root,{recursive:true,force:true});}
console.log('registry tests: 1 passed');
