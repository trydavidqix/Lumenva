import type { RiskLevel } from './execution-port';
export interface RuntimePolicyDecision{allowed:boolean;requires_approval:boolean;reasons:string[]}
export function runtimePolicy(input:{risk:RiskLevel;production?:boolean;destructive?:boolean;touches_secrets?:boolean;financial?:boolean}):RuntimePolicyDecision{
 const reasons:string[]=[];
 const approval=input.risk==='R3'||input.risk==='R4'||!!input.production||!!input.destructive||!!input.touches_secrets||!!input.financial;
 if(input.destructive)reasons.push('destructive_action');
 if(input.production)reasons.push('production_change');
 if(input.touches_secrets)reasons.push('secrets_boundary');
 if(input.financial)reasons.push('financial_action');
 if(input.risk==='R4')reasons.push('critical_risk');
 return{allowed:!approval,requires_approval:approval,reasons};
}
