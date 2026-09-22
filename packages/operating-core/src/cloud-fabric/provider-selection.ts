import type { ExecutionPort } from './execution-port';
export async function firstHealthyIndependentPort(ports:ExecutionPort[],implementer?:string):Promise<ExecutionPort|undefined>{for(const port of ports){if(port.name===implementer)continue;const health=port.health?await port.health():'healthy';if(health==='healthy')return port}return undefined}
