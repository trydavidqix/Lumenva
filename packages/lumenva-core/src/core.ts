import { EventBus } from './event-bus.ts'; import type { CoreHealth } from './contracts.ts';
export class LumenvaCore {
  readonly events = new EventBus(); #status: CoreHealth['status']='STOPPED'; #startedAt: string|null=null;
  health(): CoreHealth { return {status:this.#status,startedAt:this.#startedAt,eventSequence:this.events.sequence,subscribers:this.events.subscriberCount}; }
  async start(){ if(this.#status==='READY') return this.health(); this.#status='STARTING'; this.#startedAt=new Date().toISOString(); await this.events.emit('core.started',{pid:process.pid,platform:process.platform}); this.#status='READY'; return this.health(); }
  async stop(){ if(this.#status==='STOPPED') return this.health(); this.#status='STOPPING'; await this.events.emit('core.stopping',{}); this.#status='STOPPED'; return this.health(); }
}
