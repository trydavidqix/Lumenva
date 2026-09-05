export type TransferGateMode = "off" | "observe" | "block";
export function transferGateMode(value = process.env.TRANSFER_GATE_V1): TransferGateMode { return value === "block" || value === "observe" ? value : "off"; }
export function evaluateTransfer(input: { eee: boolean; safeguards: "scc" | "bcr" | "none" | "unknown"; mode?: TransferGateMode }) {
  const mode = input.mode ?? transferGateMode();
  const compliant = input.eee || input.safeguards === "scc" || input.safeguards === "bcr";
  return { mode, compliant, blocked: mode === "block" && !compliant, alert: mode === "observe" && !compliant };
}
