import { randomUUID } from 'node:crypto';
import type { CoreEvent, CoreEventType, Unsubscribe } from './contracts.ts';
type Handler = (event: CoreEvent) => void | Promise<void>;
export class EventBus {
  #handlers = new Map<CoreEventType|'*', Set<Handler>>(); #sequence = 0;
  get sequence(){ return this.#sequence; }
  get subscriberCount(){ return [...this.#handlers.values()].reduce((n,set)=>n+set.size,0); }
  on(type: CoreEventType|'*', handler: Handler): Unsubscribe { const set=this.#handlers.get(type)??new Set<Handler>(); set.add(handler); this.#handlers.set(type,set); return ()=>set.delete(handler); }
  async emit<T>(type: CoreEventType, payload: T, options: {source?:string;traceId?:string}={}): Promise<CoreEvent<T>> {
    const event: CoreEvent<T>={id:randomUUID(),type,occurredAt:new Date().toISOString(),source:options.source??'lumenva-core',payload,...(options.traceId?{traceId:options.traceId}:{})};
    this.#sequence++; for(const handler of [...(this.#handlers.get(type)??[]),...(this.#handlers.get('*')??[])]) await handler(event); return event;
  }
}
