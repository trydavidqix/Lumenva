export type PhaseStatus='IMPLEMENTED_STRUCTURAL'|'BLOCKED_EXTERNAL'|'NOT_STARTED';
export interface PlanPhaseStatus{phase:string;status:PhaseStatus;evidence:string[]}
export const TOKENS_PHASE_STATUS:PlanPhaseStatus[]=[
{phase:'F1-F6',status:'IMPLEMENTED_STRUCTURAL',evidence:['canonical contracts','context engine','lazy tools','model registry']},
{phase:'F7-F9',status:'BLOCKED_EXTERNAL',evidence:['adapter boundaries exist','real credentials/quota telemetry required']},
{phase:'F10-F18',status:'IMPLEMENTED_STRUCTURAL',evidence:['router','escalation','evidence','reviewer port','worktree policy','memory','traces']},
{phase:'F19-F20',status:'IMPLEMENTED_STRUCTURAL',evidence:['dashboard service/snapshot exist','live UI wiring remains']},
{phase:'F21',status:'BLOCKED_EXTERNAL',evidence:['30-case corpus/harness exist','provider-backed execution required']},
{phase:'F22-F23',status:'IMPLEMENTED_STRUCTURAL',evidence:['learning router','autonomous risk policy']},
{phase:'F24',status:'BLOCKED_EXTERNAL',evidence:['rollout requires runtime credentials and deployment authorization']}];
