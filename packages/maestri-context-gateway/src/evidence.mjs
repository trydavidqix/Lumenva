import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { assertContract } from './contracts.mjs';
import { recordHistory } from './history/store.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex');
const now=()=>new Date().toISOString();

export async function saveArtifact(root,input={}){
  const content=input.content==null?null:String(input.content);
  const artifact_id=input.artifact_id||`artifact-${randomUUID()}`;
  const row={
    artifact_id,task_id:input.task_id||null,trace_id:input.trace_id||null,
    type:input.type||'evidence-bundle',path:input.path||null,
    hash:input.hash||(content==null?null:sha(content)),
    created_at:input.created_at||now(),source:input.source||'mcg.evidence',
    measurement_type:input.measurement_type||(content!=null||input.hash?'exact':'unavailable'),
    provenance:input.provenance||{source:input.source||'mcg.evidence'}
  };
  assertContract('artifact',row);
  await mkdir(join(root,'state','artifacts'),{recursive:true,mode:0o700});
  await writeFile(join(root,'state','artifacts',`${artifact_id}.json`),`${JSON.stringify({...row,content:content==null?undefined:content},null,2)}\n`,{mode:0o600});
  return row;
}

export async function linkClaimEvidence(root,input,evidenceLegacy=[]){
  let row;
  if(typeof input==='string'){
    row={
      edge_id:`edge-${randomUUID()}`,claim_id:`claim-${sha(input).slice(0,16)}`,claim:input,
      evidence:evidenceLegacy.map(value=>({evidence_id:String(value),source:'legacy',artifact_id:String(value).startsWith('artifact://')?String(value).slice(11):null})),
      task_id:null,trace_id:null,timestamp:now(),source:'mcg.evidence.graph'
    };
  }else{
    const evidence=Array.isArray(input.evidence)?input.evidence:[];
    row={
      edge_id:input.edge_id||`edge-${randomUUID()}`,
      claim_id:input.claim_id||`claim-${randomUUID()}`,
      claim:String(input.claim||''),
      evidence:evidence.map(item=>({
        evidence_id:item.evidence_id||item.id||`evidence-${randomUUID()}`,
        source:item.source||input.source||'unknown',
        artifact_id:item.artifact_id||null,
        task_id:item.task_id||input.task_id||null,
        trace_id:item.trace_id||input.trace_id||null,
        assertion:item.assertion||null
      })),
      task_id:input.task_id||null,trace_id:input.trace_id||null,timestamp:input.timestamp||now(),source:input.source||'mcg.evidence.graph'
    };
  }
  await mkdir(join(root,'state','evidence'),{recursive:true,mode:0o700});
  await appendFile(join(root,'state','evidence','graph.jsonl'),`${JSON.stringify(row)}\n`,{mode:0o600});
  return row;
}
export const linkEvidence=linkClaimEvidence;

export function confidenceFromSignals({
  tests=null,typecheck=null,evidence_coverage=null,verifier=null,unresolved=[]
}={}){
  const signals=[];
  const push=(name,value,weight,source)=>{
    if(value===true)signals.push({name,value:100,weight,source});
    else if(value===false)signals.push({name,value:0,weight,source});
    else if(Number.isFinite(value))signals.push({name,value:Math.max(0,Math.min(100,value)),weight,source});
  };
  push('tests',tests,0.35,'test results');
  push('typecheck',typecheck,0.20,'typecheck result');
  push('evidence',evidence_coverage,0.25,'evidence coverage');
  push('verifier',verifier,0.20,'independent verifier');
  if(!signals.length)return {confidence:null,status:'UNAVAILABLE',signals:[],unresolved:[...unresolved],source:'objective validation signals',measurement_type:'unavailable',timestamp:now()};
  const weight=signals.reduce((sum,item)=>sum+item.weight,0);
  let score=signals.reduce((sum,item)=>sum+item.value*item.weight,0)/weight;
  const penalty=Math.min(25,(unresolved?.length||0)*5);score=Math.max(0,score-penalty);
  return {
    confidence:Number(score.toFixed(2)),status:'MEASURED',signals,unresolved:[...(unresolved||[])],penalty,
    source:'0.35 tests + 0.20 typecheck + 0.25 evidence coverage + 0.20 verifier - unresolved penalty',
    measurement_type:'estimated',timestamp:now()
  };
}

