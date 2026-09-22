import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
 buildExecutiveBrief, confidenceFromSignals, evidenceGraph, linkEvidence, loadArtifact,
 progressFromCriteria, recordBriefDelivery, saveArtifact, saveExecutiveBrief
} from '../src/evidence.mjs';

const root=await mkdtemp(join(tmpdir(),'mcg-evidence-'));
try{
 const artifact=await saveArtifact(root,{task_id:'t1',trace_id:'tr1',type:'test-result',content:'PASS'});
 assert.equal((await loadArtifact(root,artifact.artifact_id)).hash.length,64);
 const edge=await linkEvidence(root,{claim_id:'c1',claim:'task completed',task_id:'t1',trace_id:'tr1',evidence:[{evidence_id:'e1',source:'unit-test',artifact_id:artifact.artifact_id,task_id:'t1',trace_id:'tr1'}]});
 assert.equal(edge.evidence[0].artifact_id,artifact.artifact_id);
 assert.equal((await evidenceGraph(root,{task_id:'t1'})).length,1);
 const progress=progressFromCriteria([
  {id:'a',status:'PASS',evidence:[artifact.artifact_id]},
  {id:'b',status:'BLOCKED',evidence:[]}
 ],{tests:true,typecheck:true,verifier:100});
 assert.equal(progress.progress_percent,50);assert.equal(progress.criteria_blocked,1);assert.equal(progress.evidence_coverage,50);
 assert.notEqual(progress.confidence,progress.progress_percent);
 const confidence=confidenceFromSignals({tests:100,typecheck:100,evidence_coverage:100,verifier:100,unresolved:[]});
 assert.equal(confidence.confidence,100);
 const brief=buildExecutiveBrief({goal:'ship',status:'VALIDATING',criteria:[{id:'a',status:'PASS',evidence:['e1']}],signals:{tests:true,typecheck:true,verifier:100},evidence:[artifact.artifact_id]});
 assert.equal(brief.delivery_status,'unavailable');await saveExecutiveBrief(root,brief);
 await assert.rejects(()=>recordBriefDelivery(root,brief.brief_id,{status:'delivered'}),/proof required/);
 const delivered=await recordBriefDelivery(root,brief.brief_id,{status:'delivered',proof:{channel:'test',receipt:'1'}});
 assert.equal(delivered.delivery_status,'delivered');
}finally{await rm(root,{recursive:true,force:true});}
console.log('evidence tests: 1 passed');
