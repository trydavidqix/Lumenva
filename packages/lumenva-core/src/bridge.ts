import type { AgentRuntime } from './agent-runtime.ts';
import type { LumenvaCore } from './core.ts';
import type { TelemetryStore } from './telemetry.ts';
import type { TerminalRuntime } from './terminal-runtime.ts';

export interface CoreBridge {
 health():ReturnType<LumenvaCore['health']>;
 agents():ReturnType<AgentRuntime['list']>;
 terminals():ReturnType<TerminalRuntime['list']>;
 startAgent(id:string,workspace:string,task?:string,traceId?:string):ReturnType<AgentRuntime['start']>;
 stopAgent(id:string):ReturnType<AgentRuntime['stop']>;
 writeAgent(id:string,data:string):void;
 telemetry():ReturnType<TelemetryStore['list']>;
}
export function createCoreBridge(core:LumenvaCore,agents:AgentRuntime,terminals:TerminalRuntime,telemetry:TelemetryStore):CoreBridge {
 return {health:()=>core.health(),agents:()=>agents.list(),terminals:()=>terminals.list(),startAgent:(...a)=>agents.start(...a),stopAgent:(id)=>agents.stop(id),writeAgent:(id,d)=>agents.write(id,d),telemetry:()=>telemetry.list()};
}
