import type { EventBus } from './event-bus.js';
import type { TerminalRuntime, TerminalSnapshot } from './terminal-runtime.js';

export type AgentRisk = 'R0' | 'R1' | 'R2' | 'R3' | 'R4';
export type AgentStatus = 'IDLE' | 'STARTING' | 'RUNNING' | 'WAITING' | 'BLOCKED' | 'STOPPED' | 'ERROR';

export interface AgentManifest {
  id: string;
  name: string;
  role: string;
  executable: string;
  args?: string[];
  workspaceIsolation: 'shared' | 'worktree' | 'dedicated';
  risk: AgentRisk;
  contextPolicy: string;
  telemetry: boolean;
  reasoning: 'low' | 'medium' | 'high' | 'extra-high';
}

export interface AgentInstance {
  manifest: AgentManifest;
  status: AgentStatus;
  terminalId: string | null;
  workspace: string | null;
  currentTask: string | null;
  startedAt: string | null;
  stoppedAt: string | null;
}

export const DEFAULT_AGENT_MANIFESTS: readonly AgentManifest[] = [
  { id:'claude-ceo', name:'Claude CEO', role:'CEO', executable:'claude', workspaceIsolation:'shared', risk:'R2', contextPolicy:'executive-private', telemetry:true, reasoning:'high' },
  { id:'codex-cto', name:'Codex CTO', role:'CTO', executable:'codex', workspaceIsolation:'worktree', risk:'R2', contextPolicy:'engineering-private', telemetry:true, reasoning:'high' },
  { id:'codex-reviewer', name:'Codex Reviewer', role:'Reviewer', executable:'codex', workspaceIsolation:'worktree', risk:'R1', contextPolicy:'review-readonly', telemetry:true, reasoning:'high' },
  { id:'codex-tester', name:'Codex Tester', role:'Tester', executable:'codex', workspaceIsolation:'worktree', risk:'R1', contextPolicy:'test-isolated', telemetry:true, reasoning:'medium' },
  { id:'codex-mcg', name:'Codex MCG', role:'MCG', executable:'codex', workspaceIsolation:'worktree', risk:'R1', contextPolicy:'mcg-evidence', telemetry:true, reasoning:'high' },
  { id:'antigravity-cio', name:'Antigravity CIO', role:'CIO', executable:'gemini', workspaceIsolation:'shared', risk:'R1', contextPolicy:'research-private', telemetry:true, reasoning:'high' },
] as const;

export class AgentRuntime {
  #instances = new Map<string, AgentInstance>();
  constructor(private readonly events: EventBus, private readonly terminals: TerminalRuntime, manifests: readonly AgentManifest[] = DEFAULT_AGENT_MANIFESTS) {
    for (const manifest of manifests) this.#instances.set(manifest.id, { manifest:{...manifest,args:[...(manifest.args??[])]}, status:'IDLE', terminalId:null, workspace:null, currentTask:null, startedAt:null, stoppedAt:null });
  }
  list(): AgentInstance[] { return [...this.#instances.values()].map(x => structuredClone(x)); }
  get(id:string): AgentInstance | null { const x=this.#instances.get(id); return x?structuredClone(x):null; }
  async start(id:string, workspace:string, task?:string, traceId?:string):Promise<AgentInstance>{
    const instance=this.#require(id);
    if(instance.status==='RUNNING'||instance.status==='STARTING') throw new Error('agent_already_running');
    instance.status='STARTING'; instance.workspace=workspace; instance.currentTask=task??null;
    await this.events.emit('agent.status.changed',{agentId:id,status:'STARTING'},{source:'agent-runtime',traceId});
    try {
      const terminal=await this.terminals.create({executable:instance.manifest.executable,args:instance.manifest.args,cwd:workspace,traceId,source:`agent:${id}`});
      instance.terminalId=terminal.id; instance.status='RUNNING'; instance.startedAt=new Date().toISOString(); instance.stoppedAt=null;
      await this.events.emit('agent.status.changed',{agentId:id,status:'RUNNING',terminalId:terminal.id},{source:'agent-runtime',traceId});
      return structuredClone(instance);
    } catch(error) {
      instance.status='ERROR';
      await this.events.emit('agent.status.changed',{agentId:id,status:'ERROR',error:error instanceof Error?error.message:'unknown'},{source:'agent-runtime',traceId});
      throw error;
    }
  }
  async stop(id:string):Promise<void>{ const x=this.#require(id); if(x.terminalId) this.terminals.kill(x.terminalId); x.status='STOPPED'; x.stoppedAt=new Date().toISOString(); await this.events.emit('agent.status.changed',{agentId:id,status:'STOPPED'},{source:'agent-runtime'}); }
  write(id:string,data:string):void{ const x=this.#require(id); if(!x.terminalId) throw new Error('agent_terminal_unavailable'); this.terminals.write(x.terminalId,data); }
  terminal(id:string):TerminalSnapshot|null{ const x=this.#require(id); return x.terminalId?this.terminals.get(x.terminalId):null; }
  #require(id:string){ const x=this.#instances.get(id); if(!x) throw new Error('agent_not_found'); return x; }
}
