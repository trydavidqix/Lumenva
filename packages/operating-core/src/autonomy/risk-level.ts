export enum RiskLevel {
  R0 = 'R0', // trivial
  R1 = 'R1', // baixo
  R2 = 'R2', // moderado
  R3 = 'R3', // estratégico
  R4 = 'R4', // crítico
}

export interface RiskPolicy {
  level: RiskLevel;
  description: string;
  approvalRequired: string[];
}

export const RiskPolicies: Record<RiskLevel, RiskPolicy> = {
  [RiskLevel.R0]: { level: RiskLevel.R0, description: 'Trivial', approvalRequired: [] },
  [RiskLevel.R1]: { level: RiskLevel.R1, description: 'Baixo', approvalRequired: ['Builder'] },
  [RiskLevel.R2]: { level: RiskLevel.R2, description: 'Moderado', approvalRequired: ['Architect', 'Builder'] },
  [RiskLevel.R3]: { level: RiskLevel.R3, description: 'Estratégico', approvalRequired: ['ExecutiveCouncil'] },
  [RiskLevel.R4]: { level: RiskLevel.R4, description: 'Crítico', approvalRequired: ['Human', 'ExecutiveCouncil'] },
};
