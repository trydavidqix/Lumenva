import type { EventBus } from './event-bus.js';

export interface TelemetryObservation { name:string; value:number; unit?:string; source:string; traceId?:string; occurredAt:string; provenance:'runtime'|'derived'; }
export class TelemetryStore {
 #items:TelemetryObservation[]=[];
 constructor(private readonly events:EventBus){}
 async observe(input:Omit<TelemetryObservation,'occurredAt'>){ const item={...input,occurredAt:new Date().toISOString()}; this.#items.push(item); await this.events.emit('telemetry.observed',item,{source:input.source,traceId:input.traceId}); return {...item}; }
 list(){ return this.#items.map(x=>({...x})); }
}
