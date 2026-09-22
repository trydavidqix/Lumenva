import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TYPES=['task','event','trace','telemetry','agent','runtime','tool','plugin','mcp','alert','eval','artifact'];
const SET=new Set(TYPES);
const DIR=join(dirname(fileURLToPath(import.meta.url)),'..','contracts');
const SCHEMAS=Object.fromEntries(TYPES.map(type=>[type,JSON.parse(readFileSync(join(DIR,`${type}.v1.schema.json`),'utf8'))]));

function matches(value,type){
  if(type==='null') return value===null;
  if(type==='array') return Array.isArray(value);
  if(type==='object') return value!==null&&typeof value==='object'&&!Array.isArray(value);
  if(type==='integer') return Number.isInteger(value);
  if(type==='number') return Number.isFinite(value);
  return typeof value===type;
}
function check(schema,value,path,errors){
  if(!schema||typeof schema!=='object') return;
  if(Array.isArray(schema.anyOf)){
    if(!schema.anyOf.some(option=>{const local=[];check(option,value,path,local);return local.length===0;})) errors.push(`${path}: no anyOf schema matched`);
    return;
  }
  if(schema.const!==undefined&&value!==schema.const) errors.push(`${path}: const mismatch`);
  if(Array.isArray(schema.enum)&&!schema.enum.includes(value)) errors.push(`${path}: value is not in enum`);
  if(schema.type!==undefined){
    const expected=Array.isArray(schema.type)?schema.type:[schema.type];
    if(!expected.some(type=>matches(value,type))){errors.push(`${path}: expected type ${expected.join('|')}`);return;}
  }
  if(typeof value==='string'){
    if(Number.isFinite(schema.minLength)&&value.length<schema.minLength) errors.push(`${path}: shorter than minLength`);
    if(schema.pattern&&!(new RegExp(schema.pattern).test(value))) errors.push(`${path}: pattern mismatch`);
    if(schema.format==='date-time'&&!Number.isFinite(Date.parse(value))) errors.push(`${path}: invalid date-time`);
  }
  if(typeof value==='number'){
    if(Number.isFinite(schema.minimum)&&value<schema.minimum) errors.push(`${path}: below minimum`);
    if(Number.isFinite(schema.maximum)&&value>schema.maximum) errors.push(`${path}: above maximum`);
  }
  if(Array.isArray(value)&&schema.items) value.forEach((item,index)=>check(schema.items,item,`${path}[${index}]`,errors));
  if(value&&typeof value==='object'&&!Array.isArray(value)){
    for(const field of schema.required||[]) if(value[field]===undefined||value[field]===null||value[field]==='') errors.push(`${path}.${field}: required`);
    for(const [field,child] of Object.entries(schema.properties||{})) if(value[field]!==undefined) check(child,value[field],`${path}.${field}`,errors);
  }
}
export function contractSchema(type){return SET.has(type)?structuredClone(SCHEMAS[type]):null;}
export function validateContract(type,value){
  if(!SET.has(type)) return {valid:false,errors:[`unknown contract type: ${type}`],schema_id:null};
  if(!value||typeof value!=='object'||Array.isArray(value)) return {valid:false,errors:['$: expected object'],schema_id:SCHEMAS[type].$id};
  const errors=[];check(SCHEMAS[type],value,'$',errors);
  return {valid:errors.length===0,errors,schema_id:SCHEMAS[type].$id};
}
export function assertContract(type,value){const result=validateContract(type,value);if(!result.valid) throw new Error(`${type} contract invalid (${result.schema_id}): ${result.errors.join(', ')}`);return value;}
export function normalizeLegacy(value,type){
  const copy={...(value||{})};
  if(type==='task'){
    copy.status ||= copy.external_state==='DONE'||copy.internal_state==='DONE'?'completed':copy.internal_state==='BLOCKED'?'blocked':copy.internal_state||'unavailable';
    copy.source ||= 'legacy.task.state';copy.measurement_type ||= 'unavailable';copy.timestamp ||= copy.updated_at||copy.created_at||new Date(0).toISOString();
  } else {copy.source ||= 'legacy';copy.measurement_type ||= 'unavailable';copy.timestamp ||= copy.created_at||new Date(0).toISOString();}
  return copy;
}
export function contractTypes(){return [...TYPES];}
