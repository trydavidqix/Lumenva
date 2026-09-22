export const WORKFORCE_CONTRACT_VERSION='1.0.0';
export interface VersionedContract{contract_version:string}
export function withContractVersion<T extends object>(value:T):T&VersionedContract{return{...value,contract_version:WORKFORCE_CONTRACT_VERSION}}
