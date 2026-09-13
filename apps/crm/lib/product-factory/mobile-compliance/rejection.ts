export type RejectionRecoveryAction = "FIX" | "CLARIFY" | "APPEAL" | "REQUEST_INTERPRETATION";

export interface StoreRejectionInput {
  store: "APP_STORE" | "PLAY_STORE";
  message: string;
  matchedRuleId?: string;
  implementationContradictsRule?: boolean;
  evidenceSupportsCompliance?: boolean;
  messageIsAmbiguous?: boolean;
}

export function classifyStoreRejection(input: StoreRejectionInput): RejectionRecoveryAction {
  if (input.messageIsAmbiguous || !input.message.trim()) return "REQUEST_INTERPRETATION";
  if (input.implementationContradictsRule === true) return "FIX";
  if (input.evidenceSupportsCompliance === true && input.matchedRuleId) return "APPEAL";
  if (input.matchedRuleId) return "CLARIFY";
  return "REQUEST_INTERPRETATION";
}
