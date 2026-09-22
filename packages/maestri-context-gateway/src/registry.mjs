import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { telemetryEvents, discoverLocalProcesses } from './telemetry.mjs';
import { validateContract } from './contracts.mjs';

export const REGISTRY_TYPES=Object.freeze(['agents','tools','plugins','mcps','runtimes','models']);
const SET=new Set(REGISTRY_TYPES);
const STATIC=join(dirname(fileURLToPath(import.meta.url)),'..','registry');
const contractFor={agents:'agent',tools:'tool',plugins:'plugin',mcps:'mcp',runtimes:'runtime'};
const slug=value=>String(value||'unknown').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'unknown';
async function readJson(path,fallback=[]){try{return JSON.parse(await readFile(path,'utf8'));}catch{return fallback;}}
function base({id,name,source,measurement_type='unavailable',last_seen=null,capabilities=[]}){return {id,name,version:null,capabilities,health:last_seen?'OBSERVED':'UNAVAILABLE',last_seen,success_rate:null,failure_rate:null,latency:null,usage:null,measurement_type,source};}
function observed(events){
  const groups=Object.fromEntries(REGISTRY_TYPES.map(type=>[type,new Map()]));
  const add=(type,key,row)=>{
    if(!key)return;
    const current=groups[type].get(key)||base({id:slug(`${type}-${key}`),name:key,source:row.source||'state/telemetry/events.jsonl',measurement_type:row.measurement_type||'unavailable',last_seen:row.timestamp});
    current.last_seen=[current.last_seen,row.timestamp].filter(Boolean).sort().at(-1)||null;
    if(row.measurement_type==='exact')current.measurement_type='exact'; else if(current.measurement_type!=='exact'&&row.measurement_type==='estimated')current.measurement_type='estimated';
    const tokens=Number.isFinite(row.total_tokens)?row.total_tokens:Number.isFinite(row.estimated_tokens)?row.estimated_tokens:null;
    current.usage ||= {calls:0,tokens:0,token_rows:0};current.usage.calls+=1;if(tokens!=null){current.usage.tokens+=tokens;current.usage.token_rows+=1;}
    current.health='OBSERVED';groups[type].set(key,current);
  };
  for(const event of events){add('agents',event.agent,event);add('tools',event.tool,event);add('plugins',event.plugin,event);add('mcps',event.mcp,event);add('runtimes',event.runtime,event);add('models',event.model,event);}
  return groups;
}
function specialize(type,row){
  if(type==='agents')return {...row,status:row.status|| (row.health==='OBSERVED'?'WORKING':'UNAVAILABLE'),role:row.role??null,runtime:row.runtime??null};
  if(type==='runtimes')return {...row,runtime:row.runtime||row.name};
  if(type==='tools')return {...row,tool_name:row.tool_name||row.name};
  if(type==='plugins')return {...row,plugin_id:row.plugin_id||row.id};
  if(type==='mcps')return {...row,mcp_name:row.mcp_name||row.name};
  return row;
}
function merge(staticRows,observedRows,type){
  const byId=new Map(staticRows.map(item=>[item.id,specialize(type,item)]));
  for(const row of observedRows.values()){
    const match=[...byId.values()].find(item=>item.name===row.name||item.runtime===row.name||item.tool_name===row.name||item.plugin_id===row.name||item.mcp_name===row.name);
    if(match)byId.set(match.id,specialize(type,{...match,health:row.health,last_seen:row.last_seen,usage:row.usage,measurement_type:row.measurement_type,observed_source:row.source}));
    else byId.set(row.id,specialize(type,row));
  }
  return [...byId.values()].sort((a,b)=>String(a.name).localeCompare(String(b.name)));
}
export function validateRegistryEntry(type,entry){
  if(!SET.has(type))return {valid:false,errors:[`unknown registry type: ${type}`]};
  const errors=[];for(const field of ['id','name','capabilities','health','measurement_type','source'])if(entry[field]===undefined||entry[field]===null||entry[field]==='')errors.push(`missing ${field}`);
  if(!Array.isArray(entry.capabilities))errors.push('capabilities must be array');
  const contract=contractFor[type]?validateContract(contractFor[type],specialize(type,entry)):{valid:true,errors:[]};
  return {valid:errors.length===0&&contract.valid,errors:[...errors,...contract.errors]};
}
export async function refreshRegistries(root,{include_processes=true}={}){
  const [events,processes]=await Promise.all([telemetryEvents(root,{includeExpired:true}),include_processes?discoverLocalProcesses():Promise.resolve([])]);
  const seen=observed(events);
  for(const process of processes){
    seen.agents.set(process.name,{...base({id:slug(`agents-${process.name}`),name:process.name,source:process.source,measurement_type:process.measurement_type,last_seen:process.last_seen}),status:process.status,role:process.role,runtime:process.runtime});
    seen.runtimes.set(process.runtime,{...base({id:slug(`runtimes-${process.runtime}`),name:process.runtime,source:process.source,measurement_type:process.measurement_type,last_seen:process.last_seen}),runtime:process.runtime});
  }
  const result={};await mkdir(join(root,'state','registry'),{recursive:true,mode:0o700});
  for(const type of REGISTRY_TYPES){
    const rows=merge(await readJson(join(STATIC,`${type}.json`),[]),seen[type],type);
    for(const row of rows){const v=validateRegistryEntry(type,row);if(!v.valid)throw new Error(`${type} registry invalid for ${row.id}: ${v.errors.join(', ')}`);}
    await writeFile(join(root,'state','registry',`${type}.json`),`${JSON.stringify(rows,null,2)}\n`,{mode:0o600});result[type]=rows;
  }
  return result;
}
export async function loadRegistry(root,type,{refresh=true}={}){if(!SET.has(type))throw new Error(`unknown registry type: ${type}`);return refresh?(await refreshRegistries(root))[type]:readJson(join(root,'state','registry',`${type}.json`),[]);}