export function progressFromCriteria(criteria=[],signals={}){
  const total=criteria.length;
  const passed=criteria.filter(item=>String(item.status||'').toUpperCase()==='PASS').length;
  const blocked=criteria.filter(item=>['BLOCKED','FAIL'].includes(String(item.status||'').toUpperCase())).length;
  const supported=criteria.filter(item=>Array.isArray(item.evidence)?item.evidence.length>0:Boolean(item.evidence)).length;
  const unresolved=criteria.filter(item=>String(item.status||'').toUpperCase()!=='PASS').map(item=>item.id||item.name||'unresolved');
  const progress_percent=total?Number((passed/total*100).toFixed(2)):0;
  const evidence_coverage=total?Number((supported/total*100).toFixed(2)):null;
  const confidence=confidenceFromSignals({...signals,evidence_coverage,unresolved:[...(signals.unresolved||[]),...unresolved]});
  return {
    criteria_total:total,criteria_passed:passed,criteria_blocked:blocked,
    progress_percent,evidence_coverage,evidence_coverage_percent:evidence_coverage,
    confidence:confidence.confidence,confidence_status:confidence.status,confidence_detail:confidence,
    unresolved,source:'acceptance criteria + evidence + objective validation signals',
    measurement_type:total?'exact':'unavailable',timestamp:now()
  };
}

export async function evidenceGraph(root,{task_id,trace_id,claim_id}={}){
  try{
    const rows=(await readFile(join(root,'state','evidence','graph.jsonl'),'utf8')).split('\n').filter(Boolean).map(JSON.parse);
    return rows.filter(row=>(!task_id||row.task_id===task_id)&&(!trace_id||row.trace_id===trace_id)&&(!claim_id||row.claim_id===claim_id));
  }catch{return [];}
}

export function buildExecutiveBrief({
  goal,status='INCOMPLETE',criteria=[],signals={},risks=[],decision_required=[],evidence=[],next_recommended_action=null
}={}){
  const metrics=progressFromCriteria(criteria,signals);
  return {
    brief_id:`brief-${randomUUID()}`,
    Goal:goal||'',
    Status:status,
    Completed:criteria.filter(item=>String(item.status||'').toUpperCase()==='PASS').map(item=>item.id||item.name),
    Blocked:criteria.filter(item=>['BLOCKED','FAIL'].includes(String(item.status||'').toUpperCase())).map(item=>item.id||item.name),
    Risks:risks,
    'Decision Required':decision_required,
    Evidence:evidence,
    'Next Recommended Action':next_recommended_action,
    progress:metrics.progress_percent,
    evidence_coverage:metrics.evidence_coverage,
    confidence:metrics.confidence,
    confidence_status:metrics.confidence_status,
    delivery_status:'unavailable',
    delivery_proof:null,
    source:'mcg.executive-brief',
    measurement_type:'exact',
    timestamp:now()
  };
}

export async function saveExecutiveBrief(root,brief){
  await mkdir(join(root,'state','briefs'),{recursive:true,mode:0o700});
  await writeFile(join(root,'state','briefs',`${brief.brief_id}.json`),`${JSON.stringify(brief,null,2)}\n`,{mode:0o600});
  return brief;
}
export async function recordBriefDelivery(root,brief_id,{status,proof}={}){
  if(!['queued','delivered','acknowledged','unavailable'].includes(status))throw new Error('invalid delivery status');
  if(['delivered','acknowledged'].includes(status)&&!proof)throw new Error('delivery proof required');
  const path=join(root,'state','briefs',`${brief_id}.json`);
  const brief=JSON.parse(await readFile(path,'utf8'));
  const updated={...brief,delivery_status:status,delivery_proof:proof||null,delivered_at:status==='delivered'||status==='acknowledged'?now():null};
  await writeFile(path,`${JSON.stringify(updated,null,2)}\n`,{mode:0o600});
  await recordHistory(root,'alerts',{alert_id:`brief-${brief_id}`,created_at:updated.timestamp,delivery_status:status,source:'mcg.executive-brief',measurement_type:'exact',proof:proof||null});
  return updated;
}
export async function loadArtifact(root,artifact_id){try{return JSON.parse(await readFile(join(root,'state','artifacts',`${artifact_id}.json`),'utf8'));}catch{return null;}}
