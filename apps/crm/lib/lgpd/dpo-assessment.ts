export type DpoAssessmentResult = "required" | "not_required" | "unknown";

/** Feature flag is intentionally OFF until tenant-by-tenant rollout is approved. */
export const DPO_ASSESSMENT_V1 = process.env.DPO_ASSESSMENT_V1 === "true";

export function readDpoAssessment(row: { dpo_required?: boolean | null }): DpoAssessmentResult {
  if (row.dpo_required === true) return "required";
  if (row.dpo_required === false) return "not_required";
  return "unknown";
}
